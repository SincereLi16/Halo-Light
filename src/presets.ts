import type { HaloLightParams } from "./types";

const STORAGE_KEY = "halo-light-presets";

export interface Preset {
  id: string;
  params: HaloLightParams;
  thumbnail: string;
  createdAt: number;
}

function genId(): string {
  return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function getPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Preset[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addPreset(params: HaloLightParams, thumbnail: string): Preset {
  const preset: Preset = {
    id: genId(),
    params: JSON.parse(JSON.stringify(params)),
    thumbnail,
    createdAt: Date.now(),
  };
  const list = getPresets();
  list.push(preset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return preset;
}

export function removePreset(id: string): void {
  const list = getPresets().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** 导出预设为 JSON 字符串，可保存到文件 */
export function exportPresetsToJson(): string {
  const list = getPresets();
  return JSON.stringify(list, null, 2);
}

/** 从 JSON 字符串导入预设，合并到现有列表 */
export function importPresetsFromJson(json: string): number {
  try {
    const arr = JSON.parse(json) as Preset[];
    if (!Array.isArray(arr)) return 0;
    const list = getPresets();
    for (const p of arr) {
      if (p?.params && typeof p.params === "object") {
        list.push({
          id: p.id ?? genId(),
          params: p.params,
          thumbnail: typeof p.thumbnail === "string" ? p.thumbnail : "",
          createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
        });
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return arr.length;
  } catch {
    return 0;
  }
}
