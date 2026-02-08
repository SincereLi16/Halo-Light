import type { HaloLightParams } from "./types";
import type { GradientStop } from "./types";
import type { SpotGeometry } from "./types";
import type { GradientMode } from "./types";
import { getSpotGeometry } from "./geometry";
import { buildRadialStops, buildBloomStops, buildMultiRingStops, buildEdgeFalloffStops, buildChromaticFringeRingStops, sampleStopsAtT, buildPenumbraOnlyStops } from "./gradient";

const TWO_PI = Math.PI * 2;
function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}
function lobe(theta: number, center: number, width: number): number {
  const d = angleDiff(theta, center);
  const x = d / width;
  return Math.exp(-x * x);
}
function smoothstep(a: number, b: number, x: number): number {
  const t = (x - a) / (b - a);
  const t2 = Math.max(0, Math.min(1, t));
  return t2 * t2 * (3 - 2 * t2);
}
/** 半影区径向形变，带柔和渐入渐隐，返回归一化半径上的偏移 */
function getWobble(rNorm: number, theta: number, t: number, wobbleAmount: number, wobbleSpeed: number): number {
  const innerR = 0.45;
  const outerR = 1.25;
  const rampIn = 0.22;
  const fadeOut = 0.28;
  const ramp = smoothstep(innerR, innerR + rampIn, rNorm);
  const fade = 1 - smoothstep(outerR - fadeOut, outerR, rNorm);
  const radialFactor = ramp * fade;
  const moveSpeed = 0.15 + (2.5 - 0.15) * Math.max(0, Math.min(1, wobbleSpeed));
  const theta0 = t * moveSpeed;
  const theta1 = theta0 + TWO_PI / 3;
  const theta2 = theta0 + (2 * TWO_PI) / 3;
  const a0 = Math.sin(t * 1.1);
  const a1 = Math.sin(t * 1.4 + 1.3);
  const a2 = Math.sin(t * 0.9 + 2.1);
  const w0 = a0 * lobe(theta, theta0, 0.6);
  const w1 = a1 * lobe(theta, theta1, 0.6);
  const w2 = a2 * lobe(theta, theta2, 0.6);
  const wobbleBase = w0 + w1 + w2;
  return wobbleAmount * 2 * radialFactor * wobbleBase;
}

function applyStops(gradient: CanvasGradient, stops: GradientStop[]): void {
  for (const s of stops) {
    const { t, r, g, b, a } = s;
    const tClamped = Math.max(0, Math.min(1, t));
    gradient.addColorStop(tClamped, `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`);
  }
}

