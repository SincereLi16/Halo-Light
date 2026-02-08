import type { HaloLightParams } from "./types";

type ChangeCallback = (params: HaloLightParams) => void;

type PathPart = keyof HaloLightParams | number;

interface SliderSpec {
  key: string;
  path: PathPart[];
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}

/** RGB 0~1 转 #rrggbb */
function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255);
  return "#" + [toByte(r), toByte(g), toByte(b)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/** #rrggbb 转 RGB 0~1 */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function getRgbAtPath(obj: HaloLightParams, path: PathPart[]): [number, number, number] {
  let cur: unknown = obj;
  for (const p of path) {
    cur = typeof p === "number" ? (cur as number[])[p] : (cur as Record<string, unknown>)[p];
  }
  const arr = cur as [number, number, number];
  return [arr[0], arr[1], arr[2]];
}

function setRgbAtPath(obj: HaloLightParams, path: PathPart[], rgb: [number, number, number]): void {
  let cur: unknown = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]!;
    cur = typeof k === "number" ? (cur as number[])[k] : (cur as Record<string, unknown>)[k];
  }
  const lastKey = path[path.length - 1]!;
  const arr = (cur as Record<string, [number, number, number]>)[lastKey as string];
  if (!arr || !Array.isArray(arr)) return;
  arr[0] = Math.max(0, Math.min(1, rgb[0]));
  arr[1] = Math.max(0, Math.min(1, rgb[1]));
  arr[2] = Math.max(0, Math.min(1, rgb[2]));
}

const SLIDERS: SliderSpec[] = [
  { key: "beamAngle", path: ["spot", "beamAngle"], label: "束角", min: 15, max: 45, step: 1, format: (v) => `${v}°` },
  { key: "hotspotOffset", path: ["spot", "hotspotOffset"], label: "射灯偏移", min: 0, max: 1, step: 0.02 },
  { key: "transitionCurve", path: ["color", "transitionCurve"], label: "过渡梯度", min: 0, max: 1, step: 0.02 },
  { key: "horizonY", path: ["color", "horizon", "horizonY"], label: "地平线位置", min: 0, max: 1, step: 0.02 },
  { key: "softness", path: ["color", "horizon", "softness"], label: "过渡柔和度", min: 0, max: 1, step: 0.02 },
  { key: "tilt", path: ["color", "horizon", "tilt"], label: "倾斜", min: -1, max: 1, step: 0.05 },
  { key: "smoothness", path: ["color", "multiRing", "smoothness"], label: "环间过渡", min: 0, max: 1, step: 0.02 },
  { key: "ringBlend", path: ["color", "multiRing", "ringBlend"], label: "环间混合", min: 0, max: 1, step: 0.02 },
  { key: "radialBlend", path: ["color", "sector", "radialBlend"], label: "径向混合", min: 0, max: 1, step: 0.02 },
  { key: "penumbraWidth", path: ["edge", "penumbraWidth"], label: "半影区宽度", min: 0, max: 1, step: 0.02 },
  { key: "wobbleAmount", path: ["edge", "wobbleAmount"], label: "形变强度", min: 0, max: 0.06, step: 0.005 },
  { key: "wobbleSpeed", path: ["edge", "wobbleSpeed"], label: "形变速度", min: 0, max: 0.6, step: 0.02 },
  { key: "trajectoryDiameter", path: ["edge", "trajectoryDiameter"], label: "轨迹直径", min: 0.1, max: 0.2, step: 0.01 },
  { key: "trajectoryEdgeHardness", path: ["edge", "trajectoryEdgeHardness"], label: "边缘柔软", min: 0, max: 1, step: 0.02 },
  { key: "trajectorySpeed", path: ["edge", "trajectorySpeed"], label: "运动速度", min: 0, max: 1, step: 0.02 },
  { key: "trajectoryTrail", path: ["edge", "trajectoryTrail"], label: "拖影效果", min: 0, max: 1, step: 0.02 },
  { key: "chromaticFringe", path: ["edge", "chromaticFringe"], label: "强度", min: 0.01, max: 1, step: 0.01 },
  { key: "bloom", path: ["scene", "bloom"], label: "外圈光晕", min: 0, max: 1, step: 0.02 },
  { key: "haze", path: ["scene", "haze"], label: "朦胧感", min: 0, max: 1, step: 0.02 },
  { key: "softBlur", path: ["scene", "softBlur"], label: "边缘硬度", min: 0.01, max: 1, step: 0.02 },
  { key: "movingLightIntensity", path: ["scene", "movingLightIntensity"], label: "亮度", min: 0, max: 1, step: 0.02 },
  { key: "movingLightSpread", path: ["scene", "movingLightSpread"], label: "扩散", min: 0, max: 1, step: 0.02 },
  { key: "movingLightDynamic", path: ["scene", "movingLightDynamic"], label: "动态变化强度", min: 0, max: 1, step: 0.02 },
  { key: "movingLightRange", path: ["scene", "movingLightRange"], label: "运动范围", min: 0, max: 1, step: 0.02 },
];

