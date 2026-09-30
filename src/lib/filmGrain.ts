/**
 * A filtered stochastic grain approximation, not a stock-calibrated emulsion
 * simulation. Three independent, zero-mean fields supply a controllable grain
 * spectrum; the shader modulates their variance using local image density.
 */
export const GRAIN_ATLAS_SIZE = 256;
export const GRAIN_ZERO = 128;
export const GRAIN_ENCODING_SCALE = 24;

export interface GrainMipLevel {
  size: number;
  data: Uint8Array;
}

let cachedAtlas: GrainMipLevel[] | undefined;

/** Deterministic, seamless Gaussian-correlated RGB fields and their area mips. */
export function createGrainAtlas(): GrainMipLevel[] {
  if (cachedAtlas) return cachedAtlas;
  const size = GRAIN_ATLAS_SIZE;
  const count = size * size;
  let state = 0x6d79726f;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  // A periodic separable Gaussian makes adjacent samples belong to the same
  // particle, including across texture edges. Each channel has its own field.
  const radius = 3;
  const kernel = Array.from({ length: radius * 2 + 1 }, (_, i) =>
    Math.exp(-0.5 * ((i - radius) / 0.75) ** 2));
  const kernelSum = kernel.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kernelSum;
  const fields = new Float32Array(count * 3);
  for (let channel = 0; channel < 3; channel++) {
    const white = new Float32Array(count);
    const horizontal = new Float32Array(count);
    const filtered = new Float32Array(count);
    for (let i = 0; i < count; i += 2) {
      const magnitude = Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12)));
      const angle = random() * 2 * Math.PI;
      white[i] = magnitude * Math.cos(angle);
      white[i + 1] = magnitude * Math.sin(angle);
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let value = 0;
        for (let k = -radius; k <= radius; k++) {
          value += white[y * size + ((x + k + size) % size)] * kernel[k + radius];
        }
        horizontal[y * size + x] = value;
      }
    }
    let sum = 0;
    let sumSquares = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let value = 0;
        for (let k = -radius; k <= radius; k++) {
          value += horizontal[((y + k + size) % size) * size + x] * kernel[k + radius];
        }
        filtered[y * size + x] = value;
        sum += value;
        sumSquares += value * value;
      }
    }
    const mean = sum / count;
    const rms = Math.sqrt(sumSquares / count - mean * mean);
    for (let i = 0; i < count; i++) fields[i * 3 + channel] = (filtered[i] - mean) / rms;
  }

  const levels: GrainMipLevel[] = [];
  let current = fields;
  for (let levelSize = size; levelSize >= 1; levelSize /= 2) {
    const data = new Uint8Array(levelSize * levelSize * 4);
    for (let i = 0; i < levelSize * levelSize; i++) {
      for (let channel = 0; channel < 3; channel++) {
        data[i * 4 + channel] = GRAIN_ZERO + Math.max(-127, Math.min(127,
          Math.round(current[i * 3 + channel] * GRAIN_ENCODING_SCALE)));
      }
      data[i * 4 + 3] = 255;
    }
    // Balance rounding residuals per channel. Even a one-code-value bias in a
    // tiny mip would otherwise become visible as a uniform grain tint.
    const pixels = levelSize * levelSize;
    for (let channel = 0; channel < 3; channel++) {
      let residual = 0;
      for (let i = 0; i < pixels; i++) residual += data[i * 4 + channel] - GRAIN_ZERO;
      const direction = Math.sign(residual);
      for (let i = 0; i < pixels && residual !== 0; i++) {
        const index = ((i * 997 + channel * 53) % pixels) * 4 + channel;
        const corrected = data[index] - direction;
        if (corrected >= 1 && corrected <= 255) {
          data[index] = corrected;
          residual -= direction;
        }
      }
    }
    levels.push({ size: levelSize, data });
    if (levelSize === 1) break;
    // Average signed float fields before encoding. Building mips from bytes
    // would accumulate a DC bias and brighten heavily reduced previews.
    const nextSize = levelSize / 2;
    const next = new Float32Array(nextSize * nextSize * 3);
    for (let y = 0; y < nextSize; y++) {
      for (let x = 0; x < nextSize; x++) {
        for (let channel = 0; channel < 3; channel++) {
          const i = (y * 2 * levelSize + x * 2) * 3 + channel;
          next[(y * nextSize + x) * 3 + channel] =
            (current[i] + current[i + 3] + current[i + levelSize * 3] + current[i + (levelSize + 1) * 3]) * 0.25;
        }
      }
    }
    current = next;
  }
  cachedAtlas = levels;
  return levels;
}

