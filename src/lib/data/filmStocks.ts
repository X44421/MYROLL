import type { Preset, PresetPack } from "./filmTypes";

export interface CubePresetMeta {
  id: string;
  name: string;
  file: string;
}

export const CUBE_PRESET_META: CubePresetMeta[] = [
  { id: "b1", name: "B1", file: "/presets/B1.cube" },
  { id: "bw1", name: "BW1", file: "/presets/BW1.cube" },
  { id: "bw2", name: "BW2", file: "/presets/BW2.cube" },
  { id: "bw3", name: "BW3", file: "/presets/BW3.cube" },
  { id: "bw4", name: "BW4", file: "/presets/BW4.cube" },
  { id: "bw5", name: "BW5", file: "/presets/BW5.cube" },
  { id: "c1", name: "C1", file: "/presets/C1.cube" },
  { id: "c2", name: "C2", file: "/presets/C2.cube" },
  { id: "c3", name: "C3", file: "/presets/C3.cube" },
  { id: "c4", name: "C4", file: "/presets/C4.cube" },
  { id: "c5", name: "C5", file: "/presets/C5.cube" },
];

export function buildInitialPresetMap(): Record<string, Preset> {
  const map: Record<string, Preset> = {};
  for (const meta of CUBE_PRESET_META) {
    map[meta.id] = {
      id: meta.id,
      name: meta.name,
      kind: "builtin",
      filterCSS: "none",
      grain: 0,
    };
  }
  return map;
}

export async function loadCubePresets(): Promise<Record<string, Preset>> {
  const { parseCubeText, buildCSSApproximation, computeGradient } = await import("../cubeParser");
  const map: Record<string, Preset> = {};
  for (const meta of CUBE_PRESET_META) {
    try {
      const resp = await fetch(meta.file);
      const text = await resp.text();
      const { size, data } = parseCubeText(text);
      const filterCSS = buildCSSApproximation(data, size);
      const gradient = computeGradient(data, size);
      map[meta.id] = {
        id: meta.id,
        name: meta.name,
        kind: "builtin",
        filterCSS,
        grain: 0,
        gradient,
        lutData: data,
        lutSize: size,
      };
    } catch {
      map[meta.id] = {
        id: meta.id,
        name: meta.name,
        kind: "builtin",
        filterCSS: "none",
        grain: 0,
      };
    }
  }
  return map;
}

export const BUILTIN_PACKS: PresetPack[] = [
  {
    id: "pack-base",
    name: "Base",
    presetIds: ["b1"],
  },
  {
    id: "pack-color",
    name: "Color",
    presetIds: ["c1", "c2", "c3", "c4", "c5"],
  },
  {
    id: "pack-bw",
    name: "B&W",
    presetIds: ["bw1", "bw2", "bw3", "bw4", "bw5"],
  },
];

export const PRESET_MAP: Record<string, Preset> = buildInitialPresetMap();