interface ToggleSliderSpec {
  togglePath: PathPart[];
  toggleLabel: string;
  subSliderKey: string;
}

const TOGGLE_SLIDERS: ToggleSliderSpec[] = [
  { togglePath: ["edge", "chromaticFringeEnabled"], toggleLabel: "色散", subSliderKey: "chromaticFringe" },
];

/** 一个勾选展开多个滑块的项（如：呼吸 -> 形变强度、形变速度） */
interface ToggleMultiSliderSpec {
  key: string;
  togglePath: PathPart[];
  toggleLabel: string;
  subSliderKeys: string[];
  subColorKeys?: string[];
}

const TOGGLE_MULTI_SLIDERS: ToggleMultiSliderSpec[] = [
  { key: "breathing", togglePath: ["edge", "breathingEnabled"], toggleLabel: "呼吸", subSliderKeys: ["wobbleAmount", "wobbleSpeed", "softBlur"] },
  { key: "trajectory", togglePath: ["edge", "trajectoryEnabled"], toggleLabel: "轨迹", subSliderKeys: ["trajectoryDiameter", "trajectoryEdgeHardness", "trajectorySpeed", "trajectoryTrail"], subColorKeys: ["trajectoryRgb"] },
  { key: "movingLight", togglePath: ["scene", "movingLightEnabled"], toggleLabel: "动光", subSliderKeys: ["movingLightIntensity", "movingLightSpread", "movingLightDynamic", "movingLightRange"] },
];

interface ColorPickerSpec {
  key: string;
  path: PathPart[];
  label: string;
}

const COLOR_PICKERS: ColorPickerSpec[] = [
  { key: "lightRgb", path: ["scene", "lightRgb"], label: "中心颜色" },
  { key: "edgeRgb", path: ["scene", "edgeRgb"], label: "边缘颜色" },
  { key: "horizonColor0", path: ["color", "horizon", "colors", 0], label: "颜色1" },
  { key: "horizonColor1", path: ["color", "horizon", "colors", 1], label: "颜色2" },
  { key: "horizonColor2", path: ["color", "horizon", "colors", 2], label: "颜色3" },
  { key: "horizonColor3", path: ["color", "horizon", "colors", 3], label: "颜色4" },
  { key: "ringColor0", path: ["color", "multiRing", "ringColors", 0], label: "环1" },
  { key: "ringColor1", path: ["color", "multiRing", "ringColors", 1], label: "环2" },
  { key: "ringColor2", path: ["color", "multiRing", "ringColors", 2], label: "环3" },
  { key: "ringColor3", path: ["color", "multiRing", "ringColors", 3], label: "环4" },
  { key: "ringColor4", path: ["color", "multiRing", "ringColors", 4], label: "环5" },
  { key: "sectorCenterRgb", path: ["color", "sector", "centerRgb"], label: "中心颜色" },
  { key: "sectorColor0", path: ["color", "sector", "sectorColors", 0], label: "扇区1" },
  { key: "sectorColor1", path: ["color", "sector", "sectorColors", 1], label: "扇区2" },
  { key: "sectorColor2", path: ["color", "sector", "sectorColors", 2], label: "扇区3" },
  { key: "sectorColor3", path: ["color", "sector", "sectorColors", 3], label: "扇区4" },
  { key: "sectorColor4", path: ["color", "sector", "sectorColors", 4], label: "扇区5" },
  { key: "sectorColor5", path: ["color", "sector", "sectorColors", 5], label: "扇区6" },
  { key: "chromaticFringeRgb", path: ["edge", "chromaticFringeRgb"], label: "色散颜色" },
  { key: "trajectoryRgb", path: ["edge", "trajectoryRgb"], label: "轨迹颜色" },
];

function getAtPath(obj: HaloLightParams, path: PathPart[]): number {
  let cur: unknown = obj;
  for (const p of path) {
    if (typeof p === "number") cur = (cur as number[])[p];
    else cur = (cur as Record<string, unknown>)[p];
  }
  return cur as number;
}

function setAtPath(obj: HaloLightParams, path: PathPart[], value: number): void {
  let cur: unknown = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]!;
    cur = typeof k === "number" ? (cur as number[])[k] : (cur as Record<string, unknown>)[k];
  }
  (cur as Record<string | number, number>)[path[path.length - 1]!] = value;
}

function getBoolAtPath(obj: HaloLightParams, path: PathPart[]): boolean {
  let cur: unknown = obj;
  for (const p of path) {
    cur = typeof p === "number" ? (cur as number[])[p] : (cur as Record<string, unknown>)[p];
  }
  return Boolean(cur);
}

function setBoolAtPath(obj: HaloLightParams, path: PathPart[], value: boolean): void {
  let cur: unknown = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]!;
    cur = typeof k === "number" ? (cur as number[])[k] : (cur as Record<string, unknown>)[k];
  }
  (cur as Record<string, boolean>)[path[path.length - 1] as string] = value;
}

