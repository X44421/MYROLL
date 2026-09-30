export type Photo = {
  id: string;
  dataUrl: string;
  thumbUrl?: string;
  processedUrl?: string;
  name: string;
  width: number;
  height: number;
  editState: EditState;
};

export type EditState = {
  presetId: string;
  adjust: {
    exposure: number;     // -100..100
    contrast: number;     // -100..100
    saturation: number;   // -100..100
    temperature: number;  // -100..100
    tint: number;         // -100..100
    shadows: number;      // -100..100
    highlights: number;   // -100..100
    fade: number;         // 0..100
    vignette: number;     // 0..100
  };
  grain: {
    amount: number; // 0..100
    size: number;   // 0.5..3
    type: "fine" | "medium" | "coarse";
  };
  effects: {
    halation: number;    // 0..100
    lightLeak: number;   // 0..100
    bloom: number;       // 0..100
    dispersion: number;  // 0..100
  };
  hsl: {
    h: number[];
    s: number[];
    l: number[];
  };
  splitTone: {
    shadowsHue: number;
    shadowsSat: number;
    highlightsHue: number;
    highlightsSat: number;
    balance: number;
  };
  lut: {
    intensity: number; // 0..100
    axis: number;      // 0..100
  };
  crop: {
    borderMode: number;  // 0=off, 1=white, 2=black, 3=film
    borderWidth: number;
  };
};

const EMPTY_8 = [0, 0, 0, 0, 0, 0, 0, 0];

export const DEFAULT_EDIT_STATE: EditState = {
  presetId: "",
  adjust: { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, shadows: 0, highlights: 0, fade: 0, vignette: 0 },
  grain: { amount: 0, size: 1, type: "medium" },
  effects: { halation: 0, lightLeak: 0, bloom: 0, dispersion: 0 },
  hsl: { h: [...EMPTY_8], s: [...EMPTY_8], l: [...EMPTY_8] },
  splitTone: { shadowsHue: 0, shadowsSat: 0, highlightsHue: 0, highlightsSat: 0, balance: 0 },
  lut: { intensity: 100, axis: 50 },
  crop: { borderMode: 0, borderWidth: 0.04 },
};

export type Preset = {
  id: string;
  name: string;
  kind: "builtin" | "imported" | "user";
  filterCSS: string;
  grain: number;        // 0..1 default grain
  tint?: string;        // rgba overlay string
  lutData?: Float32Array;
  lutSize?: number;     // 17 | 33 | 65
  gradient?: string;    // CSS linear-gradient for thumbnail
  snapshot?: {
    adjust: EditState["adjust"];
    effects: EditState["effects"];
    grain: EditState["grain"];
    hsl: EditState["hsl"];
    splitTone: EditState["splitTone"];
    lut: EditState["lut"];
  };
};

export type PresetPack = {
  id: string;
  name: string;
  presetIds: string[];
};
