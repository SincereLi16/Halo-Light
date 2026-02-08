import { DEFAULT_PARAMS, clampParams } from "./params";
import type { HaloLightParams } from "./types";
import { render } from "./render";
import { createPanel } from "./ui";
import { getPresets, addPreset, removePreset, exportPresetsToJson, importPresetsFromJson } from "./presets";

const THUMB_SIZE = 80;

function main(): void {
  const canvas = document.getElementById("halo") as HTMLCanvasElement;
  const panelEl = document.getElementById("panel");
  const canvasWrap = document.getElementById("canvas-wrap");
  if (!canvas || !panelEl || !canvasWrap) return;

  let params: HaloLightParams = { ...clampParams(DEFAULT_PARAMS) };

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  // 预设缩略图容器（画布左上角）
  const presetContainer = document.createElement("div");
  presetContainer.className = "preset-thumbnails";
  canvasWrap.appendChild(presetContainer);

  function generateThumbnail(p: HaloLightParams): string {
    const off = document.createElement("canvas");
    off.width = THUMB_SIZE;
    off.height = THUMB_SIZE;
    const offCtx = off.getContext("2d")!;
    const needTime =
      p.edge.breathingEnabled || p.edge.trajectoryEnabled || p.scene.movingLightEnabled;
    const t = needTime ? performance.now() / 1000 : undefined;
    render(offCtx, p, t);
    return off.toDataURL("image/jpeg", 0.88);
  }

  function refreshPresetThumbnails(): void {
    presetContainer.innerHTML = "";
    const presets = getPresets();
    for (const preset of presets) {
      const wrap = document.createElement("div");
      wrap.className = "preset-thumb-wrap";
      const img = document.createElement("img");
      img.className = "preset-thumb";
      img.src = preset.thumbnail;
      img.alt = "";
      img.title = "点击应用";
      img.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".preset-thumb-delete")) return;
        const newP = clampParams(JSON.parse(JSON.stringify(preset.params)));
        params.spot = newP.spot;
        params.color = newP.color;
        params.edge = newP.edge;
        params.scene = newP.scene;
        onParamsChange(params);
        setupPanel();
      });
      const del = document.createElement("button");
      del.className = "preset-thumb-delete";
      del.type = "button";
      del.title = "删除预设";
      del.innerHTML = "×";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        removePreset(preset.id);
        refreshPresetThumbnails();
      });
      wrap.appendChild(img);
      wrap.appendChild(del);
      presetContainer.appendChild(wrap);
    }
  }

  function onSavePreset(): void {
    const thumbnail = generateThumbnail(params);
    addPreset(params, thumbnail);
    refreshPresetThumbnails();
  }

  function onExportPresets(): void {
    const json = exportPresetsToJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `夕阳灯预设_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImportPresets(file: File): Promise<void> {
    const text = await file.text();
    const n = importPresetsFromJson(text);
    refreshPresetThumbnails();
    if (n > 0) onParamsChange(params);
  }

  refreshPresetThumbnails();

  function setupPanel(): void {
    panelEl.innerHTML = "";
    createPanel(panelEl, params, onParamsChange, {
      onSavePreset,
      onExportPresets,
      onImportPresets: (f) => onImportPresets(f),
    });
  }

  function resize(): void {
    const wrap = canvas.parentElement!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let cw = wrap.clientWidth;
    let ch = wrap.clientHeight;
    if (cw <= 0 || ch <= 0) {
      cw = Math.max(400, (window.innerWidth || 800) - 300);
      ch = Math.max(300, (window.innerHeight || 600) - 40);
    }
    const w = Math.floor(cw * dpr);
    const h = Math.floor(ch * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";

    const needTime =
      params.edge.breathingEnabled ||
      params.edge.trajectoryEnabled ||
      params.scene.movingLightEnabled;
    const t = needTime ? performance.now() / 1000 : undefined;
    render(ctx, params, t);
  }

  function onParamsChange(newParams?: HaloLightParams): void {
    if (newParams !== undefined) {
      params = clampParams(newParams);
    } else {
      params = clampParams(params);
    }

    const needTime =
      params.edge.breathingEnabled ||
      params.edge.trajectoryEnabled ||
      params.scene.movingLightEnabled;
    const t = needTime ? performance.now() / 1000 : undefined;
    render(ctx, params, t);
  }

  setupPanel();
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(() => resize());
  window.addEventListener("load", resize);

  function tick(): void {
    const needTime =
      params.edge.breathingEnabled ||
      params.edge.trajectoryEnabled ||
      params.scene.movingLightEnabled;
    if (needTime) {
      const t = performance.now() / 1000;
      render(ctx, params, t);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

main();