export interface CreatePanelOptions {
  onSavePreset?: () => void;
  onExportPresets?: () => void;
  onImportPresets?: (file: File) => void;
}

export function createPanel(
  container: HTMLElement,
  params: HaloLightParams,
  onChange: ChangeCallback,
  options?: CreatePanelOptions
): void {
  type GradientMode = import("./types").GradientMode;
  const MODE_LABELS: Record<GradientMode, string> = {
    radial: "径向",
    horizon: "地平线",
    multiRing: "多环",
    sector: "扇形",
  };
  const MODE_OPTIONS: GradientMode[] = ["radial", "horizon", "multiRing", "sector"];
  const modeSliderKeys: Record<GradientMode, string[]> = {
    radial: ["transitionCurve"],
    horizon: ["horizonY", "softness", "tilt"],
    multiRing: ["smoothness", "ringBlend"],
    sector: ["radialBlend"],
  };
  const modeColorKeys: Record<GradientMode, string[]> = {
    radial: ["lightRgb", "edgeRgb"],
    horizon: ["horizonColor0", "horizonColor1", "horizonColor2", "horizonColor3"],
    multiRing: ["ringColor0", "ringColor1", "ringColor2", "ringColor3", "ringColor4"],
    sector: ["sectorCenterRgb", "sectorColor0", "sectorColor1", "sectorColor2", "sectorColor3", "sectorColor4", "sectorColor5"],
  };

  function addSliderRow(parent: HTMLElement, spec: SliderSpec, onChangeCb: () => void): void {
    const row = document.createElement("div");
    row.className = "control-row";
    const label = document.createElement("label");
    label.textContent = spec.label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    const valueEl = document.createElement("span");
    valueEl.className = "value";
    const updateValue = () => {
      const v = Number(input.value);
      setAtPath(params, [...spec.path], v);
      valueEl.textContent = spec.format ? spec.format(v) : v.toFixed(2);
      onChangeCb(params);
    };
    input.value = String(getAtPath(params, spec.path));
    valueEl.textContent = spec.format ? spec.format(Number(input.value)) : Number(input.value).toFixed(2);
    input.addEventListener("input", updateValue);
    row.append(label, input, valueEl);
    parent.appendChild(row);
  }

  function addColorRow(parent: HTMLElement, spec: ColorPickerSpec, onChangeCb: () => void): void {
    const row = document.createElement("div");
    row.className = "control-row control-row-color";
    const label = document.createElement("label");
    label.textContent = spec.label;
    const input = document.createElement("input");
    input.type = "color";
    input.className = "color-picker";
    const rgb = getRgbAtPath(params, spec.path);
    input.value = rgbToHex(rgb[0], rgb[1], rgb[2]);
    input.addEventListener("input", () => {
      setRgbAtPath(params, spec.path, hexToRgb(input.value));
      onChangeCb(params);
    });
    row.append(label, input);
    parent.appendChild(row);
  }

  const refillColorPanel = (wrap: HTMLElement, mode: GradientMode) => fillColorModePanel(wrap, mode);

  function fillColorModePanel(wrap: HTMLElement, mode: GradientMode): void {
    wrap.innerHTML = "";
    const sliderKeys = modeSliderKeys[mode];
    const colorKeys = modeColorKeys[mode];
    let numColorLimit = 999;
    if (mode === "horizon") numColorLimit = Math.min(4, Math.max(2, getAtPath(params, ["color", "horizon", "numColors"]) as number));
    if (mode === "multiRing") numColorLimit = Math.min(5, Math.max(3, getAtPath(params, ["color", "multiRing", "numRings"]) as number));
    if (mode === "sector") numColorLimit = Math.min(6, Math.max(3, getAtPath(params, ["color", "sector", "numSectors"]) as number));

    for (const key of sliderKeys) {
      const spec = SLIDERS.find((s) => s.key === key);
      if (!spec) continue;
      addSliderRow(wrap, spec, onChange);
    }

    // 地平线：用 +/− 按钮增减颜色（替代“颜色数”滑条）
    if (mode === "horizon") {
      const n = Math.min(4, Math.max(2, getAtPath(params, ["color", "horizon", "numColors"]) as number));
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "control-row control-row-color";
        const label = document.createElement("label");
        label.textContent = `颜色${i + 1}`;
        const input = document.createElement("input");
        input.type = "color";
        input.className = "color-picker";
        const path: PathPart[] = ["color", "horizon", "colors", i];
        const rgb = getRgbAtPath(params, path);
        input.value = rgbToHex(rgb[0], rgb[1], rgb[2]);
        input.addEventListener("input", () => {
          setRgbAtPath(params, path, hexToRgb(input.value));
          onChange(params);
        });
        row.append(label, input);

        if (n > 2) {
          const minusBtn = document.createElement("button");
          minusBtn.type = "button";
          minusBtn.textContent = "−";
          minusBtn.addEventListener("click", () => {
            const curN = Math.min(4, Math.max(2, getAtPath(params, ["color", "horizon", "numColors"]) as number));
            if (curN <= 2) return;
            for (let k = i; k < curN - 1; k++) {
              const src = params.color.horizon.colors[k + 1] ?? params.color.horizon.colors[k]!;
              params.color.horizon.colors[k] = [...src] as [number, number, number];
            }
            setAtPath(params, ["color", "horizon", "numColors"], curN - 1);
            onChange(params);
            refillColorPanel(wrap, mode);
          });
          row.appendChild(minusBtn);
        }
        wrap.appendChild(row);
      }

      const btnRow = document.createElement("div");
      btnRow.className = "control-row";
      const spacer = document.createElement("label");
      spacer.textContent = "增加颜色";
      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.textContent = "+";
      const curN = Math.min(4, Math.max(2, getAtPath(params, ["color", "horizon", "numColors"]) as number));
      plusBtn.disabled = curN >= 4;
      plusBtn.addEventListener("click", () => {
        const n0 = Math.min(4, Math.max(2, getAtPath(params, ["color", "horizon", "numColors"]) as number));
        if (n0 >= 4) return;
        const last = params.color.horizon.colors[n0 - 1] ?? params.color.horizon.colors[0] ?? [0.5, 0.3, 0.2];
        params.color.horizon.colors[n0] = [...last] as [number, number, number];
        setAtPath(params, ["color", "horizon", "numColors"], n0 + 1);
        onChange(params);
        refillColorPanel(wrap, mode);
      });
      btnRow.append(spacer, plusBtn);
      wrap.appendChild(btnRow);
      return;
    }

    // 双环/多环：环数用 +/− 控制，颜色跟随环数显示
    if (mode === "multiRing") {
      const n = Math.min(5, Math.max(3, getAtPath(params, ["color", "multiRing", "numRings"]) as number));
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "control-row control-row-color";
        const label = document.createElement("label");
        label.textContent = `环${i + 1}`;
        const input = document.createElement("input");
        input.type = "color";
        input.className = "color-picker";
        const path: PathPart[] = ["color", "multiRing", "ringColors", i];
        const rgb = getRgbAtPath(params, path);
        input.value = rgbToHex(rgb[0], rgb[1], rgb[2]);
        input.addEventListener("input", () => {
          setRgbAtPath(params, path, hexToRgb(input.value));
          onChange(params);
        });
        row.append(label, input);

        if (n > 3 && i === n - 1) {
          const minusBtn = document.createElement("button");
          minusBtn.type = "button";
          minusBtn.textContent = "−";
          minusBtn.addEventListener("click", () => {
            const curN = Math.min(5, Math.max(3, getAtPath(params, ["color", "multiRing", "numRings"]) as number));
            if (curN <= 3) return;
            setAtPath(params, ["color", "multiRing", "numRings"], curN - 1);
            onChange(params);
            refillColorPanel(wrap, mode);
          });
          row.appendChild(minusBtn);
        }
        wrap.appendChild(row);
      }

      const btnRow = document.createElement("div");
      btnRow.className = "control-row";
      const spacer = document.createElement("label");
      spacer.textContent = "环数";
      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.textContent = "+";
      const curN = Math.min(5, Math.max(3, getAtPath(params, ["color", "multiRing", "numRings"]) as number));
      plusBtn.disabled = curN >= 5;
      plusBtn.addEventListener("click", () => {
        const n0 = Math.min(5, Math.max(3, getAtPath(params, ["color", "multiRing", "numRings"]) as number));
        if (n0 >= 5) return;
        const last = params.color.multiRing.ringColors[n0 - 1] ?? params.color.multiRing.ringColors[0] ?? [0.5, 0.3, 0.2];
        params.color.multiRing.ringColors[n0] = [...last] as [number, number, number];
        setAtPath(params, ["color", "multiRing", "numRings"], n0 + 1);
        onChange(params);
        refillColorPanel(wrap, mode);
      });
      btnRow.append(spacer, plusBtn);
      wrap.appendChild(btnRow);
      return;
    }

    // 扇形：扇区数用 +/− 控制，颜色跟随扇区数显示
    if (mode === "sector") {
      const n = Math.min(6, Math.max(3, getAtPath(params, ["color", "sector", "numSectors"]) as number));
      for (let i = 0; i < n; i++) {
        const row = document.createElement("div");
        row.className = "control-row control-row-color";
        const label = document.createElement("label");
        label.textContent = `扇区${i + 1}`;
        const input = document.createElement("input");
        input.type = "color";
        input.className = "color-picker";
        const path: PathPart[] = ["color", "sector", "sectorColors", i];
        const rgb = getRgbAtPath(params, path);
        input.value = rgbToHex(rgb[0], rgb[1], rgb[2]);
        input.addEventListener("input", () => {
          setRgbAtPath(params, path, hexToRgb(input.value));
          onChange(params);
        });
        row.append(label, input);

        if (n > 3 && i === n - 1) {
          const minusBtn = document.createElement("button");
          minusBtn.type = "button";
          minusBtn.textContent = "−";
          minusBtn.addEventListener("click", () => {
            const curN = Math.min(6, Math.max(3, getAtPath(params, ["color", "sector", "numSectors"]) as number));
            if (curN <= 3) return;
            setAtPath(params, ["color", "sector", "numSectors"], curN - 1);
            onChange(params);
            refillColorPanel(wrap, mode);
          });
          row.appendChild(minusBtn);
        }
        wrap.appendChild(row);
      }

      const btnRow = document.createElement("div");
      btnRow.className = "control-row";
      const spacer = document.createElement("label");
      spacer.textContent = "扇区数";
      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.textContent = "+";
      const curN = Math.min(6, Math.max(3, getAtPath(params, ["color", "sector", "numSectors"]) as number));
      plusBtn.disabled = curN >= 6;
      plusBtn.addEventListener("click", () => {
        const n0 = Math.min(6, Math.max(3, getAtPath(params, ["color", "sector", "numSectors"]) as number));
        if (n0 >= 6) return;
        const last = params.color.sector.sectorColors[n0 - 1] ?? params.color.sector.sectorColors[0] ?? [0.9, 0.4, 0.15];
        params.color.sector.sectorColors[n0] = [...last] as [number, number, number];
        setAtPath(params, ["color", "sector", "numSectors"], n0 + 1);
        onChange(params);
        refillColorPanel(wrap, mode);
      });
      btnRow.append(spacer, plusBtn);
      wrap.appendChild(btnRow);
      return;
    }
    for (const key of colorKeys) {
      let show = true;
      if (mode === "horizon" && key.startsWith("horizonColor")) {
        const idx = parseInt(key.replace("horizonColor", ""), 10);
        show = idx < numColorLimit;
      } else if (mode === "multiRing" && key.startsWith("ringColor")) {
        const idx = parseInt(key.replace("ringColor", ""), 10);
        show = idx < numColorLimit;
      } else if (mode === "sector") {
        if (key === "sectorCenterRgb") show = true;
        else if (key.startsWith("sectorColor")) {
          const idx = parseInt(key.replace("sectorColor", ""), 10);
          show = idx < numColorLimit;
        }
      }
      if (!show) continue;
      const spec = COLOR_PICKERS.find((c) => c.key === key);
      if (spec) addColorRow(wrap, spec, onChange);
    }
  }

  // 顶部标题
  const titleEl = document.createElement("div");
  titleEl.className = "panel-title";
  titleEl.textContent = "YUI LIGHT";
  container.appendChild(titleEl);

  // 1. 色彩渐变（最上方）
  const colorGroup = document.createElement("div");
  colorGroup.className = "control-group";
  colorGroup.innerHTML = "<h3>色彩渐变</h3>";
  const modeRow = document.createElement("div");
  modeRow.className = "control-row";
  const modeLabel = document.createElement("label");
  modeLabel.textContent = "渐变类型";
  const modeSelect = document.createElement("select");
  modeSelect.className = "gradient-mode-select";
  for (const m of MODE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = MODE_LABELS[m];
    if ((params.color.gradientMode ?? "radial") === m) opt.selected = true;
    modeSelect.appendChild(opt);
  }
  modeRow.append(modeLabel, modeSelect);
  colorGroup.appendChild(modeRow);

  const colorModeWrap = document.createElement("div");
  colorModeWrap.className = "color-mode-params";
  fillColorModePanel(colorModeWrap, (params.color.gradientMode ?? "radial") as GradientMode);
  colorGroup.appendChild(colorModeWrap);

  modeSelect.addEventListener("change", () => {
    (params.color as { gradientMode: GradientMode }).gradientMode = modeSelect.value as GradientMode;
    fillColorModePanel(colorModeWrap, modeSelect.value as GradientMode);
    onChange(params);
  });

  // 2. 其他分组：光斑形态、色彩渐变、边缘质感、场景、动态光效
  const groups: Record<
    string,
    { title: string; sliderKeys: string[]; colorKeys: string[]; toggleSliderKeys?: string[]; toggleMultiSliderKeys?: string[] }
  > = {
    spot: { title: "光斑形态", sliderKeys: ["beamAngle", "hotspotOffset"], colorKeys: [] },
    color: { title: "色彩渐变", sliderKeys: ["transitionCurve"], colorKeys: ["lightRgb", "edgeRgb"], toggleSliderKeys: [], toggleMultiSliderKeys: [] },
    edge: { title: "边缘质感", sliderKeys: ["penumbraWidth"], colorKeys: ["chromaticFringeRgb"], toggleSliderKeys: ["chromaticFringe"], toggleMultiSliderKeys: [] },
    scene: { title: "场景", sliderKeys: ["bloom", "haze"], colorKeys: [], toggleSliderKeys: [], toggleMultiSliderKeys: [] },
    dynamics: { title: "动态光效", sliderKeys: [], colorKeys: [], toggleSliderKeys: [], toggleMultiSliderKeys: ["breathing", "trajectory", "movingLight"] },
  };

  let edgeChromaticFringeInput: HTMLInputElement | null = null;
  let edgeChromaticFringeSliderWrap: HTMLElement | null = null;
  let edgeChromaticFringeColorRow: HTMLElement | null = null;
  const dynamicsToggles: Record<string, { input: HTMLInputElement; wrap: HTMLElement }> = {};

  for (const [groupKey, { title, sliderKeys, colorKeys, toggleSliderKeys, toggleMultiSliderKeys }] of Object.entries(groups)) {
    const groupEl = document.createElement("div");
    groupEl.className = "control-group";
    groupEl.innerHTML = `<h3>${title}</h3>`;

    // 特殊处理 color 分组：使用已有的色彩渐变 UI，而不是通用 slider/color 构建
    if (groupKey === "color") {
      const colorGroup = document.createElement("div");
      colorGroup.className = "control-group";
      colorGroup.innerHTML = "<h3>色彩渐变</h3>";
      const modeRow = document.createElement("div");
      modeRow.className = "control-row";
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "渐变类型";
      const modeSelect = document.createElement("select");
      modeSelect.className = "gradient-mode-select";
      for (const m of MODE_OPTIONS) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = MODE_LABELS[m];
        if ((params.color.gradientMode ?? "radial") === m) opt.selected = true;
        modeSelect.appendChild(opt);
      }
      modeRow.append(modeLabel, modeSelect);
      colorGroup.appendChild(modeRow);

      const colorModeWrap = document.createElement("div");
      colorModeWrap.className = "color-mode-params";
      fillColorModePanel(colorModeWrap, (params.color.gradientMode ?? "radial") as GradientMode);
      colorGroup.appendChild(colorModeWrap);

      modeSelect.addEventListener("change", () => {
        (params.color as { gradientMode: GradientMode }).gradientMode = modeSelect.value as GradientMode;
        fillColorModePanel(colorModeWrap, modeSelect.value as GradientMode);
        onChange(params);
      });

      container.appendChild(colorGroup);
      continue;
    }

    for (const key of sliderKeys) {
      const spec = SLIDERS.find((s) => s.key === key);
      if (!spec) continue;
      const row = document.createElement("div");
      row.className = "control-row";
      const label = document.createElement("label");
      label.textContent = spec.label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      const valueEl = document.createElement("span");
      valueEl.className = "value";

      const updateValue = () => {
        const v = Number(input.value);
        setAtPath(params, [...spec.path], v);
        valueEl.textContent = spec.format ? spec.format(v) : v.toFixed(2);
        onChange(params);
      };

      input.value = String(getAtPath(params, spec.path));
      valueEl.textContent = spec.format ? spec.format(Number(input.value)) : Number(input.value).toFixed(2);
      input.addEventListener("input", updateValue);

      row.append(label, input, valueEl);
      groupEl.appendChild(row);
    }

    for (const subKey of toggleSliderKeys ?? []) {
      const toggleSpec = TOGGLE_SLIDERS.find((t) => t.subSliderKey === subKey);
      if (!toggleSpec) continue;
      const subSpec = SLIDERS.find((s) => s.key === subKey);
      if (!subSpec) continue;

      const toggleRow = document.createElement("div");
      toggleRow.className = "control-row control-row-toggle";
      const toggleLabel = document.createElement("label");
      toggleLabel.textContent = toggleSpec.toggleLabel;
      const toggleInput = document.createElement("input");
      toggleInput.type = "checkbox";
      toggleInput.checked = getBoolAtPath(params, toggleSpec.togglePath);
      const sliderWrap = document.createElement("div");
      sliderWrap.className = "control-row control-row-indent";
      sliderWrap.style.display = toggleInput.checked ? "" : "none";
      if (groupKey === "edge" && subKey === "chromaticFringe") {
        edgeChromaticFringeInput = toggleInput;
        edgeChromaticFringeSliderWrap = sliderWrap;
        toggleInput.disabled = getBoolAtPath(params, ["edge", "breathingEnabled"]);
        if (edgeChromaticFringeColorRow) {
          edgeChromaticFringeColorRow.style.display = toggleInput.checked ? "" : "none";
        }
      }
      const subLabel = document.createElement("label");
      subLabel.textContent = subSpec.label;
      const subInput = document.createElement("input");
      subInput.type = "range";
      subInput.min = String(subSpec.min);
      subInput.max = String(subSpec.max);
      subInput.step = String(subSpec.step);
      const subValueEl = document.createElement("span");
      subValueEl.className = "value";

      const updateSub = () => {
        const v = Number(subInput.value);
        setAtPath(params, [...subSpec.path], v);
        subValueEl.textContent = subSpec.format ? subSpec.format(v) : v.toFixed(2);
        onChange(params);
      };
      let subVal = getAtPath(params, subSpec.path);
      if (subVal < subSpec.min) {
        setAtPath(params, [...subSpec.path], subSpec.min);
        subVal = subSpec.min;
        onChange(params);
      }
      subInput.value = String(subVal);
      subValueEl.textContent = subSpec.format ? subSpec.format(subVal) : subVal.toFixed(2);
      subInput.addEventListener("input", updateSub);

      sliderWrap.append(subLabel, subInput, subValueEl);

      toggleInput.addEventListener("change", () => {
        setBoolAtPath(params, toggleSpec.togglePath, toggleInput.checked);
        sliderWrap.style.display = toggleInput.checked ? "" : "none";
        if (groupKey === "edge" && subKey === "chromaticFringe" && edgeChromaticFringeColorRow) {
          edgeChromaticFringeColorRow.style.display = toggleInput.checked ? "" : "none";
        }
        onChange(params);
      });

      toggleRow.append(toggleLabel, toggleInput);
      groupEl.appendChild(toggleRow);
      groupEl.appendChild(sliderWrap);
    }

    for (const multiKey of toggleMultiSliderKeys ?? []) {
      const multiSpec = TOGGLE_MULTI_SLIDERS.find((t) => t.key === multiKey);
      if (!multiSpec) continue;

      const toggleRow = document.createElement("div");
      toggleRow.className = "control-row control-row-toggle";
      const toggleLabel = document.createElement("label");
      toggleLabel.textContent = multiSpec.toggleLabel;
      const toggleInput = document.createElement("input");
      toggleInput.type = "checkbox";
      toggleInput.checked = getBoolAtPath(params, multiSpec.togglePath);

      const sliderWrap = document.createElement("div");
      sliderWrap.className = "control-row-indent-wrap";
      sliderWrap.style.display = toggleInput.checked ? "" : "none";

      // 动光内部的“不规则形状”勾选框
      if (multiSpec.key === "movingLight") {
        const irregularRow = document.createElement("div");
        irregularRow.className = "control-row control-row-toggle";
        const irregularLabel = document.createElement("label");
        irregularLabel.textContent = "不规则形状";
        const irregularInput = document.createElement("input");
        irregularInput.type = "checkbox";
        irregularInput.checked = getBoolAtPath(params, ["scene", "movingLightIrregular"]);
        irregularInput.addEventListener("change", () => {
          setBoolAtPath(params, ["scene", "movingLightIrregular"], irregularInput.checked);
          onChange(params);
        });
        irregularRow.append(irregularLabel, irregularInput);
        sliderWrap.appendChild(irregularRow);
      }

      for (const subKey of multiSpec.subSliderKeys) {
        const subSpec = SLIDERS.find((s) => s.key === subKey);
        if (!subSpec) continue;
        const subRow = document.createElement("div");
        subRow.className = "control-row control-row-indent";
        const subLabel = document.createElement("label");
        subLabel.textContent = subSpec.label;
        const subInput = document.createElement("input");
        subInput.type = "range";
        subInput.min = String(subSpec.min);
        subInput.max = String(subSpec.max);
        subInput.step = String(subSpec.step);
        const subValueEl = document.createElement("span");
        subValueEl.className = "value";
        const updateSub = () => {
          const v = Number(subInput.value);
          setAtPath(params, [...subSpec.path], v);
          subValueEl.textContent = subSpec.format ? subSpec.format(v) : v.toFixed(2);
          onChange(params);
        };
        let subVal = getAtPath(params, subSpec.path);
        subVal = Math.max(subSpec.min, Math.min(subSpec.max, subVal));
        subInput.value = String(subVal);
        subValueEl.textContent = subSpec.format ? subSpec.format(subVal) : subVal.toFixed(2);
        subInput.addEventListener("input", updateSub);
        subRow.append(subLabel, subInput, subValueEl);
        sliderWrap.appendChild(subRow);
      }
      for (const subColorKey of multiSpec.subColorKeys ?? []) {
        const subColorSpec = COLOR_PICKERS.find((c) => c.key === subColorKey);
        if (!subColorSpec) continue;
        const subColorRow = document.createElement("div");
        subColorRow.className = "control-row control-row-indent control-row-color";
        const subColorLabel = document.createElement("label");
        subColorLabel.textContent = subColorSpec.label;
        const subColorInput = document.createElement("input");
        subColorInput.type = "color";
        subColorInput.className = "color-picker";
        const rgb = getRgbAtPath(params, subColorSpec.path);
        subColorInput.value = rgbToHex(rgb[0], rgb[1], rgb[2]);
        subColorInput.addEventListener("input", () => {
          setRgbAtPath(params, subColorSpec.path, hexToRgb(subColorInput.value));
          onChange(params);
        });
        subColorRow.append(subColorLabel, subColorInput);
        sliderWrap.appendChild(subColorRow);
      }

      toggleInput.addEventListener("change", () => {
        setBoolAtPath(params, multiSpec.togglePath, toggleInput.checked);
        sliderWrap.style.display = toggleInput.checked ? "" : "none";

        // 呼吸与色散互斥：开启呼吸时禁用色散，并关闭色散颜色
        if (groupKey === "edge" && multiSpec.key === "breathing" && edgeChromaticFringeInput) {
          edgeChromaticFringeInput.disabled = toggleInput.checked;
          if (toggleInput.checked) {
            setBoolAtPath(params, ["edge", "chromaticFringeEnabled"], false);
            edgeChromaticFringeInput.checked = false;
            if (edgeChromaticFringeSliderWrap) edgeChromaticFringeSliderWrap.style.display = "none";
          }
        }

        // 动态光效分组内：呼吸 / 轨迹 / 动光 三者互斥
        if (groupKey === "dynamics" && toggleInput.checked) {
          dynamicsToggles[multiSpec.key] = { input: toggleInput, wrap: sliderWrap };
          const mutualExclusive = ["breathing", "trajectory", "movingLight"];
          if (mutualExclusive.includes(multiSpec.key)) {
            for (const k of mutualExclusive) {
              if (k === multiSpec.key) continue;
              const ref = dynamicsToggles[k];
              if (!ref) continue;
              ref.input.checked = false;
              const spec = TOGGLE_MULTI_SLIDERS.find((t) => t.key === k);
              if (spec) setBoolAtPath(params, spec.togglePath, false);
              ref.wrap.style.display = "none";
            }
          }
        }

        onChange(params);
      });

      if (groupKey === "edge" && multiSpec.key === "breathing" && edgeChromaticFringeInput) {
        edgeChromaticFringeInput.disabled = toggleInput.checked;
      }

      if (groupKey === "dynamics") {
        dynamicsToggles[multiSpec.key] = { input: toggleInput, wrap: sliderWrap };
      }

      toggleRow.append(toggleLabel, toggleInput);
      groupEl.appendChild(toggleRow);
      groupEl.appendChild(sliderWrap);
    }

    for (const key of colorKeys) {
      const spec = COLOR_PICKERS.find((c) => c.key === key);
      if (!spec) continue;
      const row = document.createElement("div");
      row.className = "control-row control-row-color";
      const label = document.createElement("label");
      label.textContent = spec.label;
      const input = document.createElement("input");
      input.type = "color";
      input.className = "color-picker";
      const rgb = getRgbAtPath(params, spec.path);
      input.value = rgbToHex(rgb[0], rgb[1], rgb[2]);

      input.addEventListener("input", () => {
        const rgbNew = hexToRgb(input.value);
        setRgbAtPath(params, spec.path, rgbNew);
        onChange(params);
      });

      // 色散颜色行：初始根据开关显示/隐藏，并保存引用供切换时使用
      if (groupKey === "edge" && spec.key === "chromaticFringeRgb") {
        edgeChromaticFringeColorRow = row;
        if (!getBoolAtPath(params, ["edge", "chromaticFringeEnabled"])) {
          row.style.display = "none";
        }
      }

      row.append(label, input);
      groupEl.appendChild(row);
    }

    container.appendChild(groupEl);
  }

  // 底部保存/导出/导入预设按钮
  if (options?.onSavePreset || options?.onExportPresets || options?.onImportPresets) {
    const saveGroup = document.createElement("div");
    saveGroup.className = "control-group control-group-save";
    const saveRow = document.createElement("div");
    saveRow.className = "control-row";
    saveRow.style.gap = "0.5rem";
    saveRow.style.flexWrap = "wrap";
    if (options.onSavePreset) {
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "保存";
      saveBtn.className = "save-preset-btn";
      saveBtn.addEventListener("click", () => options!.onSavePreset!());
      saveRow.appendChild(saveBtn);
    }
    if (options.onExportPresets) {
      const exportBtn = document.createElement("button");
      exportBtn.type = "button";
      exportBtn.textContent = "导出预设";
      exportBtn.className = "save-preset-btn";
      exportBtn.addEventListener("click", () => options!.onExportPresets!());
      saveRow.appendChild(exportBtn);
    }
    if (options.onImportPresets) {
      const importBtn = document.createElement("button");
      importBtn.type = "button";
      importBtn.textContent = "导入预设";
      importBtn.className = "save-preset-btn";
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,.txt";
      fileInput.style.display = "none";
      fileInput.addEventListener("change", () => {
        const f = fileInput.files?.[0];
        if (f) options!.onImportPresets!(f);
        fileInput.value = "";
      });
      importBtn.addEventListener("click", () => fileInput.click());
      saveRow.appendChild(importBtn);
      saveRow.appendChild(fileInput);
    }
    saveGroup.appendChild(saveRow);
    container.appendChild(saveGroup);
  }
}
