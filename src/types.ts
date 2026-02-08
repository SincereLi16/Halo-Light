export type GradientMode = "radial" | "horizon" | "multiRing" | "sector";

/** 地平线：渐变颜色（2~4 个）、地平线位置、过渡柔和度、倾斜 */
export interface HorizonParams {
  /** 渐变颜色，最多 4 个；numColors=2 用 [0],[1]，3 用 [0][1][2]，4 用全部 */
  colors: [number, number, number][];
  numColors: number;  // 2 | 3 | 4
  horizonY: number;   // 0~1，0=顶 1=底，0.5=中间
  softness: number;   // 0~1，过渡带宽度
  tilt: number;       // -1~1，地平线倾斜
}

/** 双环/多环：同心环 */
export interface MultiRingParams {
  numRings: number;   // 3~5
  ringColors: [number, number, number][]; // 从内到外
  ringWidths: number[]; // 每环宽度占比，和 1
  smoothness: number;  // 0~1，环间过渡
  /** 环与环之间的颜色混合强度（越大越“糊”越真实） */
  ringBlend: number;   // 0~1
}

/** 扇形：按角度分色 */
export interface SectorParams {
  numSectors: number; // 3~6
  sectorColors: [number, number, number][];
  centerRgb: [number, number, number];
  radialBlend: number; // 0~1，中心到边缘的径向混合
}

/** 彩虹模式参数（Three.js Shader 使用） */
export interface RainbowParams {
  /** 是否启用彩虹模式（同时切换到 three.js 渲染） */
  enabled: boolean;
  /** 整体透明度：0 完全看不见泡泡，1 正常亮度 */
  opacity: number;
  /** 径向渐变强度：0 非常匀，1 外缘更亮更聚焦 */
  radialGradient: number;
  /** 领域扭曲强度：0 无扭曲，1 非常流动 */
  warpStrength: number;
  /** 流动速度：0 静止，1 很快 */
  flowSpeed: number;
  /** 色彩饱和度：0 去色，1 默认，高于 1 可超饱和 */
  saturation: number;
  /** 薄膜最小厚度（归一化 0~1，用于映射到物理 nm） */
  thicknessMin: number;
  /** 薄膜最大厚度（归一化 0~1，用于映射到物理 nm） */
  thicknessMax: number;
}

/** 夕阳灯全部可调参数 */
export interface HaloLightParams {
  spot: {
    beamAngle: number;
    /** 射灯偏移：0=最下方，0.5=中心，1=最上方 */
    hotspotOffset: number;
  };
  color: {
    gradientMode: GradientMode;
    transitionCurve: number;
    horizon: HorizonParams;
    multiRing: MultiRingParams;
    sector: SectorParams;
  };
  edge: {
    penumbraWidth: number;
    /** 色散开关，开启后才绘制色散条纹，滑块控制粗细与明暗 */
    chromaticFringeEnabled: boolean;
    chromaticFringe: number;
    chromaticFringeRgb: [number, number, number];
    /** 呼吸：半影区形变动效，勾选后展开形变强度/速度 */
    breathingEnabled: boolean;
    wobbleAmount: number;
    wobbleSpeed: number;
    /** 轨迹：半影圆心沿内光环圆周顺时针运动，勾选后展开直径/边缘硬度/运动速度/拖影 */
    trajectoryEnabled: boolean;
    /** 轨迹直径：运动圆周的半径占光斑半径的比例（建议 0.1～0.2） */
    trajectoryDiameter: number;
    /** 轨迹半影边缘柔软度，值越大边缘越软 */
    trajectoryEdgeHardness: number;
    trajectorySpeed: number;
    trajectoryTrail: number;
    /** 轨迹圆颜色（默认橙色），用于绘制运动中的半影环 */
    trajectoryRgb: [number, number, number];
  };
  scene: {
    wallTint: [number, number, number];
    lightRgb: [number, number, number];
    edgeRgb: [number, number, number];
    bloom: number;
    /** 边缘柔焦开关，开启后才出现柔焦滑块 */
    softBlurEnabled: boolean;
    softBlur: number;
    /** 整体朦胧感（0 清晰，1 非常柔雾） */
    haze: number;
    /** 动光：圆周内随机移动的小点光源开关 */
    movingLightEnabled: boolean;
    /** 动光亮度（0 关闭，1 最亮） */
    movingLightIntensity: number;
    /** 动光扩散半径（占主光斑半径比例） */
    movingLightSpread: number;
    /** 动光动态变化强度（0 较平，1 局部对比极强） */
    movingLightDynamic: number;
    /** 动光运动范围（0 小范围清晰，1 大范围模糊） */
    movingLightRange: number;
    /** 动光不规则形状开关（开启后轮廓由多锚点与噪点共同塑造） */
    movingLightIrregular: boolean;
  };
}

/** 径向渐变的一个色标，t 为 0~1 径向位置 */
export interface GradientStop {
  t: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 几何结果：用于绘制的半径与椭圆比例 */
export interface SpotGeometry {
  radius: number;       // 主光斑半径（像素或逻辑单位）
  scaleX: number;       // 1 = 正圆
  scaleY: number;
  penumbraR0: number;   // 半影起始（占 radius 比例）
  penumbraR1: number;  // 半影结束（占 radius 比例，>1 表示超出主半径）
  /** 射灯模式：亮心偏移（占 radius 比例），负=上移，形成上收束下扩散 */
  hotspotOffsetY: number;
}
