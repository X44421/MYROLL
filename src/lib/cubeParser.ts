import { FloatType } from 'three';
import { LUTCubeLoader } from 'three/examples/jsm/loaders/LUTCubeLoader.js';
import { LUT3dlLoader } from 'three/examples/jsm/loaders/LUT3dlLoader.js';

export interface ParseCubeResult {
  size: number;
  data: Float32Array;
  title?: string;
}

const cubeLoader = new LUTCubeLoader();
cubeLoader.type = FloatType;
const loader3dl = new LUT3dlLoader();
loader3dl.type = FloatType;

function rgbaToRgb(rgba: Float32Array, size: number): Float32Array {
  const rgb = new Float32Array(size * size * size * 3);
  let src = 0, dst = 0;
  for (let i = 0; i < size * size * size; i++) {
    rgb[dst++] = rgba[src++];
    rgb[dst++] = rgba[src++];
    rgb[dst++] = rgba[src++];
    src++;
  }
  return rgb;
}

export function parseCubeText(text: string): ParseCubeResult {
  let result: { size: number; texture3D: { image: { data: Float32Array } }; title?: string };
  try {
    result = cubeLoader.parse(text);
  } catch {
    result = loader3dl.parse(text);
  }
  const data = rgbaToRgb(result.texture3D.image.data as Float32Array, result.size);
  return { size: result.size, data, title: (result as any).title };
}

export async function parseCube(file: File): Promise<ParseCubeResult> {
  const text = await file.text();
  return parseCubeText(text);
}

function trilinearLookup(
  data: Float32Array,
  size: number,
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const s = size - 1;
  const ri = Math.min(r * s, s - 0.001);
  const gi = Math.min(g * s, s - 0.001);
  const bi = Math.min(b * s, s - 0.001);

  const r0 = Math.floor(ri), r1 = r0 + 1;
  const g0 = Math.floor(gi), g1 = g0 + 1;
  const b0 = Math.floor(bi), b1 = b0 + 1;

  const dr = ri - r0, dg = gi - g0, db = bi - b0;

  const idx = (ri: number, gi: number, bi: number) =>
    (bi * size * size + gi * size + ri) * 3;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const interp = (ch: number) => {
    const c000 = data[idx(r0, g0, b0) + ch];
    const c100 = data[idx(r1, g0, b0) + ch];
    const c010 = data[idx(r0, g1, b0) + ch];
    const c110 = data[idx(r1, g1, b0) + ch];
    const c001 = data[idx(r0, g0, b1) + ch];
    const c101 = data[idx(r1, g0, b1) + ch];
    const c011 = data[idx(r0, g1, b1) + ch];
    const c111 = data[idx(r1, g1, b1) + ch];

    return lerp(
      lerp(lerp(c000, c100, dr), lerp(c010, c110, dr), dg),
      lerp(lerp(c001, c101, dr), lerp(c011, c111, dr), dg),
      db
    );
  };

  return [interp(0), interp(1), interp(2)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function computeGradient(data: Float32Array, size: number): string {
  const testColors: [number, number, number][] = [
    [1,0,0], [0,1,0], [0,0,1], [1,0,1], [0,1,1], [1,1,0],
    [0.9,0.2,0.1], [0.1,0.9,0.1], [0.1,0.2,0.9], [1,0.5,0], [0,1,1], [1,0,0.5],
  ];
  let warmest = [0,0,0], coolest = [1,1,1];
  let maxWarm = -Infinity, minCool = Infinity;
  for (const [r,g,b] of testColors) {
    const [lr, lg, lb] = trilinearLookup(data, size, r, g, b);
    const warmth = lr * 0.6 + lg * 0.3 + lb * 0.1;
    if (warmth > maxWarm) { maxWarm = warmth; warmest = [lr, lg, lb]; }
    if (warmth < minCool) { minCool = warmth; coolest = [lr, lg, lb]; }
  }
  return `linear-gradient(135deg, ${rgbToHex(coolest[0], coolest[1], coolest[2])}, ${rgbToHex(warmest[0], warmest[1], warmest[2])})`;
}

export function buildCSSApproximation(data: Float32Array, size: number): string {
  const samples = [0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95];
  let totalDr = 0, totalDg = 0, totalDb = 0;
  let totalChroma = 0;
  let maxChroma = 0;
  let count = 0;

  for (const r of samples) {
    for (const g of samples) {
      for (const b of samples) {
        const [lr, lg, lb] = trilinearLookup(data, size, r, g, b);
        const dr = lr - r, dg = lg - g, db = lb - b;
        totalDr += dr; totalDg += dg; totalDb += db;
        const chroma = Math.abs(lr - lg) + Math.abs(lg - lb) + Math.abs(lb - lr);
        totalChroma += chroma;
        if (chroma > maxChroma) maxChroma = chroma;
        count++;
      }
    }
  }

  const avgDr = totalDr / count, avgDg = totalDg / count, avgDb = totalDb / count;
  const avgChroma = totalChroma / count;
  const parts: string[] = [];

  if (avgChroma < 0.035 && maxChroma < 0.12) {
    const contrast = 1 + (Math.abs(avgDr) + Math.abs(avgDg) + Math.abs(avgDb)) * 0.5;
    const brightness = 1 + (avgDr + avgDg + avgDb) / 3;
    parts.push("grayscale(1)");
    parts.push(`contrast(${Math.max(0.7, Math.min(1.5, contrast)).toFixed(3)})`);
    parts.push(`brightness(${Math.max(0.5, Math.min(1.8, brightness)).toFixed(3)})`);
  } else {
    const brightness = 1 + (avgDr + avgDg + avgDb) / 3;
    const saturation = 1 + Math.abs(avgDr - avgDb) * 1.2;
    const contrast = 1 + (Math.abs(avgDr) + Math.abs(avgDg) + Math.abs(avgDb)) * 0.4;
    parts.push(`brightness(${Math.max(0.5, Math.min(1.8, brightness)).toFixed(3)})`);
    parts.push(`contrast(${Math.max(0.7, Math.min(1.5, contrast)).toFixed(3)})`);
    parts.push(`saturate(${Math.max(0.5, Math.min(2.0, saturation)).toFixed(3)})`);
    if (avgDr > 0.02) parts.push(`sepia(${Math.min(0.35, avgDr * 2.5).toFixed(3)})`);
    if (Math.abs(avgDb) > 0.02) parts.push(`hue-rotate(${Math.round(avgDb * -35)}deg)`);
  }

  return parts.join(" ");
}
