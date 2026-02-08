import type { HaloLightParams } from "./types";
import type { GradientStop } from "./types";
import type { SpotGeometry } from "./types";

/**
 * 过渡曲线：transitionCurve 控制中心→边缘两色过渡的平滑度。
 */
function transitionT(linearT: number, transitionCurve: number): number {
  const power = 2 - 1.5 * transitionCurve;
  return Math.pow(linearT, power);
}

/**
 * 根据 params 与 geometry 生成主光斑径向渐变的色标数组。
 * 中心色 = lightRgb，边缘色 = edgeRgb，过渡梯度 = transitionCurve。
 */
export function buildRadialStops(params: HaloLightParams, geom: SpotGeometry): GradientStop[] {
  const centerRgb = params.scene.lightRgb;
  const edgeRgb = params.scene.edgeRgb ?? params.scene.lightRgb;
  const penumbraR0 = geom.penumbraR0;
  const penumbraR1 = geom.penumbraR1;
  const transitionCurve = params.color.transitionCurve;
  const chromaticFringeEnabled = params.edge.chromaticFringeEnabled !== false;
  const chromaticFringe = params.edge.chromaticFringe;
  const fringeRgb = params.edge.chromaticFringeRgb ?? [0.4, 0.25, 0.6];

  const stops: GradientStop[] = [];

  // 中心：固定满亮度
  stops.push({ t: 0, r: centerRgb[0], g: centerRgb[1], b: centerRgb[2], a: 1 });

  // 中心→边缘过渡：多色标平滑衰减，更接近真实光晕
  const t0 = Math.max(0, Math.min(1, transitionT(penumbraR0, transitionCurve)));
  const t1 = Math.max(0, Math.min(1, transitionT(penumbraR1, transitionCurve)));
  const mid = (t0 + t1) * 0.5;
  const q1 = (t0 + mid) * 0.5;
  const q2 = (mid + t1) * 0.5;
  stops.push({ t: t0 * 0.5, r: centerRgb[0], g: centerRgb[1], b: centerRgb[2], a: 0.96 });
  stops.push({ t: t0, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0.88 });
  stops.push({ t: q1, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0.65 });
  stops.push({ t: mid, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0.4 });
  stops.push({ t: q2, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0.18 });
  stops.push({ t: t1, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0 });

  // 色散条纹：开启时绘制；强度越高范围越大（色带）、透明度与渐变随强度增加更柔和
  if (chromaticFringeEnabled && chromaticFringe > 0.005) {
    const fringeSpread = 0.008 + 0.085 * chromaticFringe;
    const tInner = Math.max(t0, t1 - fringeSpread);
    if (tInner < t1) {
      const tMid = (tInner + t1) * 0.5;
      const alphaPeak = 0.12 + 0.2 * chromaticFringe;
      const alphaInner = 0.03 + 0.08 * chromaticFringe;
      stops.push({ t: tInner, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: alphaInner });
      stops.push({ t: tMid, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: alphaPeak });
      stops.push({ t: t1, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: 0 });
    }
  }

  // 保证所有 t 在 [0,1]，避免 addColorStop 报错
  for (const s of stops) {
    s.t = Math.max(0, Math.min(1, s.t));
  }
  stops.sort((a, b) => a.t - b.t);
  return stops;
}

/**
 * 根据径向渐变色标在 t（0~1 径向位置）处插值得到 [r,g,b,a]。
 */
export function sampleStopsAtT(stops: GradientStop[], t: number): [number, number, number, number] {
  if (stops.length === 0) return [0, 0, 0, 0];
  const tClamp = Math.max(0, Math.min(1, t));
  if (stops.length === 1) {
    const s = stops[0]!;
    return [s.r, s.g, s.b, s.a];
  }
  let i = 0;
  while (i + 1 < stops.length && stops[i + 1]!.t < tClamp) i++;
  const a = stops[i]!;
  const b = stops[i + 1];
  if (!b || a.t === b.t) return [a.r, a.g, a.b, a.a];
  const u = (tClamp - a.t) / (b.t - a.t);
  return [
    a.r + (b.r - a.r) * u,
    a.g + (b.g - a.g) * u,
    a.b + (b.b - a.b) * u,
    a.a + (b.a - a.a) * u,
  ];
}

/**
 * 仅半影环带色标：中心到 penumbraR0 全透明，penumbraR0～penumbraR1 为边缘色渐隐，用于轨迹动效中“只动半影”的层。
 * t 为径向比例（0=中心，1=半径末端）。
 */
export function buildPenumbraOnlyStops(params: HaloLightParams, geom: SpotGeometry): GradientStop[] {
  const edgeRgb = params.scene.edgeRgb ?? params.scene.lightRgb;
  const r0 = Math.max(0, Math.min(1, geom.penumbraR0));
  const r1 = Math.max(r0 + 0.01, Math.min(1, geom.penumbraR1));
  const mid = (r0 + r1) * 0.5;
  const q1 = (r0 + mid) * 0.5;
  const q2 = (mid + r1) * 0.5;
  const stops: GradientStop[] = [
    { t: 0, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0 },
    { t: r0, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0.88 },
    { t: q1, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0.65 },
    { t: mid, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0.4 },
    { t: q2, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0.18 },
    { t: r1, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0 },
    { t: 1, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0 },
  ];
  for (const s of stops) {
    s.t = Math.max(0, Math.min(1, s.t));
  }
  stops.sort((a, b) => a.t - b.t);
  return stops;
}

/**
 * 外圈光晕（bloom）
 */
