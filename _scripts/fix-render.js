import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Update settingsRef uses
const oldRefStr = 'exposure, contrast, intensity, temperature, tint, shadows, highlights, saturation, vignette, grain, sharpen, hslH, hslS, hslL, splitShadowsHue, splitShadowsSat, splitHighlightsHue, splitHighlightsSat, splitBalance, fade, activeLutId, luts, isBeforeView';
const newRefStr = 'exposure, contrast, intensity, temperature, tint, shadows, highlights, saturation, vignette, grain, sharpen, halation, bloom, hslH, hslS, hslL, splitShadowsHue, splitShadowsSat, splitHighlightsHue, splitHighlightsSat, splitBalance, fade, activeLutId, luts, isBeforeView';

content = content.replace(
  `const settingsRef = useRef({ ${oldRefStr} });`,
  `const settingsRef = useRef({ ${newRefStr} });`
);
content = content.replace(
  `settingsRef.current = { ${oldRefStr} };`,
  `settingsRef.current = { ${newRefStr} };`
);
content = content.replace(
  `[${oldRefStr}]`,
  `[${newRefStr}]`
);

// Update effect dependency array
content = content.replace(
  `fade, processor, imageLoaded, activeLutId, luts, isBeforeView]);`,
  `fade, halation, bloom, processor, imageLoaded, activeLutId, luts, isBeforeView]);`
);

// Update calls to processor.render(...) in App.tsx
// Raw view call 1
content = content.replace(
  `processor.render(0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, new Float32Array(8)`,
  `processor.render(0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, new Float32Array(8)`
);
// Real view call 1
content = content.replace(
  `s.vignette, s.grain, s.sharpen, s.hslH, s.hslS, s.hslL`,
  `s.vignette, s.grain, s.sharpen, s.halation, s.bloom, s.hslH, s.hslS, s.hslL`
);

// Raw view call 2
content = content.replace(
  `processor.render(0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, new Float32Array(8)`,
  `processor.render(0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, new Float32Array(8)`
);

// We have two multiline calls to processor.render( ... )
// They look like:
/*
          vignette,
          grain,
          sharpen,
          hslH,
*/
content = content.replace(
  /vignette,\s*grain,\s*sharpen,\s*hslH,/g,
  `vignette,
          grain,
          sharpen,
          halation,
          bloom,
          hslH,`
);

fs.writeFileSync('src/App.tsx', content);
