# 夕阳灯模拟器 — 设计文档（第一版）

## 1. 参数数据结构

所有用户可调参数统一放在一个 **参数对象** 中，便于序列化（后续预设/URL 分享）、类型约束与 UI 绑定。

### 1.1 光斑形态 `spot`

| 字段 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| `beamAngle` | number | 15 ~ 45 (度) | 30 | 束角，决定墙上光斑半径 |
| `distortion` | number | 0 ~ 1 | 0 | 畸变率，0=正圆，越大椭圆/斜投感越强 |
| `centerIntensity` | number | 0 ~ 1 | 1 | 中心光强，圆心最亮点强度 |

### 1.2 色彩渐变 `color`

| 字段 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| `hueShift` | number | 0 ~ 1 | 0.6 | 色相偏移度，中心→边缘的色相变化量（0=无偏移，1=全偏移到边缘色如 630nm 红） |
| `transitionCurve` | number | 0 ~ 1 | 0.5 | 色彩过渡梯度，0=中心突变、1=最平滑，可映射为幂指数或贝塞尔 |
| `spectralPurity` | number | 0 ~ 1 | 0.9 | 光谱纯度，1=通透，0=浑浊（混灰/降饱和） |

**预设色**（可写死或做成可选预设）：

- 中心：色温 3000K（暖白）
- 边缘：波长 630nm（深红）

### 1.3 边缘质感 `edge`

| 字段 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| `penumbraWidth` | number | 0 ~ 1 | 0.4 | 半影区宽度，0=锐利边缘，1=很宽柔和过渡 |
| `chromaticFringe` | number | 0 ~ 1 | 0.3 | 色散条纹强度，最外圈紫/蓝边 |
| `diffuseReflect` | number | 0 ~ 1 | 0.2 | 漫反射率，边缘二次扩散范围/强度 |

### 1.4 场景（可选，用于「投射到墙」）

| 字段 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| `projectionDistance` | number | 0.5 ~ 3 (相对) | 1 | 虚拟灯-墙距离，与束角一起算光斑半径 |
| `wallTint` | string / [r,g,b] | - | 略暗灰 | 墙面底色，光斑画在其上 |

---

## 2. 参数对象整体形状（TypeScript 友好）

```ts
interface HaloLightParams {
  spot: {
    beamAngle: number;      // 15..45
    distortion: number;     // 0..1
    centerIntensity: number; // 0..1
  };
  color: {
    hueShift: number;       // 0..1
    transitionCurve: number; // 0..1
    spectralPurity: number;  // 0..1
  };
  edge: {
    penumbraWidth: number;   // 0..1
    chromaticFringe: number; // 0..1
    diffuseReflect: number;  // 0..1
  };
  scene?: {
    projectionDistance: number;
    wallTint: [number, number, number];
  };
}
```

---

## 3. 参数 → 绘制 管线（数据流）

整体顺序：**参数 → 中间几何/颜色数据 → Canvas 绘制**。计算与绘制解耦，便于单测和以后换 WebGL。

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│  HaloLightParams │ ──► │ 中间表示（每帧/静态）     │ ──► │  Canvas 2D 绘制  │
└─────────────────┘     └──────────────────────────┘     └─────────────────┘
```

### 3.1 第一步：从参数算出「几何与强度」

- **光斑半径**  
  `radius = projectionDistance * tan(beamAngle * π/180)`，再按画布尺寸归一化或按像素定标。

- **椭圆形态**  
  由 `distortion` 得到长短轴比或 `scaleX/scaleY`（例如 `1` 与 `1 - k * distortion`，k 为常数），中心不变。

- **中心光强**  
  直接传给渐变：中心 alpha/亮度 = `centerIntensity`。

- **半影区宽度**  
  渐变最外圈：主光结束位置 `r0`，全黑位置 `r1 = r0 + penumbraWidth * R`（R 为最大半径或常数），中间线性或曲线过渡。

### 3.2 第二步：从参数算出「颜色」

- **中心色**  
  3000K → RGB（色温公式）。

- **边缘色**  
  按 `hueShift` 在「中心色」与「630nm 深红」之间插值得到边缘目标色；或直接 630nm→RGB，再用 `hueShift` 控制混合比例。

- **光谱纯度**  
  对中心色、边缘色分别：`rgb = lerp(rgb, gray, 1 - spectralPurity)` 或降饱和。

- **过渡梯度**  
  径向渐变不按线性 `t = r/radius`，而按 `t = curve(r/radius)`，`curve` 由 `transitionCurve` 控制（如 `t^power`，power 从 0.5～2）。

- **色散条纹**  
  在半径接近 `r1` 处增加 1～2 个色标：偏紫/蓝、低 alpha，强度由 `chromaticFringe` 控制。

### 3.3 第三步：漫反射层（可选）

- 用「同一圆心、更大半径、更低不透明度」再画一层径向渐变，半径与 alpha 由 `diffuseReflect` 控制，不单独 blur，以保证性能。

### 3.4 第四步：绘制顺序（画布上）

1. 清空或画「墙」：矩形 + `wallTint`（可选轻微纹理）。
2. 若启用漫反射：先画漫反射层（大而淡的圆/椭圆）。
3. 主光斑：椭圆径向渐变（含中心光强、半影、色散）。
4. 无需后处理 blur 即可得到第一版效果。

---

## 4. 模块划分建议

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **params** | 默认参数、校验、归一化 | - | `HaloLightParams` |
| **colorUtils** | 色温 K→RGB、波长 nm→RGB、插值、纯度 | 数值 | RGB/RGBA |
| **geometry** | 束角→半径、畸变→椭圆 | `params.spot`, `params.scene` | 半径、scaleX/Y、半影 r0/r1 |
| **gradient** | 生成径向渐变 stops（含过渡曲线、色散） | `params` + `geometry` + `colorUtils` | 色标数组 `{t, r, g, b, a}[]` |
| **render** | 在 Canvas 上画墙 + 漫反射层 + 主光斑 | `params`, `gradient` 结果, `ctx`, `canvas` | 无（副作用绘制） |
| **ui** | 滑块/控件绑定到 `params`，触发重绘 | 用户操作 | 更新 `params` 并通知渲染 |

依赖关系：  
`ui` → `params`；`render` → `gradient` → `geometry` + `colorUtils`；`gradient` → `params`。

---

## 5. 默认参数汇总（拷贝即用）

```ts
const DEFAULT_PARAMS: HaloLightParams = {
  spot: {
    beamAngle: 30,
    distortion: 0,
    centerIntensity: 1,
  },
  color: {
    hueShift: 0.6,
    transitionCurve: 0.5,
    spectralPurity: 0.9,
  },
  edge: {
    penumbraWidth: 0.4,
    chromaticFringe: 0.3,
    diffuseReflect: 0.2,
  },
  scene: {
    projectionDistance: 1,
    wallTint: [0.08, 0.06, 0.05],
  },
};
```

---

## 6. 后续可扩展

- 动态模式：在 `params` 上增加 `motion: { mode, speed }`，由动画循环每帧更新 `params` 再走同一套管线。
- 预设：保存/加载 `HaloLightParams` JSON；分享用 URL query 或 hash 编码。
- 多灯：多个 `HaloLightParams` + 各自圆心位置，按顺序绘制并做简单混合（如 alpha 叠加）。

文档版本：v1，静态单灯 + 投射墙面。  
若需调整参数名、范围或管线顺序，可在此文档上直接修改后再开工实现。
