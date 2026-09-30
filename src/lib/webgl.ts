import { ILUTProcessor, RenderParams } from './processor';
import { createGrainAtlas, FILM_GRAIN_GLSL } from './filmGrain';

function checkGlError(gl: WebGL2RenderingContext, label: string) {
  const err = gl.getError();
  if (err !== gl.NO_ERROR) {
    console.warn(`[WebGL] ${label}: glError ${err}`);
  }
}

export class LUTProcessor implements ILUTProcessor {
  public canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  
  private imageTexture: WebGLTexture | null = null;
  private lutTexture: WebGLTexture | null = null;
  private lut2Texture: WebGLTexture | null = null;
  private lutSize: number = 0;
  private lutSizeLoc: WebGLUniformLocation | null;
  private lut2SizeLoc: WebGLUniformLocation | null = null;
  private lut4DAxisLoc: WebGLUniformLocation | null = null;
  private intensityLoc: WebGLUniformLocation | null;
  private exposureLoc: WebGLUniformLocation | null;
  private contrastLoc: WebGLUniformLocation | null;
  private temperatureLoc: WebGLUniformLocation | null;
  private tintLoc: WebGLUniformLocation | null;
  private shadowsLoc: WebGLUniformLocation | null;
  private highlightsLoc: WebGLUniformLocation | null;
  private saturationLoc: WebGLUniformLocation | null;
  
  private vignetteLoc: WebGLUniformLocation | null;
  private dispersionLoc: WebGLUniformLocation | null = null;
  private grainLoc: WebGLUniformLocation | null;
  private resolutionLoc: WebGLUniformLocation | null;
  private timeLoc: WebGLUniformLocation | null;
  private halationLoc: WebGLUniformLocation | null = null;
  private lightLeakLoc: WebGLUniformLocation | null = null;
  private leakSeedLoc: WebGLUniformLocation | null = null;
  private leakTextureLoc: WebGLUniformLocation | null = null;
  private bloomLoc: WebGLUniformLocation | null = null;

  private hslHLoc: WebGLUniformLocation | null = null;
  private hslSLoc: WebGLUniformLocation | null = null;
  private hslLLoc: WebGLUniformLocation | null = null;
  private hslActiveLoc: WebGLUniformLocation | null = null;

  private splitShadowsHueLoc: WebGLUniformLocation | null = null;
  private splitShadowsSatLoc: WebGLUniformLocation | null = null;
  private splitHighlightsHueLoc: WebGLUniformLocation | null = null;
  private splitHighlightsSatLoc: WebGLUniformLocation | null = null;
  private splitBalanceLoc: WebGLUniformLocation | null = null;
  private fadeLoc: WebGLUniformLocation | null = null;
  private borderModeLoc: WebGLUniformLocation | null = null;
  private borderWidthLoc: WebGLUniformLocation | null = null;
  private isVideoLoc: WebGLUniformLocation | null = null;
  private grainSeedLoc: WebGLUniformLocation | null = null;
  private grainSizeLoc: WebGLUniformLocation | null = null;
  private grainTypeLoc: WebGLUniformLocation | null = null;
  private imageSizeLoc: WebGLUniformLocation | null = null;

  private uvBuffer: WebGLBuffer | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private originalWidth: number = 0;
  private originalHeight: number = 0;
  private renderMaxDimension: number = 0;
  private renderScale: number = 1;
  private texturesDirty = true;
  private leakTexture: WebGLTexture | null = null;
  private grainTex: WebGLTexture | null = null;
  private grainTexLoc: WebGLUniformLocation | null = null;
  private lutData: Float32Array | null = null;
  private prevHslH: Float32Array | null = null;
  private prevHslS: Float32Array | null = null;
  private prevHslL: Float32Array | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 not supported in this browser.");
    this.gl = gl;
    // LUTs use texelFetch with tetrahedral interpolation in the shader.
    
    this.program = this.initProgram();
    