export function buildBloomStops(params: HaloLightParams): GradientStop[] {
  const edgeRgb = params.scene.edgeRgb ?? params.scene.lightRgb;
  const bloom = params.scene.bloom ?? 0.5;
  const peak = 0.12 * bloom;
  return [
    { t: 0, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0 },
    { t: 0.25, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: peak * 0.25 },
    { t: 0.5, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: peak * 0.6 },
    { t: 0.75, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: peak * 0.85 },
    { t: 1, r: edgeRgb[0], g: edgeRgb[1], b: edgeRgb[2], a: 0 },
  ];
}

/**
 * 边缘半影遮罩：用于地平线/多环/扇形等非径向模式，使边缘与径向一样柔和扩散。
 * 返回白到透明的径向 alpha 遮罩（r=g=b=1），配合 destination-in 使用。
 */
export function buildEdgeFalloffStops(geom: SpotGeometry): GradientStop[] {
  const r0 = geom.penumbraR0;
  const r1 = geom.penumbraR1;
  const mid = (r0 + r1) * 0.5;
  return [
    { t: 0, r: 1, g: 1, b: 1, a: 1 },
    { t: Math.max(0, Math.min(1, r0 * 0.95)), r: 1, g: 1, b: 1, a: 1 },
    { t: Math.max(0, Math.min(1, r0)), r: 1, g: 1, b: 1, a: 0.98 },
    { t: Math.max(0, Math.min(1, mid)), r: 1, g: 1, b: 1, a: 0.5 },
    { t: Math.max(0, Math.min(1, r1)), r: 1, g: 1, b: 1, a: 0 },
    { t: 1, r: 1, g: 1, b: 1, a: 0 },
  ];
}

/**
 * 非径向模式下的色散环：在边缘半影处绘制一圈色散条纹（与径向模式一致的效果）。
 */
export function buildChromaticFringeRingStops(params: HaloLightParams, geom: SpotGeometry): GradientStop[] {
  const penumbraR1 = geom.penumbraR1;
  const chromaticFringe = params.edge.chromaticFringe;
  const fringeRgb = params.edge.chromaticFringeRgb ?? [0.4, 0.25, 0.6];
  const fringeSpread = 0.02 + 0.1 * chromaticFringe;
  const tInner = Math.max(0, penumbraR1 - fringeSpread);
  const tOuter = Math.min(1, penumbraR1 + fringeSpread);
  const tMid = (tInner + penumbraR1) * 0.5;
  const alphaPeak = 0.1 + 0.22 * chromaticFringe;
  const alphaInner = 0.02 + 0.06 * chromaticFringe;
  const stops: GradientStop[] = [
    { t: 0, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: 0 },
    { t: Math.max(0, tInner - 0.01), r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: 0 },
    { t: tInner, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: alphaInner },
    { t: tMid, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: alphaPeak },
    { t: penumbraR1, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: alphaInner },
    { t: tOuter, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: 0 },
    { t: 1, r: fringeRgb[0], g: fringeRgb[1], b: fringeRgb[2], a: 0 },
  ];
  for (const s of stops) {
    s.t = Math.max(0, Math.min(1, s.t));
  }
  stops.sort((a, b) => a.t - b.t);
  return stops;
}

/**
 * 双环/多环：同心环径向渐变色标
 */
export function buildMultiRingStops(params: HaloLightParams): GradientStop[] {
  const { numRings, ringColors, ringWidths, smoothness, ringBlend } = params.color.multiRing;
  const n = Math.min(numRings, ringColors.length, ringWidths.length);
  const stops: GradientStop[] = [];
  let t = 0;
  const smBase = smoothness * 0.15;
  const smMix = smBase + ringBlend * 0.22;
  const mixRgb = (a: [number, number, number], b: [number, number, number], k: number): [number, number, number] => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
  for (let i = 0; i < n; i++) {
    const w = ringWidths[i] ?? 1 / n;
    const c = ringColors[i] ?? [0.5, 0.3, 0.2];
    const tEnd = Math.min(1, t + w);
    if (i === 0) {
      stops.push({ t: 0, r: c[0], g: c[1], b: c[2], a: 1 });
      stops.push({ t: Math.min(tEnd - smMix, tEnd), r: c[0], g: c[1], b: c[2], a: 1 });
    } else {
      const prev = ringColors[i - 1] ?? c;
      // 环交界处：用更宽的混合带把两环颜色“揉”在一起
      const tL = Math.max(0, t - smMix);
      const tR = Math.min(1, t + smMix);
      const mid = mixRgb(prev as [number, number, number], c as [number, number, number], 0.5);
      stops.push({ t: tL, r: prev[0], g: prev[1], b: prev[2], a: 1 });
      stops.push({ t, r: mid[0], g: mid[1], b: mid[2], a: 1 });
      stops.push({ t: tR, r: c[0], g: c[1], b: c[2], a: 1 });
      if (tEnd - tR > 0.001) {
        stops.push({ t: tEnd - smBase, r: c[0], g: c[1], b: c[2], a: 1 });
      }
    }
    t = tEnd;
    if (t >= 1) break;
  }
  stops.push({ t: 1, r: ringColors[n - 1]?.[0] ?? 0.2, g: ringColors[n - 1]?.[1] ?? 0.1, b: ringColors[n - 1]?.[2] ?? 0.1, a: 0 });
  for (const s of stops) {
    s.t = Math.max(0, Math.min(1, s.t));
  }
  stops.sort((a, b) => a.t - b.t);
  return stops;
}
