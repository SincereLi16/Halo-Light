import type { HaloLightParams } from "./types";
import type { SpotGeometry } from "./types";

const BEAM_ANGLE_RAD = (Math.PI / 180);
const HOTSPOT_OFFSET_K = 0.4; // 射灯偏移 ±1 时亮心偏移 40% 半径

/**
 * 根据画布尺寸与束角，计算光斑半径（像素）。仅束角控制光圈大小。
 */
export function getSpotRadiusPx(
  params: HaloLightParams,
  canvasWidth: number,
  canvasHeight: number
): number {
  const angleDeg = params.spot.beamAngle;
  const tan = Math.tan(angleDeg * BEAM_ANGLE_RAD);
  const short = Math.min(canvasWidth, canvasHeight);
  return (short * 0.45 * tan) / (1 + tan * 0.5);
}

/**
 * 射灯亮心偏移：0=最下，0.5=中心，1=最上。
 * 输出 hotspotOffsetY：画布 Y 方向偏移（正=下，负=上），单位与半径同量纲。
 */
export function getEllipseScale(hotspotOffset: number): {
  scaleX: number;
  scaleY: number;
  hotspotOffsetY: number;
} {
  const scaleY = 1;
  const t = Math.max(0, Math.min(1, hotspotOffset ?? 0.5));
  // t 0→1 对应 下→上，画布 Y 正=下，故 oy = (0.5 - t) * 2 * K（t=0 时 oy 正，t=1 时 oy 负）
  const hotspotOffsetY = (0.5 - t) * 2 * HOTSPOT_OFFSET_K;
  return { scaleX: 1, scaleY, hotspotOffsetY };
}

/**
 * 半影：主光结束位置 r0（占半径比例），全黑位置 r1。
 * penumbraWidth 大 → r0~r1 距离大，边缘更柔。
 * r0、r1 必须在 [0,1]，供 Canvas 径向渐变 addColorStop 使用。
 */
export function getPenumbraR0R1(penumbraWidth: number): { r0: number; r1: number } {
  const r0 = 0.65;
  const spread = 0.15 + 0.35 * penumbraWidth;
  const r1 = Math.min(1, r0 + spread);
  return { r0, r1 };
}

export function getSpotGeometry(
  params: HaloLightParams,
  canvasWidth: number,
  canvasHeight: number
): SpotGeometry {
  const radius = getSpotRadiusPx(params, canvasWidth, canvasHeight);
  const { scaleX, scaleY, hotspotOffsetY } = getEllipseScale(params.spot.hotspotOffset ?? 0.5);
  const { r0, r1 } = getPenumbraR0R1(params.edge.penumbraWidth);
  return {
    radius,
    scaleX,
    scaleY,
    penumbraR0: r0,
    penumbraR1: r1,
    hotspotOffsetY,
  };
}