    // Setup quadratics
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0
    ]), gl.STATIC_DRAW);
    
    const positionLoc = gl.getAttribLocation(this.program, "aPosition");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    this.uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       0.0,  1.0,
       1.0,  1.0,
       0.0,  0.0,
       0.0,  0.0,
       1.0,  1.0,
       1.0,  0.0
    ]), gl.STATIC_DRAW);

    const uvLoc = gl.getAttribLocation(this.program, "aUv");
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

    const imageLoc = gl.getUniformLocation(this.program, "uImage");
    const lutLoc = gl.getUniformLocation(this.program, "uLut");
    const lut2Loc = gl.getUniformLocation(this.program, "uLut2");
    
    this.lutSizeLoc = gl.getUniformLocation(this.program, "uLutSize");
    this.lut2SizeLoc = gl.getUniformLocation(this.program, "uLut2Size");
    this.lut4DAxisLoc = gl.getUniformLocation(this.program, "uLut4DAxis");
    this.intensityLoc = gl.getUniformLocation(this.program, "uIntensity");
    this.exposureLoc = gl.getUniformLocation(this.program, "uExposure");
    this.contrastLoc = gl.getUniformLocation(this.program, "uContrast");
    this.temperatureLoc = gl.getUniformLocation(this.program, "uTemperature");
    this.tintLoc = gl.getUniformLocation(this.program, "uTint");
    this.shadowsLoc = gl.getUniformLocation(this.program, "uShadows");
    this.highlightsLoc = gl.getUniformLocation(this.program, "uHighlights");
    this.saturationLoc = gl.getUniformLocation(this.program, "uSaturation");
    
    this.vignetteLoc = gl.getUniformLocation(this.program, "uVignette");
    this.dispersionLoc = gl.getUniformLocation(this.program, "uDispersion");
    this.grainLoc = gl.getUniformLocation(this.program, "uGrain");
    this.resolutionLoc = gl.getUniformLocation(this.program, "uResolution");
    this.timeLoc = gl.getUniformLocation(this.program, "uTime");
    this.halationLoc = gl.getUniformLocation(this.program, "uHalation");
    this.lightLeakLoc = gl.getUniformLocation(this.program, "uLightLeak");
    this.leakSeedLoc = gl.getUniformLocation(this.program, "uLeakSeed");
    this.leakTextureLoc = gl.getUniformLocation(this.program, "uLeakNoiseTex");
    this.bloomLoc = gl.getUniformLocation(this.program, "uBloom");

    this.hslHLoc = gl.getUniformLocation(this.program, "uHslH");
    this.hslSLoc = gl.getUniformLocation(this.program, "uHslS");
    this.hslLLoc = gl.getUniformLocation(this.program, "uHslL");
    this.hslActiveLoc = gl.getUniformLocation(this.program, "uHslActive");

    this.splitShadowsHueLoc = gl.getUniformLocation(this.program, "uSplitShadowsHue");
    this.splitShadowsSatLoc = gl.getUniformLocation(this.program, "uSplitShadowsSat");
    this.splitHighlightsHueLoc = gl.getUniformLocation(this.program, "uSplitHighlightsHue");
    this.splitHighlightsSatLoc = gl.getUniformLocation(this.program, "uSplitHighlightsSat");
    this.splitBalanceLoc = gl.getUniformLocation(this.program, "uSplitBalance");
    this.fadeLoc = gl.getUniformLocation(this.program, "uFade");
    
    this.borderModeLoc = gl.getUniformLocation(this.program, "uBorderMode");
    this.borderWidthLoc = gl.getUniformLocation(this.program, "uBorderWidth");
    this.isVideoLoc = gl.getUniformLocation(this.program, "uIsVideo");
    this.grainSeedLoc = gl.getUniformLocation(this.program, "uGrainSeed");
    this.grainSizeLoc = gl.getUniformLocation(this.program, "uGrainSize");
    this.grainTypeLoc = gl.getUniformLocation(this.program, "uGrainType");
    this.imageSizeLoc = gl.getUniformLocation(this.program, "uImageSize");
    this.grainTexLoc = gl.getUniformLocation(this.program, "uGrainTex");

    gl.useProgram(this.program);
    gl.uniform1i(imageLoc, 0);
    gl.uniform1i(lutLoc, 1);
    gl.uniform1i(lut2Loc, 2);

    // Generate and bind noise texture for light leak (unit 3)
    this.leakTexture = this.generateNoiseTexture(gl);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.leakTexture);
    gl.uniform1i(this.leakTextureLoc, 3);

    // The same deterministic correlated fields serve every grain type (unit 4).
    gl.activeTexture(gl.TEXTURE4);
    this.grainTex = this.generateGrainTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, this.grainTex);
    gl.uniform1i(this.grainTexLoc, 4);
  }

  private initProgram(): WebGLProgram {
    const gl = this.gl;
    const vertexShaderSource = `#version 300 es
      in vec2 aPosition;
      in vec2 aUv;
      out vec2 vUv;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vUv = aUv;
      }
    `;

    // Fragment Shader: Applies professional grade color adjustments
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      precision highp int;
      precision highp sampler2D;
      precision highp sampler3D;
      
      in vec2 vUv;
      uniform sampler2D uImage;
      uniform sampler3D uLut;
      uniform float uLutSize;
      uniform sampler3D uLut2;
      uniform float uLut2Size;
      uniform float uLut4DAxis;
      
      uniform float uIntensity; // LUT
      uniform float uExposure;
      uniform float uContrast;
      uniform float uTemperature; // -1 to +1
      uniform float uTint;        // -1 to +1
      uniform float uShadows;     // -1 to +1
      uniform float uHighlights;  // -1 to +1
      uniform float uSaturation;  // 0 to 2
      
      uniform float uVignette;    // 0 to 1
      uniform float uDispersion;   // 0 to 1.2
      uniform float uGrain;       // 0 to 1
      uniform float uGrainSize;   // 0.5 to 3
      uniform float uGrainType;   // 0=fine, 1=medium, 2=coarse
      uniform float uSharpen;     // 0 to 1
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uIsVideo;
      uniform float uGrainSeed;
      uniform sampler2D uGrainTex;
      uniform vec2 uImageSize;
      
      
      uniform float uHslH[8];
      uniform float uHslS[8];
      uniform float uHslL[8];
      uniform float uHslActive;
      
      uniform float uSplitShadowsHue;
      uniform float uSplitShadowsSat;
      uniform float uSplitHighlightsHue;
      uniform float uSplitHighlightsSat;
      uniform float uSplitBalance;
      uniform float uFade;
      uniform float uHalation;
      uniform float uLightLeak;
      uniform float uLeakSeed;
      uniform sampler2D uLeakNoiseTex;
      uniform float uBloom;
      uniform int uBorderMode;
      uniform float uBorderWidth;
            out vec4 fragColor;
      
      const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
      const float HUE_ANCHORS[9] = float[9](0.0, 0.0833, 0.1666, 0.3333, 0.5, 0.6666, 0.75, 0.8333, 1.0);
      
      vec3 rgb2hsl(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          float e = 1.0e-10;
          float l = q.x - d * 0.5;
          return clamp(vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (1.0 - abs(2.0 * l - 1.0) + 1e-6), l), 0.0, 1.0);
      }
      vec3 hsl2rgb(vec3 c) {
          vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
      }

      // Hash without Sine by Dave Hoskins (No diagonal artifacts)
      vec3 hash32(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
          p3 += dot(p3, p3.yxz+33.33);
          return fract((p3.xxy+p3.yzz)*p3.zyx);
      }
      
      ${FILM_GRAIN_GLSL}
      
      // Tetrahedral Interpolation for extreme accuracy (Filmic standard)
      vec3 sampleTetrahedral(sampler3D tex, vec3 c, float size) {
          vec3 rgb = clamp(c, 0.0, 1.0) * (size - 1.0);
          ivec3 idx0 = ivec3(floor(rgb));
          vec3 f = fract(rgb);
          ivec3 iSize = ivec3(int(size) - 1);
          
          idx0 = clamp(idx0, ivec3(0), iSize);
          
          vec3 c000 = texelFetch(tex, idx0, 0).rgb;
          
          vec3 c1, c2, c3;
          if (f.x > f.y) {
              if (f.y > f.z) {
                  c1 = texelFetch(tex, min(idx0 + ivec3(1, 0, 0), iSize), 0).rgb;
                  c2 = texelFetch(tex, min(idx0 + ivec3(1, 1, 0), iSize), 0).rgb;
                  c3 = texelFetch(tex, min(idx0 + ivec3(1, 1, 1), iSize), 0).rgb;
                  return (1.0 - f.x)*c000 + (f.x - f.y)*c1 + (f.y - f.z)*c2 + f.z*c3;
              } else if (f.x > f.z) {
                  c1 = texelFetch(tex, min(idx0 + ivec3(1, 0, 0), iSize), 0).rgb;
                  c2 = texelFetch(tex, min(idx0 + ivec3(1, 0, 1), iSize), 0).rgb;
                  c3 = texelFetch(tex, min(idx0 + ivec3(1, 1, 1), iSize), 0).rgb;
                  return (1.0 - f.x)*c000 + (f.x - f.z)*c1 + (f.z - f.y)*c2 + f.y*c3;
              } else {
                  c1 = texelFetch(tex, min(idx0 + ivec3(0, 0, 1), iSize), 0).rgb;
                  c2 = texelFetch(tex, min(idx0 + ivec3(1, 0, 1), iSize), 0).rgb;
                  c3 = texelFetch(tex, min(idx0 + ivec3(1, 1, 1), iSize), 0).rgb;
                  return (1.0 - f.z)*c000 + (f.z - f.x)*c1 + (f.x - f.y)*c2 + f.y*c3;
              }
          } else {
              if (f.z > f.y) {
                  c1 = texelFetch(tex, min(idx0 + ivec3(0, 0, 1), iSize), 0).rgb;
                  c2 = texelFetch(tex, min(idx0 + ivec3(0, 1, 1), iSize), 0).rgb;
                  c3 = texelFetch(tex, min(idx0 + ivec3(1, 1, 1), iSize), 0).rgb;
                  return (1.0 - f.z)*c000 + (f.z - f.y)*c1 + (f.y - f.x)*c2 + f.x*c3;
              } else if (f.z > f.x) {
                  c1 = texelFetch(tex, min(idx0 + ivec3(0, 1, 0), iSize), 0).rgb;
                  c2 = texelFetch(tex, min(idx0 + ivec3(0, 1, 1), iSize), 0).rgb;
                  c3 = texelFetch(tex, min(idx0 + ivec3(1, 1, 1), iSize), 0).rgb;
                  return (1.0 - f.y)*c000 + (f.y - f.z)*c1 + (f.z - f.x)*c2 + f.x*c3;
              } else {
                  c1 = texelFetch(tex, min(idx0 + ivec3(0, 1, 0), iSize), 0).rgb;
                  c2 = texelFetch(tex, min(idx0 + ivec3(1, 1, 0), iSize), 0).rgb;
                  c3 = texelFetch(tex, min(idx0 + ivec3(1, 1, 1), iSize), 0).rgb;
                  return (1.0 - f.y)*c000 + (f.y - f.x)*c1 + (f.x - f.z)*c2 + f.z*c3;
              }
          }
      }

      void main() {
        // [0] Vintage Lens Radial Chromatic Aberration (Wavelength Dispersion)
        // Red and Blue lights refract differently toward the peripheral elements of spherical lenses.
        vec4 sourcePixel = texture(uImage, vUv);
        vec3 rgb = sourcePixel.rgb;
        float alpha = sourcePixel.a;
        if (uDispersion > 0.0) {
            vec2 centerCA = vUv - 0.5;
            float distSq = dot(centerCA, centerCA);
            float caAmount = uDispersion * 0.025;
            vec2 uvR = vUv - centerCA * distSq * caAmount;
            vec2 uvB = vUv + centerCA * distSq * caAmount * 0.72;
            rgb.r = texture(uImage, uvR).r;
            rgb.b = texture(uImage, uvB).b;
        }
        
        // --- Convert sRGB to Linear Channel Energies ---
        vec3 linRGB = mix(rgb / 12.92, pow(max((rgb + 0.055) / 1.055, 1e-6), vec3(2.4)), step(0.04045, rgb));
        
        // [2] Film Emulsion Dye Coupling & Spectral Crosstalk
        // Simulates physical Red, Green, Blue sensitive emulsion layers with beautiful overlapping color responses.
        // It naturally shifts digital tones into sophisticated organic chemical hues.
        linRGB = max(linRGB, vec3(0.0));
        
        // [3] Linear exposure with a continuous highlight shoulder.
        // The neutral exposure remains an exact identity, so small slider changes do not jump.
        // Flicker adds a living physical cell breathing look, only activated when grain/emulsion texture is present.
        float gateFlicker = uIsVideo > 0.5
            ? (sin(uTime * 41.3) * cos(uTime * 17.9) * 0.075 + sin(uTime * 111.3) * 0.02) * uGrain
            : 0.0;
        float expMod = 1.0 + gateFlicker * 0.16;
        float expVal = pow(2.0, uExposure) * expMod;
        linRGB *= expVal;

        // White balance in linear light. Normalize the gains to preserve neutral luminance.
        if (uTemperature != 0.0 || uTint != 0.0) {
            float neutralLuma = dot(linRGB, LUMA);
            vec3 wbGain = exp2(vec3(
                uTemperature * 0.65 + uTint * 0.18,
                -uTint * 0.45,
                -uTemperature * 0.65 + uTint * 0.18
            ));
            linRGB *= wbGain;
            float balancedLuma = dot(linRGB, LUMA);
            if (balancedLuma > 1e-6) linRGB *= neutralLuma / balancedLuma;
        }

        // Positive exposure gets a soft shoulder, smoothly approaching the neutral identity.
        float shoulder = max(uExposure, 0.0) * 0.12;
        linRGB /= 1.0 + linRGB * shoulder;
        
        // [6] Professional Film Coupler Color Chemistry Profiles
        linRGB = max(linRGB, vec3(0.0));
        
        // [7] Perceptual Emulsion Encoding (Linear to Gamma)
        vec3 percRGB = mix(linRGB * 12.92, 1.055 * pow(max(linRGB, 1e-6), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, linRGB));
        percRGB = clamp(percRGB, 0.0, 1.0);
        
        // 3. Tone Mapping: Shadows & Highlights (Parametric Zone Curve Solver)
        float luma = dot(percRGB, LUMA);
        float newLuma = luma;
        
        // Highlights Recovery or Push (Smooth Bezier Bending)
        if (uHighlights < 0.0) {
            float hWeight = smoothstep(0.2, 1.0, luma);
            newLuma += uHighlights * hWeight * luma * (1.25 - luma * 0.25) * 0.72;
        } else if (uHighlights > 0.0) {
            float hWeight = smoothstep(0.3, 1.0, luma);
            newLuma += uHighlights * hWeight * (1.0 - luma) * 0.45;
        }
        
        // Shadows Lift or Crush (Parametric Low-End Curve)
        if (uShadows > 0.0) {
            float sWeight = 1.0 - smoothstep(0.0, 0.8, luma);
            newLuma += uShadows * sWeight * (1.15 - luma) * 0.38;
        } else if (uShadows < 0.0) {
            float sWeight = 1.0 - smoothstep(0.0, 0.75, luma);
            newLuma += uShadows * sWeight * luma * 0.52;
        }
        
        // Scale color proportionally to preserve exact Hue and Saturation
        if (luma > 0.001) {
            percRGB *= (max(0.0, newLuma) / luma);
        }
        
        percRGB = clamp(percRGB, 0.0, 1.0);
        
        // 4. Contrast: Professional Hurter-Driffield (H-D) Characteristic S-Curve
        // Rather than simple digital contrast (which clips details), we apply a parametric 
        // double-sigmoid curve. This ensures high-contrast looks retain organic, soft 
        // highlights (Shoulder) and protected, velvety shadows (Toe).
        vec3 tRgb = clamp(percRGB, 0.0, 1.0);
        // At uContrast=1, power=1 and this curve is the identity. Both slider directions
        // approach it continuously, without the former discontinuity around zero.
        float power = pow(1.72, uContrast - 1.0);
        vec3 powX = pow(tRgb, vec3(power));
        vec3 powOneX = pow(max(vec3(0.0), 1.0 - tRgb), vec3(power));
        vec3 S_curveColor = powX / max(powX + powOneX, vec3(1e-6));
        percRGB = clamp(S_curveColor, 0.0, 1.0);
        
        // 5. Saturation (Vibrance-style)
        float curLuma = dot(percRGB, LUMA);
        if (uSaturation > 1.0) {
            vec3 satDiff = percRGB - vec3(curLuma);
            float maxSat = max(max(abs(satDiff.r), abs(satDiff.g)), abs(satDiff.b));
            float damp = 1.0 - clamp(maxSat * 1.5, 0.0, 1.0);
            percRGB = vec3(curLuma) + satDiff * (1.0 + (uSaturation - 1.0) * damp * 2.0);
        } else {
            percRGB = mix(vec3(curLuma), percRGB, uSaturation);
        }
        
        rgb = clamp(percRGB, 0.0, 1.0);

        // 5.5. HSL Color Adjustments
        if (uHslActive > 0.0) {
          vec3 hsl = rgb2hsl(rgb);
        float h = fract(hsl.x); // ensure 0..1
        
        const float HUE_CENTERS[8] = float[8](0.0, 0.0833, 0.1666, 0.3333, 0.5, 0.6666, 0.75, 0.8333);
        // Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta
        // Defines the influence width for each color band. We use varying widths because some color bands (like Orange/Yellow) are narrower in perception.
        const float HUE_WIDTHS[8]  = float[8](0.10, 0.06, 0.08, 0.15, 0.12, 0.12, 0.10, 0.12);
        
        float shiftH = 0.0;
        float shiftS = 0.0;
        float shiftL = 0.0;
        
        float totalW = 0.0001; // prevent divide by zero
        
        // Branchless overlapping Gaussian weights
        for(int i=0; i<8; i++) {
            float dist = abs(fract(h - HUE_CENTERS[i] + 0.5) - 0.5);
            // Smooth bell curve based on distance and specific width
            float w = 1.0 - smoothstep(0.0, HUE_WIDTHS[i] * 2.5, dist);
            
            shiftH += uHslH[i] * w;
            shiftS += uHslS[i] * w;
            shiftL += uHslL[i] * w;
            totalW += w;
        }
        
        // Normalize
        shiftH /= totalW;
        shiftS /= totalW;
        shiftL /= totalW;
        
        // Protect grayscales and extreme shadows/highlights from erratic shifts (Perceptual Masking)
        // Using smoothstep to taper off adjustments near pure black/white and pure gray.
        float satWeight = smoothstep(0.0, 0.1, hsl.y);
        float lumaWeight = smoothstep(0.0, 0.08, hsl.z) * (1.0 - smoothstep(0.92, 1.0, hsl.z));
        float totalWeight = satWeight * lumaWeight;
        
        hsl.x = fract(hsl.x + shiftH * totalWeight + 1.0);
        
        // Relative smooth saturation blending
        if (shiftS < 0.0) {
            hsl.y = hsl.y * (1.0 + shiftS * totalWeight);
        } else {
            hsl.y = hsl.y + (1.0 - hsl.y) * shiftS * totalWeight;
        }
        
        // Relative smooth lightness blending in HSL space
        if (shiftL < 0.0) {
            hsl.z = hsl.z * (1.0 + shiftL * totalWeight);
        } else {
            hsl.z = hsl.z + (1.0 - hsl.z) * shiftL * totalWeight;
        }
        
        rgb = hsl2rgb(hsl);
        rgb = clamp(rgb, 0.0, 1.0);
        }
        
        // 5.6 Split Toning
        if (uSplitShadowsSat > 0.0 || uSplitHighlightsSat > 0.0) {
            float curL = dot(rgb, LUMA);
            float bLuma = clamp(curL + uSplitBalance * 0.5, 0.0, 1.0);
            
            float shadowT = 1.0 - smoothstep(0.0, 0.5, bLuma);
            float highT = smoothstep(0.5, 1.0, bLuma);
            
            vec3 shadowTint = hsl2rgb(vec3(uSplitShadowsHue, uSplitShadowsSat, 0.5));
            vec3 highTint = hsl2rgb(vec3(uSplitHighlightsHue, uSplitHighlightsSat, 0.5));
            
            vec3 tintedShadows = mix(rgb, rgb * shadowTint * 2.0, uSplitShadowsSat);
            vec3 tintedHighs = mix(rgb, 1.0 - 2.0 * (1.0 - rgb) * (1.0 - highTint), uSplitHighlightsSat);
            
            rgb = mix(rgb, tintedShadows, shadowT);
            rgb = mix(rgb, tintedHighs, highT);
            
            // Preserve rough luminance
            float newL = dot(rgb, LUMA);
            if (newL > 0.001) rgb *= (curL / newL);
            rgb = clamp(rgb, 0.0, 1.0);
        }
        
        // 5.7 Fade
        if (uFade > 0.0) {
            vec3 lifted = rgb * (1.0 - uFade * 0.3) + vec3(uFade * 0.15);
            rgb = mix(rgb, lifted, uFade);
        }
        
        // 6. Apply 3D LUT via Tetrahedral Interpolation
        if (uLutSize > 0.0 && uIntensity > 0.0) {
          vec3 lutColor = sampleTetrahedral(uLut, rgb, uLutSize);
          
          // 4D Interpolation (H-D Curve Family Simulation)
          if (uLut2Size > 0.0) {
              vec3 lutColor2 = sampleTetrahedral(uLut2, rgb, uLut2Size);
              
              // Interpolating in Optical Density space (D = -log(T)) perfectly simulates 
              // the non-linear shift of the Hurter-Driffield (H-D) curve across exposure stops.
              // This is mathematically equivalent to geometric interpolation.
              vec3 c1 = max(lutColor, vec3(1e-5));
              vec3 c2 = max(lutColor2, vec3(1e-5));
              lutColor = pow(c1, vec3(1.0 - uLut4DAxis)) * pow(c2, vec3(uLut4DAxis));
          }
          
          rgb = mix(rgb, lutColor, uIntensity);
        }
        
        vec2 uvScreen = gl_FragCoord.xy / uResolution.xy;
        
        // 7. Vignette & Organic Film Light Leaks (Linked beautifully to uHalation)
        if (uVignette > 0.0) {
          vec2 center = uvScreen - 0.5;
          float aspect = uResolution.x / uResolution.y;
          center.x *= aspect; 
          float dist = length(center); 
          
          // Lens Optical Exposure Falloff (exp2 decay simulating cos^4 light loss)
          float evDrop = uVignette * dist * dist * 1.95;
          float falloff = exp2(-evDrop);
          
          // Vintage glass pigment dispersion (tint fringes in peripheral elements)
          vec3 glassTint = mix(vec3(1.0), vec3(0.975, 0.948, 0.982), uVignette * dist * 0.65);
          rgb *= falloff * glassTint;
        }

        // Realistic Film Light Leak (noise texture + randomized mask + color mixing)
        if (uLightLeak > 0.0) {
            // Rotate UV for per-photo variation
            float angle = uLeakSeed * 6.2832;
            vec2 rotUV = vec2(
                uvScreen.x * cos(angle) - uvScreen.y * sin(angle),
                uvScreen.x * sin(angle) + uvScreen.y * cos(angle)
            );
            vec2 leakUV = rotUV * 1.5 + uLeakSeed * 0.5;
            if (uIsVideo > 0.5) {
                leakUV += vec2(0.02, -0.01) * uTime;
            }

            // Multi-scale organic noise from 2D texture
            float n1 = texture(uLeakNoiseTex, leakUV).r;
            float n2 = texture(uLeakNoiseTex, rotUV * 3.0 + uLeakSeed * 1.3).r;
            float n3 = texture(uLeakNoiseTex, rotUV * 0.7 + uLeakSeed * 2.1).r;
            float leakNoise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

            // Spatial mask rotated by seed
            float maskA = smoothstep(0.0, 0.6, 1.0 - rotUV.x) * smoothstep(0.0, 0.8, rotUV.y);
            float maskB = smoothstep(0.0, 0.5, rotUV.x) * smoothstep(0.0, 0.5, 1.0 - rotUV.y);
            float leakSpatialMask = max(maskA, maskB);

            float leakIntensity = smoothstep(0.3, 0.85, leakNoise * leakSpatialMask) * uLightLeak * 0.35;

            // Warm dye spectrum
            vec3 warm0 = vec3(1.0, 0.15, 0.02);
            vec3 warm1 = vec3(1.0, 0.52, 0.05);
            vec3 warm2 = vec3(1.0, 0.90, 0.35);
            float wt = smoothstep(0.15, 0.65, leakIntensity);
            vec3 warm = mix(warm0, warm1, wt);
            warm = mix(warm, warm2, smoothstep(0.65, 0.95, leakIntensity));

            // Cool dye spectrum (mixed by seed for variety)
            vec3 cool0 = vec3(0.6, 0.10, 0.80);
            vec3 cool1 = vec3(0.2, 0.40, 1.0);
            vec3 cool2 = vec3(0.5, 0.80, 1.0);
            vec3 cool = mix(cool0, cool1, wt);
            cool = mix(cool, cool2, smoothstep(0.65, 0.95, leakIntensity));

            vec3 leakSpectrum = mix(warm, cool, uLeakSeed);

            // Shadow-dodge additive blend
            float lumaOfImage = dot(rgb, LUMA);
            float shadowDodgeFactor = 1.0 - (lumaOfImage * 0.65);
            rgb += leakSpectrum * leakIntensity * shadowDodgeFactor;
            rgb = clamp(rgb, 0.0, 1.0);
        }

        // Halation & Bloom approximation (golden-angle spiral wavelength-dependent optical dispersion for premium analog lens feel)
        if (uHalation > 0.0 || uBloom > 0.0) {
            vec2 texel = 1.0 / uResolution;
            vec3 bloomAccum = vec3(0.0);
            vec3 mistAccum = vec3(0.0);
            vec3 halationAccum = vec3(0.0);
            float totalWeight = 0.0;
            
            // An 8-tap golden-angle spiral gives a good preview/export balance.
            // By spiraling outwards, we sample multiple concentric circles,
            // blending high, mid, and low frequency light bleeds perfectly
            // without creating ugly linear ghosting or cheap ring artifacts.
            float goldenAngle = 2.39996;
            
            float bloomRadius = 2.0 + uBloom * 18.0;
            float halationRadius = 1.5 + uHalation * 10.0;
            
            for (int i = 0; i < 8; i++) {
                float t = float(i) / 7.0;
                float angle = float(i) * goldenAngle;
                float r = sqrt(t); // Concentric distribution
                vec2 dir = vec2(cos(angle), sin(angle)) * r;
                
                // Weight according to a smooth Gaussian-like curve
                float w = exp(-r * r * 2.5);
                totalWeight += w;
                
                if (uBloom > 0.0) {
                    vec2 bloomOffset = dir * texel * bloomRadius;
                    vec3 bloomSample = texture(uImage, vUv + bloomOffset).rgb;
                    float lmxB = dot(bloomSample, LUMA);
                    float hltB = pow(smoothstep(0.55, 0.90, lmxB), 2.0);
                    bloomAccum += bloomSample * hltB * w;
                    mistAccum += bloomSample * w;
                }

                if (uHalation > 0.0) {
                    // Different channel radii reproduce the original wavelength diffusion.
                    vec2 sampleOffsetR = dir * texel * halationRadius * 1.5;
                    vec2 sampleOffsetG = dir * texel * halationRadius * 0.6;
                    vec2 sampleOffsetB = dir * texel * halationRadius * 0.25;
                    vec3 halSample = vec3(
                        texture(uImage, vUv + sampleOffsetR).r,
                        texture(uImage, vUv + sampleOffsetG).g,
                        texture(uImage, vUv + sampleOffsetB).b
                    );
                    float lmx = dot(halSample, LUMA);
                    float hlt = pow(smoothstep(0.48, 0.95, lmx), 1.6);
                    halationAccum += halSample * hlt * w;
                }
            }
            
            vec3 finalBloom = bloomAccum / totalWeight;
            vec3 finalMist = mistAccum / totalWeight;
            vec3 finalHalation = halationAccum / totalWeight;
            
            if (uHalation > 0.0) {
                // Precise chemical film substrate scattering tint: luminous, warm peach-red
                vec3 halationTint = vec3(1.0, 0.22, 0.06);
                vec3 glow = finalHalation * halationTint * uHalation * 4.5;
                rgb += glow;
                
                // Substrate scatter absorption subtracts slightly from green/blue channels in glowing spots
                float haloLuma = dot(finalHalation, LUMA);
                rgb.g = mix(rgb.g, rgb.g * (1.0 - haloLuma * uHalation * 0.15), uHalation);
                rgb.b = mix(rgb.b, rgb.b * (1.0 - haloLuma * uHalation * 0.28), uHalation);
            }
            
            if (uBloom > 0.0) {
                // Low-contrast lens mist focus softening to simulate vintage bloom aesthetics
                rgb = mix(rgb, finalMist, uBloom * 0.22);
                
                // Adds a beautiful, misty glow around highlights
                vec3 bloomGlow = finalBloom * uBloom * 0.8;
                rgb += bloomGlow;
                
                // Gently compress/reduce the overall exposure as bloom rises to keep balanced luminance
                rgb *= (1.0 - uBloom * 0.12);
            }
        }
        
        // 8. Grain (Film Grain - deterministic for stills, animated for video)
        if (uGrain > 0.0) {
            // For still images the grain is locked to a fixed seed so exporting and
            // slider adjustments do not change the pattern. Video/camera mode uses 24 FPS time.
            float filmTime = uIsVideo > 0.5 ? floor(uTime * 24.0) * 1.337 : uGrainSeed;

            // Bind grain to image UV space instead of screen pixels.
            vec2 grainCoord = (uImageSize.x > 0.0 && uImageSize.y > 0.0)
                ? (vUv * uImageSize)
                : gl_FragCoord.xy;
            rgb = applyFilmGrain(rgb, grainCoord, uGrain, uGrainSize, uGrainType, filmTime);

            // Transient dust/fibers only in video/camera mode so still exports stay clean.
            if (uIsVideo > 0.5) {
                float flawRng = hash32(vec2(filmTime * 13.9, filmTime * 31.7)).r;
                if (flawRng < 0.16) {
                    vec2 flawCenter = hash32(vec2(filmTime * 19.3, filmTime * 73.1)).xy;

                    float distToDust = length(uvScreen - flawCenter);
                    float dustSpeck = smoothstep(0.00065, 0.00095, distToDust);

                    vec2 fiberCoords = (uvScreen - flawCenter) * vec2(1.0, uResolution.y / uResolution.x);
                    float fiberLine = abs(fiberCoords.y - sin(fiberCoords.x * 15.0) * 0.012 - fiberCoords.x * 0.6);
                    float fiberMask = smoothstep(0.0003, 0.0005, fiberLine) + (1.0 - smoothstep(0.0, 0.02, length(fiberCoords)));

                    float flawIntensity = (1.0 - dustSpeck) * 0.6 + (1.0 - clamp(fiberMask, 0.0, 1.0)) * 0.38;
                    vec3 dustColor = vec3(0.04, 0.03, 0.02);
                    rgb = mix(rgb, dustColor, flawIntensity * uGrain * 0.75);
                }
            }
        }
        
        // 9. Paper Edge Simulation & Aging Stain
        if (uBorderMode > 0 && uBorderWidth > 0.0) {
            float aspect = uResolution.x / uResolution.y;
            vec2 thickness = vec2(uBorderWidth);
            if (aspect > 1.0) {
               thickness.x = uBorderWidth / aspect;
            } else {
               thickness.y = uBorderWidth * aspect;
            }
            
            vec3 borderColor = vec3(1.0); // White base
            if (uBorderMode == 2) borderColor = vec3(0.0); // Black
            if (uBorderMode == 3) borderColor = vec3(0.02); // Film Matte
            
            // Recreate organic look of photo paper: fiber texture and edge rough deckles
            if (uBorderMode == 1) {
                // Generates high-frequency micro paper fiber noise
                float fiberNoise = hash32(gl_FragCoord.xy * 0.12).r * 0.05 + hash32(gl_FragCoord.xy * 0.43).r * 0.02;
                // Off-white/cream aged color tint for vintage silver halide photo prints
                borderColor = vec3(0.975, 0.965, 0.94) + vec3(fiberNoise);
            }
            
            if (uBorderMode == 3) {
                vec2 center = vec2(0.5);
                vec2 size = vec2(0.5) - thickness;
                // Correct for aspect ratio in SDF calculation
                vec2 p = uvScreen - center;
                p.x *= aspect;
                size.x *= aspect;
                vec2 d = abs(p) - size;
                float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
                float radius = thickness.y * 3.0; // corner radius based on thickness
                float mask = 1.0 - smoothstep(radius - 0.0015, radius + 0.0015, dist);
                rgb = mix(borderColor, rgb, mask);
            } else {
                float maskX = smoothstep(thickness.x, thickness.x + 0.0012, uvScreen.x) * (1.0 - smoothstep(1.0 - thickness.x - 0.0012, 1.0 - thickness.x, uvScreen.x));
                float maskY = smoothstep(thickness.y, thickness.y + 0.0012, uvScreen.y) * (1.0 - smoothstep(1.0 - thickness.y - 0.0012, 1.0 - thickness.y, uvScreen.y));
                float mask = maskX * maskY;

                rgb = mix(borderColor, rgb, mask);
            }
        }
        
        fragColor = vec4(rgb, alpha);
      }
    `;
    
    const vShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    const prog = gl.createProgram();
    if (!prog) throw new Error("Failed to create WebGL program");
    
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    gl.deleteShader(vShader);
    gl.deleteShader(fShader);
    
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const reason = gl.getProgramInfoLog(prog) || (gl.isContextLost() ? 'WebGL context lost' : 'Program link failed');
      gl.deleteProgram(prog);
      throw new Error(reason);
    }
    
    return prog;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const reason = gl.getShaderInfoLog(shader) || (gl.isContextLost() ? 'WebGL context lost' : 'Shader compile failed');
      gl.deleteShader(shader);
      throw new Error(reason);
    }
    return shader;
  }

  public setRenderScale(maxDimension: number) {
    this.renderMaxDimension = maxDimension;
  }

  public setImage(image: HTMLImageElement | HTMLVideoElement, width: number, height: number) {
    this.originalWidth = width;
    this.originalHeight = height;
    this.prevParams = {};
    this.uniformsInited = false;
    this.prevHslActive = false;
    this.prevHslH = null;
    this.prevHslS = null;
    this.prevHslL = null;
    this.texturesDirty = true;
    
    const maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
    const maxDimension = Math.min(this.renderMaxDimension || maxTextureSize, maxTextureSize);
    this.renderScale = 1;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        this.renderScale = maxDimension / width;
      } else {
        this.renderScale = maxDimension / height;
      }
    }
    
    const gl = this.gl;
    if (this.imageTexture) gl.deleteTexture(this.imageTexture);
    
    const canvasW = Math.max(1, Math.round(width * this.renderScale));
    const canvasH = Math.max(1, Math.round(height * this.renderScale));
    this.canvas.width = canvasW;
    this.canvas.height = canvasH;
    gl.viewport(0, 0, canvasW, canvasH);

    this.imageTexture = gl.createTexture();
    if (!this.imageTexture) { console.warn("[WebGL] Failed to create image texture"); return; }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    
    // Match the uploaded texture to preview size instead of keeping a full-size GPU copy.
    // Video keeps its source dimensions so updateTexture can replace its frames.
    let source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement = image;
    if (image instanceof HTMLImageElement && this.renderScale < 1) {
      const scaled = document.createElement('canvas');
      scaled.width = canvasW;
      scaled.height = canvasH;
      const ctx = scaled.getContext('2d');
      if (!ctx) throw new Error('Could not resize image for WebGL');
      ctx.drawImage(image, 0, 0, canvasW, canvasH);
      source = scaled;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); // Keep original orientation
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    checkGlError(gl, "texImage2D");
    
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  public updateTexture(video: HTMLVideoElement) {
    const gl = this.gl;
    if (!this.imageTexture) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
  }

  public setLUT(size: number, data: Float32Array) {
    if (!(data instanceof Float32Array)) data = new Float32Array(data);
    const gl = this.gl;
    if (size <= 0) {
      if (this.lutTexture) gl.deleteTexture(this.lutTexture);
      this.lutTexture = null;
      this.lutData = null;
      this.lutSize = 0;
      this.texturesDirty = true;
      gl.useProgram(this.program);
      gl.uniform1f(this.lutSizeLoc, 0);
      return;
    }
    if (data.length !== size * size * size * 3) throw new Error('Invalid LUT data size');
    if (this.lutData === data && this.lutSize === size) return;
    this.texturesDirty = true;

    gl.useProgram(this.program);
    gl.uniform1f(this.lutSizeLoc, size);

    if (this.lutTexture && this.lutSize === size) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
      gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, size, size, size, gl.RGB, gl.FLOAT, data);
    } else {
      if (this.lutTexture) gl.deleteTexture(this.lutTexture);
      this.lutTexture = gl.createTexture();
      if (!this.lutTexture) { console.warn("[WebGL] Failed to create LUT texture"); return; }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB32F, size, size, size, 0, gl.RGB, gl.FLOAT, data);
      checkGlError(gl, "texImage3D(LUT)");
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
      this.lutSize = size;
    }
    this.lutData = data;
  }

  public setLUT2(size: number, data: Float32Array | null) {
    if (data && !(data instanceof Float32Array)) data = new Float32Array(data);
    const gl = this.gl;
    if (this.lut2Texture) gl.deleteTexture(this.lut2Texture);
    this.texturesDirty = true;
    
    gl.useProgram(this.program);
    if (!data) {
        gl.uniform1f(this.lut2SizeLoc, 0.0);
        this.lut2Texture = null;
        return;
    }
    gl.uniform1f(this.lut2SizeLoc, size);

    this.lut2Texture = gl.createTexture();
    if (!this.lut2Texture) { console.warn("[WebGL] Failed to create LUT2 texture"); return; }
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_3D, this.lut2Texture);
    
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB32F, size, size, size, 0, gl.RGB, gl.FLOAT, data);
    checkGlError(gl, "texImage3D(LUT2)");
    
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  }

  private prevParams: Partial<RenderParams> = {};
  private uniformsInited = false;
  private prevHslActive = false;

  public render(params: RenderParams) {
    const {
      exposure, contrast, intensity, temperature, tint, shadows, highlights,
      saturation, vignette, grain, grainSize, grainType, halation,
      lightLeak, bloom, hslH, hslS, hslL, splitShadowsHue, splitShadowsSat,
      splitHighlightsHue, splitHighlightsSat, splitBalance, fade, time,
      borderMode, borderWidth, lut4DAxis, dispersion, isVideo,
      grainSeed, leakSeed,
    } = params;
    const gl = this.gl;
    if (!this.imageTexture) return;
    const p = this.prevParams;

    if (exposure !== p.exposure) { gl.uniform1f(this.exposureLoc, exposure); p.exposure = exposure; }
    if (contrast !== p.contrast) { gl.uniform1f(this.contrastLoc, contrast); p.contrast = contrast; }
    if (intensity !== p.intensity) { gl.uniform1f(this.intensityLoc, intensity); p.intensity = intensity; }
    if (temperature !== p.temperature) { gl.uniform1f(this.temperatureLoc, temperature); p.temperature = temperature; }
    if (tint !== p.tint) { gl.uniform1f(this.tintLoc, tint); p.tint = tint; }
    if (shadows !== p.shadows) { gl.uniform1f(this.shadowsLoc, shadows); p.shadows = shadows; }
    if (highlights !== p.highlights) { gl.uniform1f(this.highlightsLoc, highlights); p.highlights = highlights; }
    if (saturation !== p.saturation) { gl.uniform1f(this.saturationLoc, saturation); p.saturation = saturation; }
    if (vignette !== p.vignette) { gl.uniform1f(this.vignetteLoc, vignette); p.vignette = vignette; }
    if (dispersion !== p.dispersion) { gl.uniform1f(this.dispersionLoc, dispersion); p.dispersion = dispersion; }
    if (grain !== p.grain) { gl.uniform1f(this.grainLoc, grain); p.grain = grain; }
    if (grainSize !== p.grainSize) { gl.uniform1f(this.grainSizeLoc, grainSize ?? 1); p.grainSize = grainSize; }
    if (grainType !== p.grainType) { gl.uniform1f(this.grainTypeLoc, grainType ?? 1); p.grainType = grainType; }
    if (time !== p.time) { gl.uniform1f(this.timeLoc, time); p.time = time; }
    if (isVideo !== p.isVideo) { gl.uniform1f(this.isVideoLoc, isVideo ? 1.0 : 0.0); p.isVideo = isVideo; }
    const stableGrainSeed = grainSeed ?? 1.337;
    if (stableGrainSeed !== p.grainSeed) { gl.uniform1f(this.grainSeedLoc, stableGrainSeed); p.grainSeed = stableGrainSeed; }
    const stableLeakSeed = leakSeed ?? 0.337;
    if (stableLeakSeed !== p.leakSeed) { gl.uniform1f(this.leakSeedLoc, stableLeakSeed); p.leakSeed = stableLeakSeed; }
    if (lightLeak !== p.lightLeak) { gl.uniform1f(this.lightLeakLoc, lightLeak); p.lightLeak = lightLeak; }
    if (halation !== p.halation) { gl.uniform1f(this.halationLoc, halation); p.halation = halation; }
    if (bloom !== p.bloom) { gl.uniform1f(this.bloomLoc, bloom); p.bloom = bloom; }
    if (splitShadowsHue !== p.splitShadowsHue) { gl.uniform1f(this.splitShadowsHueLoc, splitShadowsHue); p.splitShadowsHue = splitShadowsHue; }
    if (splitShadowsSat !== p.splitShadowsSat) { gl.uniform1f(this.splitShadowsSatLoc, splitShadowsSat); p.splitShadowsSat = splitShadowsSat; }
    if (splitHighlightsHue !== p.splitHighlightsHue) { gl.uniform1f(this.splitHighlightsHueLoc, splitHighlightsHue); p.splitHighlightsHue = splitHighlightsHue; }
    if (splitHighlightsSat !== p.splitHighlightsSat) { gl.uniform1f(this.splitHighlightsSatLoc, splitHighlightsSat); p.splitHighlightsSat = splitHighlightsSat; }
    if (splitBalance !== p.splitBalance) { gl.uniform1f(this.splitBalanceLoc, splitBalance); p.splitBalance = splitBalance; }
    if (fade !== p.fade) { gl.uniform1f(this.fadeLoc, fade); p.fade = fade; }
    if (borderMode !== p.borderMode) { gl.uniform1i(this.borderModeLoc, borderMode); p.borderMode = borderMode; }
    if (borderWidth !== p.borderWidth) { gl.uniform1f(this.borderWidthLoc, borderWidth); p.borderWidth = borderWidth; }
    if (lut4DAxis !== p.lut4DAxis) { gl.uniform1f(this.lut4DAxisLoc, lut4DAxis); p.lut4DAxis = lut4DAxis; }

    if (!this.uniformsInited) {
      gl.uniform2f(this.imageSizeLoc, this.originalWidth, this.originalHeight);
      gl.uniform2f(this.resolutionLoc, this.canvas.width, this.canvas.height);
      this.uniformsInited = true;
    }

    // Compute hslActive guard: skip HSL shader block when all values are zero
    const hslActive = hslH.some(v => v !== 0) || hslS.some(v => v !== 0) || hslL.some(v => v !== 0);
    if (hslActive !== this.prevHslActive) { gl.uniform1f(this.hslActiveLoc, hslActive ? 1.0 : 0.0); this.prevHslActive = hslActive; }

    // Keep snapshots: live sliders reuse and mutate their Float32Array buffers.
    this.prevHslH = this.updateHslUniform(this.hslHLoc, hslH, this.prevHslH);
    this.prevHslS = this.updateHslUniform(this.hslSLoc, hslS, this.prevHslS);
    this.prevHslL = this.updateHslUniform(this.hslLLoc, hslL, this.prevHslL);

    // --- Single-pass render (halation uses in-shader golden-angle spiral) ---
    if (this.texturesDirty) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.imageTexture);
      if (this.lutTexture) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_3D, this.lutTexture);
      }
      if (this.lut2Texture) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_3D, this.lut2Texture);
      }
      this.texturesDirty = false;
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private updateHslUniform(location: WebGLUniformLocation | null, values: Float32Array, previous: Float32Array | null): Float32Array {
    if (!previous || previous.length !== values.length) {
      this.gl.uniform1fv(location, values);
      return values.slice();
    }
    if (values.some((value, index) => value !== previous[index])) {
      this.gl.uniform1fv(location, values);
      previous.set(values);
    }
    return previous;
  }

  private generateNoiseTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const size = 256;
    const gridSize = 32;
    // Generate grid of random values
    const grid: number[][] = [];
    for (let gy = 0; gy <= gridSize; gy++) {
      grid[gy] = [];
      for (let gx = 0; gx <= gridSize; gx++) {
        grid[gy][gx] = Math.random();
      }
    }
    const data = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * gridSize;
        const gy = (y / size) * gridSize;
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        const fx = gx - ix;
        const fy = gy - iy;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const v = grid[iy][ix] * (1 - sx) * (1 - sy)
                + grid[iy][ix + 1] * sx * (1 - sy)
                + grid[iy + 1][ix] * (1 - sx) * sy
                + grid[iy + 1][ix + 1] * sx * sy;
        data[y * size + x] = (v * 255) | 0;
      }
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  private generateGrainTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create grain texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    createGrainAtlas().forEach(({ size, data }, level) => {
      gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return texture;
  }

  public exportToDataURL(params: RenderParams, type: string = 'image/jpeg', quality: number = 0.95): string {
    if (!this.imageTexture) throw new Error("No image loaded for export");
    this.render(params);
    return this.canvas.toDataURL(type, quality);
  }

  public exportToBlob(params: RenderParams, type: string = 'image/jpeg', quality: number = 0.95): Promise<Blob> {
    if (!this.imageTexture) return Promise.reject(new Error('No image loaded for export'));
    this.render(params);
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image encoding failed')), type, quality);
    });
  }

  public dispose() {
    const gl = this.gl;
    if (this.imageTexture) gl.deleteTexture(this.imageTexture);
    if (this.lutTexture) gl.deleteTexture(this.lutTexture);
    if (this.lut2Texture) gl.deleteTexture(this.lut2Texture);
    if (this.leakTexture) gl.deleteTexture(this.leakTexture);
    if (this.grainTex) gl.deleteTexture(this.grainTex);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.uvBuffer) gl.deleteBuffer(this.uvBuffer);
    gl.deleteProgram(this.program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