/** 非径向模式：先按半影做边缘柔化（destination-in），再在边缘绘色散环 */
function applyEdgeFalloffAndFringe(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry,
  R: number
): void {
  ctx.globalCompositeOperation = "destination-in";
  const falloffGrad = createSpotlightRadialGradient(ctx, geom, R);
  applyStops(falloffGrad, buildEdgeFalloffStops(geom));
  ctx.fillStyle = falloffGrad;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  if (params.edge.chromaticFringeEnabled && params.edge.chromaticFringe > 0.005) {
    const fringeGrad = createSpotlightRadialGradient(ctx, geom, R * 1.08);
    applyStops(fringeGrad, buildChromaticFringeRingStops(params, geom));
    ctx.fillStyle = fringeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.08, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 将地平线/多环/扇形主光斑绘到离屏再叠到当前 ctx，避免 destination-in 裁掉外圈光晕 */
function drawNonRadialSpotToCtx(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry,
  R: number,
  drawContent: (targetCtx: CanvasRenderingContext2D) => void
): void {
  // 为了让色散环不被裁切，离屏画布比主半径稍大一圈
  const marginFactor = 1.25;
  const size = Math.ceil(R * 2 * marginFactor) + 4;
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const offCtx = off.getContext("2d")!;
  offCtx.translate(size / 2, size / 2);
  drawContent(offCtx);
  applyEdgeFalloffAndFringe(offCtx, params, geom, R);
  ctx.drawImage(off, -size / 2, -size / 2);
}

/** 仅绘制地平线线性渐变（在已 translate 的 ctx 上，中心为 0,0） */
function drawHorizonGradient(ctx: CanvasRenderingContext2D, params: HaloLightParams, R: number): void {
  const { colors, numColors, horizonY, softness, tilt } = params.color.horizon;
  const n = Math.max(2, Math.min(4, numColors));
  const angle = tilt * (Math.PI / 4);
  const dx = Math.sin(angle) * R * 2;
  const dy = Math.cos(angle) * R * 2;
  const grad = ctx.createLinearGradient(-dx / 2, -dy / 2, dx / 2, dy / 2);
  // 用 horizonY + softness 控制“过渡带”位置与宽度：颜色只在过渡带内变化，其余区域保持首/末色
  const soft = Math.max(0.001, Math.min(1, softness));
  const y0 = Math.max(0, Math.min(1, horizonY - soft / 2));
  const y1 = Math.max(0, Math.min(1, horizonY + soft / 2));
  const span = Math.max(0.001, y1 - y0);

  const c0 = colors[0] ?? [0.5, 0.3, 0.2];
  const cLast = colors[n - 1] ?? c0;
  grad.addColorStop(0, rgbToRgba(c0, 1));
  grad.addColorStop(y0, rgbToRgba(c0, 1));
  for (let i = 0; i < n; i++) {
    const tBand = i / (n - 1);
    const t = y0 + span * tBand;
    const c = colors[i] ?? c0;
    grad.addColorStop(t, rgbToRgba(c, 1));
  }
  grad.addColorStop(y1, rgbToRgba(cLast, 1));
  grad.addColorStop(1, rgbToRgba(cLast, 1));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
}

const DARK_GRAY_R = 26;
const DARK_GRAY_G = 25;
const DARK_GRAY_B = 24;

let wallTextureCanvas: HTMLCanvasElement | null = null;

function getWallTextureCanvas(): HTMLCanvasElement {
  if (wallTextureCanvas) return wallTextureCanvas;
  const size = 128;
  wallTextureCanvas = document.createElement("canvas");
  wallTextureCanvas.width = size;
  wallTextureCanvas.height = size;
  const tx = wallTextureCanvas.getContext("2d")!;
  const id = tx.getImageData(0, 0, size, size);
  const d = id.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = (Math.random() - 0.5) * 25 + (Math.random() - 0.5) * 15;
      const v = Math.max(0, Math.min(255, 128 + n));
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = Math.floor(Math.random() * 14 + 6);
    }
  }
  tx.putImageData(id, 0, 0);
  return wallTextureCanvas;
}

/** 深灰房间：深灰底 + 墙面 + 墙面纹理，灯光叠上去后照亮墙面 */
function drawDarkRoom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wallTint: [number, number, number]
): void {
  ctx.fillStyle = `rgb(${DARK_GRAY_R},${DARK_GRAY_G},${DARK_GRAY_B})`;
  ctx.fillRect(0, 0, w, h);

  const wr = Math.min(1, 0.12 + wallTint[0] * 0.15);
  const wg = Math.min(1, 0.115 + wallTint[1] * 0.15);
  const wb = Math.min(1, 0.11 + wallTint[2] * 0.15);
  const r = Math.round(wr * 255);
  const g = Math.round(wg * 255);
  const b = Math.round(wb * 255);

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);

  const edgeGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  edgeGrad.addColorStop(0, "rgba(0,0,0,0)");
  edgeGrad.addColorStop(0.55, "rgba(0,0,0,0)");
  edgeGrad.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, w, h);

  const pattern = ctx.createPattern(getWallTextureCanvas(), "repeat");
  if (pattern) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}

let noiseCanvas: HTMLCanvasElement | null = null;

function getNoiseCanvas(size: number): HTMLCanvasElement {
  if (noiseCanvas && noiseCanvas.width === size) return noiseCanvas;
  noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = size;
  noiseCanvas.height = size;
  const nx = noiseCanvas.getContext("2d")!;
  const id = nx.getImageData(0, 0, size, size);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 40;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = Math.random() * 12 + 4;
  }
  nx.putImageData(id, 0, 0);
  return noiseCanvas;
}

