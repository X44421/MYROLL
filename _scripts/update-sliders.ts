import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Inject bypass states
if (!content.includes('const [enableLuts')) {
  content = content.replace(
    'const [isBeforeView, setIsBeforeView] = useState(false);',
    'const [isBeforeView, setIsBeforeView] = useState(false);\n  const [enableLuts, setEnableLuts] = useState(true);\n  const [enableLight, setEnableLight] = useState(true);\n  const [enableColor, setEnableColor] = useState(true);\n  const [enableEffects, setEnableEffects] = useState(true);'
  );
}

content = content.replace(
    'processor.render(s.exposure, s.contrast, activeLut ? s.intensity : 0, s.temperature, s.tint, s.shadows, s.highlights, s.saturation, s.vignette, s.grain, s.sharpen, s.halation, s.bloom, s.hslH, s.hslS, s.hslL, s.splitShadowsHue, s.splitShadowsSat, s.splitHighlightsHue, s.splitHighlightsSat, s.splitBalance, s.fade, performance.now() / 1000.0, s.cropRatio, s.borderMode, s.borderWidth, s.is4DMode ? s.lut4DAxis : 0);',
    'processor.render(s.enableLight ? s.exposure : 0, s.enableLight ? s.contrast : 1, (activeLut && s.enableLuts) ? s.intensity : 0, s.enableColor ? s.temperature : 0, s.enableColor ? s.tint : 0, s.enableLight ? s.shadows : 0, s.enableLight ? s.highlights : 0, s.enableColor ? s.saturation : 1, s.enableEffects ? s.vignette : 0, s.enableEffects ? s.grain : 0, s.enableEffects ? s.sharpen : 0, s.enableEffects ? s.halation : 0, s.enableEffects ? s.bloom : 0, s.enableColor ? s.hslH : new Float32Array(8), s.enableColor ? s.hslS : new Float32Array(8), s.enableColor ? s.hslL : new Float32Array(8), s.splitShadowsHue, s.enableColor ? s.splitShadowsSat : 0, s.splitHighlightsHue, s.enableColor ? s.splitHighlightsSat : 0, s.enableColor ? s.splitBalance : 0, s.enableLight ? s.fade : 0, performance.now() / 1000.0, s.cropRatio, s.enableEffects ? s.borderMode : 0, s.enableEffects ? s.borderWidth : 0, s.is4DMode ? s.lut4DAxis : 0);'
);

content = content.replace(
    /settingsRef\.current = \{ exposure, contrast,([^}]*)\};/g,
    'settingsRef.current = { exposure, contrast,$1, enableLuts, enableLight, enableColor, enableEffects };'
);

content = content.replace(
    /const settingsRef = useRef\(\{ exposure, contrast,([^}]*)\}\);/g,
    'const settingsRef = useRef({ exposure, contrast,$1, enableLuts, enableLight, enableColor, enableEffects });'
);

// Add dependencies to both useEffects that depend on these states
content = content.replace(
    /activeLutId, luts, isBeforeView\]\);/g,
    'activeLutId, luts, isBeforeView, enableLuts, enableLight, enableColor, enableEffects]);'
);


// We need to inject them into the main `useEffect` render
const renderHookTarget = `        processor.render(
          exposure, 
          contrast, 
          activeLut ? intensity : 0,
          temperature,
          tint,
          shadows,
          highlights,
          saturation,
          vignette,
          grain,
          sharpen,
          halation,
          bloom,
          hslH,
          hslS,
          hslL,
          splitShadowsHue,
          splitShadowsSat,
          splitHighlightsHue,
          splitHighlightsSat,
          splitBalance,
          fade,
          performance.now() / 1000.0,
          cropRatio,
          borderMode,
          borderWidth,
          is4DMode ? lut4DAxis : 0
        );`;
const renderHookReplacement = `        processor.render(
          enableLight ? exposure : 0, 
          enableLight ? contrast : 1, 
          (activeLut && enableLuts) ? intensity : 0,
          enableColor ? temperature : 0,
          enableColor ? tint : 0,
          enableLight ? shadows : 0,
          enableLight ? highlights : 0,
          enableColor ? saturation : 1,
          enableEffects ? vignette : 0,
          enableEffects ? grain : 0,
          enableEffects ? sharpen : 0,
          enableEffects ? halation : 0,
          enableEffects ? bloom : 0,
          enableColor ? hslH : new Float32Array(8),
          enableColor ? hslS : new Float32Array(8),
          enableColor ? hslL : new Float32Array(8),
          splitShadowsHue,
          enableColor ? splitShadowsSat : 0,
          splitHighlightsHue,
          enableColor ? splitHighlightsSat : 0,
          enableColor ? splitBalance : 0,
          enableLight ? fade : 0,
          performance.now() / 1000.0,
          cropRatio,
          enableEffects ? borderMode : 0,
          enableEffects ? borderWidth : 0,
          is4DMode ? lut4DAxis : 0
        );`;
content = content.replace(renderHookTarget, renderHookReplacement);

// Do the same for the imageLoad force render and generateCube
        
const forceRenderTarget = `        processor.render(
          exposure, 
          contrast, 
          activeLut ? intensity : 0,
          temperature,
          tint,
          shadows,
          highlights,
          saturation,
          vignette,
          grain,
          sharpen,
          halation,
          bloom,
          hslH, hslS, hslL, splitShadowsHue, splitShadowsSat, splitHighlightsHue, splitHighlightsSat, splitBalance, fade, performance.now() / 1000.0, cropRatio, borderMode, borderWidth
        );`;
const forceRenderReplacement = `        processor.render(
          enableLight ? exposure : 0, 
          enableLight ? contrast : 1, 
          (activeLut && enableLuts) ? intensity : 0,
          enableColor ? temperature : 0,
          enableColor ? tint : 0,
          enableLight ? shadows : 0,
          enableLight ? highlights : 0,
          enableColor ? saturation : 1,
          enableEffects ? vignette : 0,
          enableEffects ? grain : 0,
          enableEffects ? sharpen : 0,
          enableEffects ? halation : 0,
          enableEffects ? bloom : 0,
          enableColor ? hslH : new Float32Array(8),
          enableColor ? hslS : new Float32Array(8),
          enableColor ? hslL : new Float32Array(8),
          splitShadowsHue,
          enableColor ? splitShadowsSat : 0,
          splitHighlightsHue,
          enableColor ? splitHighlightsSat : 0,
          enableColor ? splitBalance : 0,
          enableLight ? fade : 0,
          performance.now() / 1000.0,
          cropRatio,
          enableEffects ? borderMode : 0,
          enableEffects ? borderWidth : 0,
          is4DMode ? lut4DAxis : 0
        );`;
content = content.replace(forceRenderTarget, forceRenderReplacement);


// Inject `defaultValue` into Sliders. Let's do a regex to extract the reset value
content = content.replace(/<Slider([^>]*)onReset={\(\) => ([a-zA-Z]+)\(([^)]+)\)}([^>]*)>/g, '<Slider$1defaultValue={$3} onReset={() => $2($3)}$4>');

fs.writeFileSync('src/App.tsx', content);