/** Shared by the production WebGL2 renderer and its visual/statistical tests. */
export const FILM_GRAIN_GLSL = /* glsl */ `
  uint grainHash(ivec2 cell, uint seed) {
    uint h = uint(cell.x) * 0x8da6b343u ^ uint(cell.y) * 0xd8163841u ^ seed;
    h = (h ^ (h >> 16u)) * 0x7feb352du;
    h = (h ^ (h >> 15u)) * 0x846ca68bu;
    return h ^ (h >> 16u);
  }

  vec2 grainOffset(ivec2 cell, uint seed) {
    uint h = grainHash(cell, seed);
    return (vec2(float(h & 65535u), float(h >> 16u)) + 0.5) / 65536.0;
  }

  vec3 grainField(vec2 p, uint seed) {
    // Stochastic tiling prevents the small atlas from repeating over a photo.
    // Smooth, RMS-normalized overlap avoids seams and weaker grain at tile edges.
    vec2 tile = p / 128.0;
    ivec2 cell = ivec2(floor(tile));
    vec2 f = fract(tile);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec4 weights = vec4((1.0-f.x)*(1.0-f.y), f.x*(1.0-f.y), (1.0-f.x)*f.y, f.x*f.y);
    vec2 uv = p / ${GRAIN_ATLAS_SIZE.toFixed(1)};
    // Explicit derivatives exclude the discontinuous random tile offsets from
    // LOD selection. The mips integrate subpixel grain instead of aliasing it.
    vec2 dx = dFdx(uv);
    vec2 dy = dFdy(uv);
    vec3 a = textureGrad(uGrainTex, uv + grainOffset(cell, seed), dx, dy).rgb;
    vec3 b = textureGrad(uGrainTex, uv + grainOffset(cell + ivec2(1,0), seed), dx, dy).rgb;
    vec3 c = textureGrad(uGrainTex, uv + grainOffset(cell + ivec2(0,1), seed), dx, dy).rgb;
    vec3 d = textureGrad(uGrainTex, uv + grainOffset(cell + ivec2(1,1), seed), dx, dy).rgb;
    vec3 field = ((a*weights.x + b*weights.y + c*weights.z + d*weights.w) * 255.0 - ${GRAIN_ZERO.toFixed(1)}) / ${GRAIN_ENCODING_SCALE.toFixed(1)};
    return field * inversesqrt(dot(weights, weights));
  }

  vec3 applyFilmGrain(vec3 color, vec2 imagePosition, float amount, float diameter, float type, float seed) {
    vec3 base = clamp(color, 0.0, 1.0);
    float y = dot(base, vec3(0.2126, 0.7152, 0.0722));
    // Effective developed-grain coverage p = 1-Y is a perceptual density proxy.
    // The filtered Boolean-model variance p(1-p) protects both clear highlights
    // and solid blacks. It is not a measured negative-to-scan transfer curve.
    float coverage = 1.0 - y;
    float response = 2.0 * sqrt(max(coverage * (1.0 - coverage), 0.0));
    response *= 0.85 + 0.30 * coverage;

    vec2 p = imagePosition / max(diameter, 0.1);
    uint key = floatBitsToUint(seed);
    // Coordinates never depend on density. Changing tone only changes variance
    // and spectrum, so grain cannot warp along edges or brightness gradients.
    vec3 fine = grainField(mat2(0.8,-0.6,0.6,0.8) * p / 0.70, key ^ 0xa511e9b3u);
    vec3 medium = grainField(mat2(0.6,-0.8,0.8,0.6) * p / 1.55, key ^ 0x63d83595u);
    vec3 coarse = grainField(mat2(0.28,-0.96,0.96,0.28) * p / 3.40, key ^ 0xb5297a4du);
    vec3 weights = type < 0.5 ? vec3(0.82,0.35,0.12)
      : (type < 1.5 ? vec3(0.52,0.68,0.28) : vec3(0.30,0.55,0.78));
    weights *= mix(vec3(1.10,1.0,0.80), vec3(0.85,1.0,1.20), coverage);
    weights *= inversesqrt(dot(weights, weights));
    vec3 field = fine*weights.x + medium*weights.y + coarse*weights.z;

    // A shared luma field plus subtle, zero-luma chroma. Neutral/B&W pixels get
    // strictly monochrome grain, rather than independent RGB confetti.
    float chroma = clamp((max(base.r,max(base.g,base.b)) - min(base.r,min(base.g,base.b))) * 2.0, 0.0, 1.0);
    vec3 grain = vec3(field.r) + 0.12 * chroma * (field - dot(field, vec3(0.2126,0.7152,0.0722)));
    vec3 delta = grain * clamp(amount, 0.0, 1.0) * 0.055 * response;
    // Symmetric bounded addition preserves the mean much better than soft-light
    // or one-sided clipping, even at the ends of the tone scale.
    vec3 headroom = min(base, 1.0-base);
    vec3 ratio = delta / max(headroom, vec3(1e-5));
    return base + headroom * ratio * inversesqrt(1.0 + ratio*ratio);
  }
`;