/** 在光斑区域叠一层极轻噪点，增强真实感 */
function drawLightNoise(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  scaleX: number,
  scaleY: number
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scaleX, scaleY);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2);
  ctx.clip();
  const noise = getNoiseCanvas(64);
  const pattern = ctx.createPattern(noise, "repeat");
  if (pattern) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pattern;
    ctx.fillRect(-radius * 2, -radius * 2, radius * 4, radius * 4);
  }
  ctx.restore();
}

/** 仅绘制半影环带（无外圈光晕、无内部亮斑），用于轨迹动效 */
function drawPenumbraRingOnly(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry,
  centerX: number,
  centerY: number
): void {
  const R = geom.radius;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(geom.scaleX, geom.scaleY);
  const grad = createSpotlightRadialGradient(ctx, geom, R);
  applyStops(grad, buildPenumbraOnlyStops(params, geom));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 轨迹：仅半影圆心沿圆周运动；运动半影在底层，固定光环在上层且不显示原半影区 */
function drawTrajectoryLayers(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry,
  time: number,
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number
): void {
  const diameter = params.edge.trajectoryDiameter ?? 0.15;
  const softness = params.edge.trajectoryEdgeHardness ?? 0.3; // 值越大边缘越柔软
  const speed = params.edge.trajectorySpeed ?? 0.4;
  const trail = params.edge.trajectoryTrail ?? 0.3;
  const pathRadius = geom.radius * diameter;
  const omega = 0.25 + 1.6 * speed;
  const angle = -time * omega;

  const trajRgb = params.edge.trajectoryRgb ?? params.scene.edgeRgb ?? params.scene.lightRgb;
  const paramsTraj: HaloLightParams = {
    ...params,
    scene: { ...params.scene, edgeRgb: trajRgb },
    edge: {
      ...params.edge,
      penumbraWidth: Math.max(0.05, params.edge.penumbraWidth * (0.35 + 0.65 * softness)),
    },
  };
  const geomTraj = getSpotGeometry(paramsTraj, canvasW, canvasH);

  // 固定光环：半影宽度拉满，边缘最柔，几乎看不出圆轮廓
  const paramsSoftEdge: HaloLightParams = { ...params, edge: { ...params.edge, penumbraWidth: 1 } };
  const geomSoftEdge = getSpotGeometry(paramsSoftEdge, canvasW, canvasH);

  // 1. 先画运动的半影环（底层），圆周圆心与渐变圆心同为 (cx, cy)
  const TRAIL_STEPS = 8;
  if (trail > 0.02) {
    for (let k = TRAIL_STEPS; k >= 1; k--) {
      const angleK = angle + k * 0.12;
      const tx = cx + pathRadius * Math.cos(angleK);
      const ty = cy + pathRadius * Math.sin(angleK);
      const alpha = trail * 0.52 * (1 - k / TRAIL_STEPS);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawPenumbraRingOnly(ctx, paramsTraj, geomTraj, tx, ty);
      ctx.restore();
    }
  }
  const centerX = cx + pathRadius * Math.cos(angle);
  const centerY = cy + pathRadius * Math.sin(angle);
  drawPenumbraRingOnly(ctx, paramsTraj, geomTraj, centerX, centerY);

  // 2. 再画固定中心：外圈光晕 + 内部渐变（边缘最柔，不挡住光环）
  ctx.save();
  drawLightLayers(ctx, paramsSoftEdge, geomSoftEdge, cx, cy);
  ctx.restore();
}

/** 在已 translate+scale 的 ctx 上仅绘制主光斑（不含外圈光晕），用于呼吸等效果 */
function drawMainOnly(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry,
  cx: number,
  cy: number
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(geom.scaleX, geom.scaleY);
  drawMainSpot(ctx, params, geom);
  ctx.restore();
}

/** 仅绘制外圈光晕（bloom），不含主光斑，用于在动效之上叠加固定光晕 */
function drawBloomOnly(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry,
  cx: number,
  cy: number
): void {
  const bloom = params.scene.bloom ?? 0;
  if (bloom <= 0.01) return;
  const bloomRadius = geom.radius * (1.7 + 0.8 * bloom);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(geom.scaleX, geom.scaleY);
  const bloomGrad = createSpotlightRadialGradient(ctx, geom, bloomRadius);
  applyStops(bloomGrad, buildBloomStops(params));
  ctx.fillStyle = bloomGrad;
  ctx.beginPath();
  ctx.arc(0, 0, bloomRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 射灯模式：创建亮心偏移的径向渐变，上收束下扩散 */
function createSpotlightRadialGradient(
  ctx: CanvasRenderingContext2D,
  geom: SpotGeometry,
  outerR: number
): CanvasGradient {
  // hotspotOffsetY：正=下，负=上，与画布 Y 一致
  const oy = outerR * (geom.hotspotOffsetY ?? 0);
  return ctx.createRadialGradient(0, oy, 0, 0, 0, outerR);
}

/** 在已 translate+scale 的 ctx 上绘制光斑各层（不包含墙），用于主画布或离屏 */
function drawLightLayers(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry,
  cx: number,
  cy: number
): void {
  const bloom = params.scene.bloom ?? 0;

  ctx.translate(cx, cy);
  ctx.scale(geom.scaleX, geom.scaleY);

  // 1. 外圈光晕（bloom），射灯模式下亮心同步上移
  if (bloom > 0.01) {
    const bloomRadius = geom.radius * (1.7 + 0.8 * bloom);
    const bloomGrad = createSpotlightRadialGradient(ctx, geom, bloomRadius);
    applyStops(bloomGrad, buildBloomStops(params));
    ctx.fillStyle = bloomGrad;
    ctx.beginPath();
    ctx.arc(0, 0, bloomRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. 主光斑（按渐变类型分支）
  drawMainSpot(ctx, params, geom);
}

function drawMainSpot(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry
): void {
  const mode: GradientMode = params.color.gradientMode ?? "radial";
  const R = geom.radius;

  if (mode === "radial") {
    const mainGrad = createSpotlightRadialGradient(ctx, geom, R);
    applyStops(mainGrad, buildRadialStops(params, geom));
    ctx.fillStyle = mainGrad;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (mode === "horizon") {
    drawNonRadialSpotToCtx(ctx, params, geom, R, (targetCtx) => drawHorizonGradient(targetCtx, params, R));
    return;
  }

  if (mode === "multiRing") {
    drawNonRadialSpotToCtx(ctx, params, geom, R, (targetCtx) => {
      const mainGrad = createSpotlightRadialGradient(targetCtx, geom, R);
      applyStops(mainGrad, buildMultiRingStops(params));
      targetCtx.fillStyle = mainGrad;
      targetCtx.beginPath();
      targetCtx.arc(0, 0, R, 0, Math.PI * 2);
      targetCtx.fill();
    });
    return;
  }

  if (mode === "sector") {
    drawNonRadialSpotToCtx(ctx, params, geom, R, (targetCtx) => {
      const { numSectors, sectorColors, centerRgb, radialBlend } = params.color.sector;
      const n = Math.min(numSectors, sectorColors.length);
      const conic = (targetCtx as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient;
      if (typeof conic === "function") {
        const cg = conic.call(targetCtx, 0, 0, 0);
        for (let i = 0; i <= n; i++) {
          const c = sectorColors[i % n] ?? sectorColors[0]!;
          cg.addColorStop(i / n, rgbToRgba(c, 1));
        }
        targetCtx.fillStyle = cg;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, R, 0, Math.PI * 2);
        targetCtx.fill();
      } else {
        const mainGrad = createSpotlightRadialGradient(targetCtx, geom, R);
        applyStops(mainGrad, buildRadialStops(params, geom));
        targetCtx.fillStyle = mainGrad;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, R, 0, Math.PI * 2);
        targetCtx.fill();
      }
      // 中心亮点弱化：改为“中环轻微加亮”，中心完全不叠加
      const rInner = R * 0.3;
      const oy = R * (geom.hotspotOffsetY ?? 0);
      const overlay = targetCtx.createRadialGradient(0, oy, rInner, 0, 0, R);
      const rb = radialBlend * 0.45;
      overlay.addColorStop(0, rgbToRgba(centerRgb, 0));        // r < rInner：完全透明
      overlay.addColorStop(1, rgbToRgba(centerRgb, rb));       // 远离中心处轻微提亮
      targetCtx.fillStyle = overlay;
      targetCtx.beginPath();
      targetCtx.arc(0, 0, R, 0, Math.PI * 2);
      targetCtx.fill();
    });
    return;
  }

  const mainGrad = createSpotlightRadialGradient(ctx, geom, R);
  applyStops(mainGrad, buildRadialStops(params, geom));
  ctx.fillStyle = mainGrad;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
}

function r(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
}
function rgbToRgba(rgb: [number, number, number], a: number): string {
  return `rgba(${r(rgb[0])},${r(rgb[1])},${r(rgb[2])},${a})`;
}
function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** 动光：多层彩色雾状光在光环上方流转，可外溢 */
function drawMovingLight(
  ctx: CanvasRenderingContext2D,
  params: HaloLightParams,
  geom: SpotGeometry,
  time: number,
  cx: number,
  cy: number
): void {
  if (!params.scene.movingLightEnabled) return;
  const baseRgb = params.scene.edgeRgb ?? params.scene.lightRgb;
  const intensity = params.scene.movingLightIntensity ?? 0.6;
  const spread = params.scene.movingLightSpread ?? 0.25;
  const dyn = params.scene.movingLightDynamic ?? 0.5;
  const range = params.scene.movingLightRange ?? 0.5;
  const irregular = params.scene.movingLightIrregular === true;

  const R = geom.radius;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(geom.scaleX, geom.scaleY);

  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "screen";

  const t = time;
  const layerCount = irregular ? 5 : 3;

  for (let i = 0; i < layerCount; i++) {
    const li = i / Math.max(1, layerCount - 1);

    // 每层使用不同频率和相位的组合正弦，生成在光环内完全不规则的运动轨迹
    const f1 = 0.7 + 0.18 * i;
    const f2 = 1.21 + 0.13 * i;
    const f3 = 0.93 + 0.16 * i;
    const ax = Math.sin(t * f1) + 0.6 * Math.sin(t * f2 + 1.7 * i);
    const ay = Math.cos(t * f3 + 0.9) + 0.5 * Math.sin(t * (f1 * 0.8) + 2.3 * i);
    // 运动范围：控制轨迹可到达的最大半径，越大范围越广
    const maxR = R * (0.25 + 0.6 * range);
    const cxLocal = ax * maxR * 0.35;
    const cyLocal = ay * maxR * 0.35;

    // 每层雾状半径：结合扩散与运动范围；范围越大整体越模糊
    const fogRadius = R * (0.6 + 0.4 * spread + 0.35 * range + 0.18 * li);

    // 彩色雾层：用简单的 cos 调色板叠在基色上，形成多色层次
    const paletteT = (t * (0.06 + 0.03 * i + 0.05 * dyn) + li * 0.27) % 1;
    const rainbow: [number, number, number] = [
      0.5 + 0.5 * Math.cos(6.28318 * (paletteT + 0.0)),
      0.5 + 0.5 * Math.cos(6.28318 * (paletteT + 0.33)),
      0.5 + 0.5 * Math.cos(6.28318 * (paletteT + 0.67)),
    ];
    // 动态变化强度：越高，越偏向彩虹色，局部色彩差异越大
    const mixBase = 0.3 + 0.3 * li;
    const mixK = Math.max(0, Math.min(1, mixBase + dyn * 0.5));
    const colorMix = lerpRgb(baseRgb, rainbow, mixK);

    const jitter = 0.7 + (0.3 + 0.5 * dyn) * Math.sin(t * (1.3 + 0.4 * i) + li * 3.1);
    const centerA = intensity * (0.4 + 0.6 * li) * jitter;
    const edgeA = centerA * 0.15;

    const anchors = irregular ? 6 : 1;
    for (let a = 0; a < anchors; a++) {
      const phaseA = irregular ? a * (Math.PI / 3) + 1.1 * Math.sin(t * (0.7 + 0.15 * a) + a * 1.3) : 0;
      const offsetR = irregular ? fogRadius * (0.25 + 0.35 * Math.sin(t * 0.8 + a * 0.9)) : 0;
      const offsetX = irregular ? cxLocal + Math.cos(phaseA) * offsetR : cxLocal;
      const offsetY = irregular ? cyLocal + Math.sin(phaseA) * offsetR : cyLocal;

      const localRadius = irregular
        ? fogRadius * (0.7 + 0.4 * Math.abs(Math.sin(t * (1.1 + 0.3 * a) + li * 2.1)))
        : fogRadius;

      const grad = ctx.createRadialGradient(offsetX, offsetY, 0, offsetX, offsetY, localRadius);
      // 中心鲜艳、边缘黯淡直至近乎不可见
      grad.addColorStop(0.0, rgbToRgba(colorMix, centerA));
      grad.addColorStop(0.32, rgbToRgba(colorMix, centerA * 0.45));
      grad.addColorStop(0.82, rgbToRgba(colorMix, edgeA));
      grad.addColorStop(1.0, rgbToRgba(colorMix, 0.0));

      ctx.fillStyle = grad;
      ctx.fillRect(-R * 2, -R * 2, R * 4, R * 4);
    }
  }

  // 叠加一层轻微噪点纹理，让整体形状完全不规则、雾感更自然
  const noise = getNoiseCanvas(64);
  const pattern = ctx.createPattern(noise, "repeat");
  if (pattern) {
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = pattern;
    ctx.fillRect(-R * 2, -R * 2, R * 4, R * 4);
  }

  ctx.globalCompositeOperation = prevOp;
  ctx.restore();
}


/** 对离屏画布光斑区域按时间做半影呼吸形变。通过位移采样实现，支持任意渐变类型（径向、地平线、多环、扇形）。扩大时写背景色不写透明，避免 drawImage 不更新导致“焊死”。 */
function applyBreathingWobble(
  off: HTMLCanvasElement,
  params: HaloLightParams,
  geom: SpotGeometry,
  time: number,
  cx: number,
  cy: number
): void {
  const w = off.width;
  const h = off.height;
  const { radius, scaleX, scaleY } = geom;
  const amount = params.edge.wobbleAmount ?? 0.03;
  const speed = params.edge.wobbleSpeed ?? 0.4;
  const [wt0, wt1, wt2] = params.scene.wallTint;
  const bgR = Math.min(255, Math.round((0.12 + wt0 * 0.15) * 255));
  const bgG = Math.min(255, Math.round((0.115 + wt1 * 0.15) * 255));
  const bgB = Math.min(255, Math.round((0.11 + wt2 * 0.15) * 255));
  const x0 = Math.max(0, Math.floor(cx - radius * scaleX * 1.05));
  const y0 = Math.max(0, Math.floor(cy - radius * scaleY * 1.05));
  const x1 = Math.min(w, Math.ceil(cx + radius * scaleX * 1.05));
  const y1 = Math.min(h, Math.ceil(cy + radius * scaleY * 1.05));
  const sw = x1 - x0;
  const sh = y1 - y0;
  const srcData = off.getContext("2d")!.getImageData(x0, y0, sw, sh);
  const dstData = off.getContext("2d")!.getImageData(x0, y0, sw, sh);

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = (px - cx) / scaleX;
      const dy = (py - cy) / scaleY;
      const r = Math.sqrt(dx * dx + dy * dy);
      const rNorm = r / radius;
      if (rNorm > 1.05) continue;
      const theta = Math.atan2(dy, dx);
      const wobble = getWobble(rNorm, theta, time, amount, speed);
      const rLocalNorm = Math.max(0, Math.min(1.05, rNorm + wobble));
      const sx = cx + rLocalNorm * radius * Math.cos(theta) * scaleX;
      const sy = cy + rLocalNorm * radius * Math.sin(theta) * scaleY;
      const sxi = Math.round(sx - x0);
      const syi = Math.round(sy - y0);
      const si = syi * sw + sxi;
      const i = (py - y0) * sw + (px - x0);
      if (sxi >= 0 && sxi < sw && syi >= 0 && syi < sh) {
        dstData.data[i * 4] = srcData.data[si * 4]!;
        dstData.data[i * 4 + 1] = srcData.data[si * 4 + 1]!;
        dstData.data[i * 4 + 2] = srcData.data[si * 4 + 2]!;
        dstData.data[i * 4 + 3] = srcData.data[si * 4 + 3]!;
      } else {
        dstData.data[i * 4] = bgR;
        dstData.data[i * 4 + 1] = bgG;
        dstData.data[i * 4 + 2] = bgB;
        dstData.data[i * 4 + 3] = 255;
      }
    }
  }
  off.getContext("2d")!.putImageData(dstData, x0, y0);
}

export function render(ctx: CanvasRenderingContext2D, params: HaloLightParams, time?: number): void {
  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  const geom = getSpotGeometry(params, w, h);
  const softBlur = params.scene.softBlur ?? 0;
  const softBlurEnabled = params.edge.breathingEnabled && softBlur > 0.02;
  const haze = params.scene.haze ?? 0;
  const breathing = params.edge.breathingEnabled && time != null;
  const trajectory = params.edge.trajectoryEnabled && time != null;
  const movingLight = params.scene.movingLightEnabled && time != null;
  const useOffscreen = breathing || trajectory || (softBlurEnabled && softBlur > 0.02);

  let off: HTMLCanvasElement | null = null;
  if (useOffscreen) {
    off = document.createElement("canvas");
    off.width = w;
    off.height = h;
  }
  const targetCtx = useOffscreen ? off!.getContext("2d")! : ctx;

  // 1. 房间 + 灯光
  drawDarkRoom(targetCtx, w, h, params.scene.wallTint);
  if (useOffscreen && off) {
    if (trajectory) {
      drawTrajectoryLayers(targetCtx, params, geom, time!, cx, cy, w, h);
    } else {
      if (breathing) {
        // 呼吸：先在离屏上只画主光斑（无外圈光晕），对其做半影形变，再在同一离屏上叠加外圈光晕，避免呼吸“吃掉”光晕
        drawMainOnly(targetCtx, params, geom, cx, cy);
        applyBreathingWobble(off, params, geom, time!, cx, cy);
        drawBloomOnly(targetCtx, params, geom, cx, cy);
      } else {
        // 统一在 save/restore 中调用，避免在离屏 ctx 上遗留 translate/scale 影响后续（如动光、柔焦）
        targetCtx.save();
        drawLightLayers(targetCtx, params, geom, cx, cy);
        targetCtx.restore();
      }
    }
  } else {
    ctx.save();
    drawLightLayers(ctx, params, geom, cx, cy);
    ctx.restore();
  }

  // 1.5 动光：始终叠加在光环之上（但在噪点与朦胧之下）
  if (movingLight) {
    const dynCtx = useOffscreen && off ? off.getContext("2d")! : ctx;
    drawMovingLight(dynCtx, params, geom, time!, cx, cy);
  }

  if (useOffscreen && off) {
    if (softBlurEnabled && softBlur > 0.02) {
      const blurRadius = Math.max(2, Math.round(50 * softBlur));
      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = w;
      blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext("2d")!;
      blurCtx.filter = `blur(${blurRadius}px)`;
      blurCtx.drawImage(off, 0, 0);
      ctx.drawImage(blurCanvas, 0, 0);
    } else {
      ctx.drawImage(off, 0, 0);
    }
  }

  // 2. 光斑区域轻微噪点（呼吸/轨迹开启时不叠加，避免杂色干扰半影）
  if (!breathing && !trajectory) {
    drawLightNoise(ctx, cx, cy, geom.radius, geom.scaleX, geom.scaleY);
  }

  // 3. 整体朦胧感：叠加一层模糊后的整画面，模拟失焦效果
  if (haze > 0.01) {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const offCtx = off.getContext("2d")!;
    const blurRadius = Math.max(4, Math.round(18 + 32 * haze));
    offCtx.filter = `blur(${blurRadius}px)`;
    offCtx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.4 * haze;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }
}
