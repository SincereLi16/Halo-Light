import type { HaloLightParams } from "./types";
import { kelvinToRgb, wavelengthToRgb } from "./colorUtils";

const DEFAULT_LIGHT_RGB: [number, number, number] = kelvinToRgb(3000);
const DEFAULT_EDGE_RGB: [number, number, number] = wavelengthToRgb(630);
const HORIZON_TOP: [number, number, number] = [0.95, 0.5, 0.2];
const HORIZON_BOTTOM: [number, number, number] = [0.15, 0.08, 0.2];
function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
const HORIZON_COLORS: [number, number, number][] = [
  HORIZON_TOP,
  HORIZON_BOTTOM,
  lerpRgb(HORIZON_TOP, HORIZON_BOTTOM, 0.5),
  lerpRgb(HORIZON_TOP, HORIZON_BOTTOM, 0.75),
];
const RING_COLORS: [number, number, number][] = [
  [0.95, 0.55, 0.2],
  [0.75, 0.3, 0.15],
  [0.45, 0.2, 0.18],
  [0.25, 0.12, 0.15],
  [0.12, 0.06, 0.08],
];
const SECTOR_COLORS: [number, number, number][] = [
  [0.9, 0.4, 0.15],
  [0.95, 0.5, 0.25],
  [0.85, 0.35, 0.2],
  [0.7, 0.28, 0.18],
  [0.5, 0.2, 0.15],
  [0.35, 0.15, 0.12],
];

function clampRgb(v: [number, number, number]): [number, number, number] {
  return [
    Math.max(0, Math.min(1, v[0])),
    Math.max(0, Math.min(1, v[1])),
    Math.max(0, Math.min(1, v[2])),
  ];
}

function normalizeRingWidths(widths: number[], n: number = 3): number[] {
  const w = widths.slice(0, n);
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return Array(n).fill(1 / n);
  return w.map((v) => v / sum);
}

export const DEFAULT_PARAMS: HaloLightParams = {
  spot: {
    beamAngle: 30,
    hotspotOffset: 0.5,
  },
  color: {
    gradientMode: "radial",
    transitionCurve: 0.5,
    horizon: {
      colors: HORIZON_COLORS.map((c) => [...c] as [number, number, number]),
      numColors: 2,
      horizonY: 0.5,
      softness: 0.35,
      tilt: 0,
    },
    multiRing: {
      numRings: 3,
      ringColors: RING_COLORS.slice(0, 5).map((c) => [...c] as [number, number, number]),
      ringWidths: [0.35, 0.35, 0.3, 0.2, 0.2],
      smoothness: 0.4,
      ringBlend: 0.35,
    },
    sector: {
      numSectors: 4,
      sectorColors: SECTOR_COLORS.slice(0, 6).map((c) => [...c] as [number, number, number]),
      centerRgb: [...DEFAULT_LIGHT_RGB],
      radialBlend: 0.5,
    },
  },
  edge: {
    penumbraWidth: 0.4,
    chromaticFringeEnabled: false,
    chromaticFringe: 0.3,
    chromaticFringeRgb: [0.4, 0.25, 0.6],
    breathingEnabled: false,
    wobbleAmount: 0.03,
    wobbleSpeed: 0.4,
    trajectoryEnabled: false,
    trajectoryDiameter: 0.15,
    trajectoryEdgeHardness: 0.3,
    trajectorySpeed: 0.4,
    trajectoryTrail: 0.3,
    trajectoryRgb: [1, 0.5, 0.2],
  },
  scene: {
    wallTint: [0.08, 0.06, 0.05],
    lightRgb: [...DEFAULT_LIGHT_RGB],
    edgeRgb: [...DEFAULT_EDGE_RGB],
    bloom: 0.5,
    softBlurEnabled: false,
    softBlur: 0.35,
    haze: 0,
    movingLightEnabled: false,
    movingLightIntensity: 0.6,
    movingLightSpread: 0.25,
    movingLightDynamic: 0.5,
    movingLightRange: 0.5,
    movingLightIrregular: false,
  },
};

