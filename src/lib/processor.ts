export interface RenderParams {
  exposure: number;
  contrast: number;
  temperature: number;
  tint: number;
  shadows: number;
  highlights: number;
  saturation: number;
  intensity: number;
  vignette: number;
  grain: number;
  grainSize: number;
  grainType: number;
  halation: number;
  lightLeak: number;
  bloom: number;
  dispersion: number;
  hslH: Float32Array;
  hslS: Float32Array;
  hslL: Float32Array;
  splitShadowsHue: number;
  splitShadowsSat: number;
  splitHighlightsHue: number;
  splitHighlightsSat: number;
  splitBalance: number;
  fade: number;
  borderMode: number;
  borderWidth: number;
  lut4DAxis: number;
  time: number;
  isVideo?: boolean;
  grainSeed?: number;
  leakSeed?: number;
}

export interface ILUTProcessor {
  canvas: HTMLCanvasElement;
  setImage(image: HTMLImageElement | HTMLVideoElement, width: number, height: number): void | Promise<void>;
  updateTexture(video: HTMLVideoElement): void;
  setLUT(size: number, data: Float32Array): void;
  setLUT2(size: number, data: Float32Array | null): void;
  render(params: RenderParams): void;
  setRenderScale(maxDimension: number): void;
  exportToDataURL(params: RenderParams, type?: string, quality?: number): string;
  exportToBlob(params: RenderParams, type?: string, quality?: number): Promise<Blob>;
  dispose(): void;
}