export function clampParams(p: HaloLightParams): HaloLightParams {
  return {
    spot: (() => {
      const sp = p.spot as Record<string, unknown>;
      let t = Number(sp.hotspotOffset ?? 0.5);
      // 仅当存在旧字段 distortionHotspotOffset 时才做 -1~1 → 0~1 的迁移，否则直接使用 hotspotOffset（0~1）
      if (sp.distortionHotspotOffset !== undefined) {
        const old = Number(sp.distortionHotspotOffset);
        t = old <= -1 ? 0 : old >= 1 ? 1 : 0.5 - old * 0.5;
      }
      return {
        beamAngle: Math.max(15, Math.min(45, p.spot.beamAngle)),
        hotspotOffset: Math.max(0, Math.min(1, t)),
      };
    })(),
    color: {
      gradientMode: (() => {
        const m = p.color.gradientMode;
        return m === "radial" || m === "horizon" || m === "multiRing" || m === "sector" ? m : "radial";
      })(),
      transitionCurve: Math.max(0, Math.min(1, p.color.transitionCurve ?? 0.5)),
      horizon: (() => {
        const h = p.color.horizon;
        let colors = (h?.colors ?? []).slice(0, 4).map(clampRgb) as [number, number, number][];
        if (colors.length < 2 && (h?.topRgb || h?.bottomRgb)) {
          colors = [clampRgb(h.topRgb ?? HORIZON_TOP), clampRgb(h.bottomRgb ?? HORIZON_BOTTOM)];
        }
        while (colors.length < 4) colors.push([...HORIZON_COLORS[colors.length]!]);
        const numColors = Math.max(2, Math.min(4, h?.numColors ?? 2));
        return {
          colors,
          numColors,
          horizonY: Math.max(0, Math.min(1, h?.horizonY ?? 0.5)),
          softness: Math.max(0, Math.min(1, h?.softness ?? 0.35)),
          tilt: Math.max(-1, Math.min(1, h?.tilt ?? 0)),
        };
      })(),
      multiRing: (() => {
        const numRings = Math.max(3, Math.min(5, p.color.multiRing?.numRings ?? 3));
        let widths = p.color.multiRing?.ringWidths ?? [0.35, 0.35, 0.3, 0.2, 0.2];
        widths = widths.slice(0, 5);
        while (widths.length < numRings) widths.push(1 / numRings);
        return {
          numRings,
          ringColors: (p.color.multiRing?.ringColors ?? RING_COLORS).slice(0, 5).map(clampRgb) as [number, number, number][],
          ringWidths: normalizeRingWidths(widths, numRings),
          smoothness: Math.max(0, Math.min(1, p.color.multiRing?.smoothness ?? 0.4)),
          ringBlend: Math.max(0, Math.min(1, p.color.multiRing?.ringBlend ?? 0.35)),
        };
      })(),
      sector: {
        numSectors: Math.max(3, Math.min(6, p.color.sector?.numSectors ?? 4)),
        sectorColors: (p.color.sector?.sectorColors ?? SECTOR_COLORS).slice(0, 6).map(clampRgb) as [number, number, number][],
        centerRgb: clampRgb(p.color.sector?.centerRgb ?? DEFAULT_LIGHT_RGB),
        radialBlend: Math.max(0, Math.min(1, p.color.sector?.radialBlend ?? 0.5)),
      },
    },
    edge: {
      penumbraWidth: Math.max(0, Math.min(1, p.edge.penumbraWidth)),
      chromaticFringeEnabled: Boolean(p.edge.chromaticFringeEnabled),
      chromaticFringe: Math.max(0.01, Math.min(1, p.edge.chromaticFringe ?? 0.3)),
      chromaticFringeRgb: clampRgb(p.edge.chromaticFringeRgb ?? [0.4, 0.25, 0.6]),
      breathingEnabled: Boolean(p.edge.breathingEnabled),
      wobbleAmount: Math.max(0, Math.min(0.06, p.edge.wobbleAmount ?? 0.03)),
      wobbleSpeed: Math.max(0, Math.min(0.6, p.edge.wobbleSpeed ?? 0.4)),
      trajectoryEnabled: Boolean(p.edge.trajectoryEnabled),
      trajectoryDiameter: Math.max(0.1, Math.min(0.2, p.edge.trajectoryDiameter ?? 0.15)),
      trajectoryEdgeHardness: Math.max(0, Math.min(1, p.edge.trajectoryEdgeHardness ?? 0.3)),
      trajectorySpeed: Math.max(0, Math.min(1, p.edge.trajectorySpeed ?? 0.4)),
      trajectoryTrail: Math.max(0, Math.min(1, p.edge.trajectoryTrail ?? 0.3)),
      trajectoryRgb: clampRgb(p.edge.trajectoryRgb ?? [1, 0.5, 0.2]),
    },
    scene: {
      wallTint: clampRgb(p.scene.wallTint),
      lightRgb: clampRgb(p.scene.lightRgb ?? DEFAULT_LIGHT_RGB),
      edgeRgb: clampRgb(p.scene.edgeRgb ?? DEFAULT_EDGE_RGB),
      bloom: Math.max(0, Math.min(1, p.scene.bloom ?? 0.5)),
      softBlurEnabled: Boolean(p.scene.softBlurEnabled),
      softBlur: Math.max(0.01, Math.min(1, p.scene.softBlur ?? 0.35)),
      haze: Math.max(0, Math.min(1, p.scene.haze ?? 0)),
      movingLightEnabled: Boolean(p.scene.movingLightEnabled),
      movingLightIntensity: Math.max(0, Math.min(1, p.scene.movingLightIntensity ?? 0.6)),
      movingLightSpread: Math.max(0, Math.min(1, p.scene.movingLightSpread ?? 0.25)),
      movingLightDynamic: Math.max(0, Math.min(1, p.scene.movingLightDynamic ?? 0.5)),
      movingLightRange: Math.max(0, Math.min(1, p.scene.movingLightRange ?? 0.5)),
      movingLightIrregular: Boolean(p.scene.movingLightIrregular),
    },
  };
}
