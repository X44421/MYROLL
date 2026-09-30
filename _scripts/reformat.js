const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import Slider")) {
  code = code.replace("import { useState,", "import Slider from './components/Slider';\nimport { useState,");
}

function replaceSlider(regex, label, valName, min, max, step, formatFunc, resetVal) {
  code = code.replace(regex, `<Slider label="${label}" min={${min}} max={${max}} step={${step}} value={${valName}} onChange={set${valName[0].toUpperCase() + valName.slice(1)}} onReset={() => set${valName[0].toUpperCase() + valName.slice(1)}(${resetVal})} ${formatFunc ? `formatValue={(v) => ${formatFunc}}` : ''} />`);
}

// Light tab
const exposureRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Exposure<\/label>\s*<span className="font-mono text-white">\{\(exposure > 0 \? '\+' : ''\)\}\{exposure\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="-3" max="3" step="0\.05" value=\{exposure\} onChange=\{e => setExposure\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(exposureRegex, "Exposure", "exposure", "-3", "3", "0.05", "v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)", "0");

const contrastRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Contrast<\/label>\s*<span className="font-mono text-white">\{contrast\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="0\.5" max="2" step="0\.05" value=\{contrast\} onChange=\{e => setContrast\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(contrastRegex, "Contrast", "contrast", "0.5", "2", "0.05", "v.toFixed(2)", "1");

const highlightsRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Highlights<\/label>\s*<span className="font-mono text-white">\{\(highlights > 0 \? '\+' : ''\)\}\{highlights\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="-1" max="1" step="0\.05" value=\{highlights\} onChange=\{e => setHighlights\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(highlightsRegex, "Highlights", "highlights", "-1", "1", "0.05", "v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)", "0");

const shadowsRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Shadows<\/label>\s*<span className="font-mono text-white">\{\(shadows > 0 \? '\+' : ''\)\}\{shadows\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="-1" max="1" step="0\.05" value=\{shadows\} onChange=\{e => setShadows\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(shadowsRegex, "Shadows", "shadows", "-1", "1", "0.05", "v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)", "0");

const fadeRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Fade<\/label>\s*<span className="font-mono text-white">\{\(fade \* 100\)\.toFixed\(0\)\}<\/span>\s*<\/div>\s*<input type="range" min="0" max="1" step="0\.01" value=\{fade\} onChange=\{e => setFade\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(fadeRegex, "Fade", "fade", "0", "1", "0.01", "(v * 100).toFixed(0)", "0");

// Color Global tab
const tempRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Temperature<\/label>\s*<span className="font-mono text-white">\{\(temperature > 0 \? '\+' : ''\)\}\{temperature\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="-1" max="1" step="0\.05" value=\{temperature\} onChange=\{e => setTemperature\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(tempRegex, "Temperature", "temperature", "-1", "1", "0.05", "v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)", "0");

const tintRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Tint<\/label>\s*<span className="font-mono text-white">\{\(tint > 0 \? '\+' : ''\)\}\{tint\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="-1" max="1" step="0\.05" value=\{tint\} onChange=\{e => setTint\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(tintRegex, "Tint", "tint", "-1", "1", "0.05", "v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)", "0");

const satRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Saturation<\/label>\s*<span className="font-mono text-white">\{saturation\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="0" max="2" step="0\.05" value=\{saturation\} onChange=\{e => setSaturation\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(satRegex, "Saturation", "saturation", "0", "2", "0.05", "v.toFixed(2)", "1");

// Split Highlight Hue 
const shhRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Hue<\/label>\s*<span className="font-mono text-white">\{\(splitHighlightsHue \* 360\)\.toFixed\(0\)\}°<\/span>\s*<\/div>\s*<input type="range" min="0" max="1" step="0\.01" value=\{splitHighlightsHue\} onChange=\{e => setSplitHighlightsHue\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(shhRegex, "Hue", "splitHighlightsHue", "0", "1", "0.01", "`${(v * 360).toFixed(0)}°`", "0.1");

// Split Highlight Sat
const shsRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Saturation<\/label>\s*<span className="font-mono text-white">\{\(splitHighlightsSat \* 100\)\.toFixed\(0\)\}<\/span>\s*<\/div>\s*<input type="range" min="0" max="1" step="0\.01" value=\{splitHighlightsSat\} onChange=\{e => setSplitHighlightsSat\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(shsRegex, "Saturation", "splitHighlightsSat", "0", "1", "0.01", "`${(v * 100).toFixed(0)}`", "0");

// Split Shadow Hue
const sshRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Hue<\/label>\s*<span className="font-mono text-white">\{\(splitShadowsHue \* 360\)\.toFixed\(0\)\}°<\/span>\s*<\/div>\s*<input type="range" min="0" max="1" step="0\.01" value=\{splitShadowsHue\} onChange=\{e => setSplitShadowsHue\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(sshRegex, "Hue", "splitShadowsHue", "0", "1", "0.01", "`${(v * 360).toFixed(0)}°`", "0.6");

// Split Shadow Sat
const sssRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Saturation<\/label>\s*<span className="font-mono text-white">\{\(splitShadowsSat \* 100\)\.toFixed\(0\)\}<\/span>\s*<\/div>\s*<input type="range" min="0" max="1" step="0\.01" value=\{splitShadowsSat\} onChange=\{e => setSplitShadowsSat\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(sssRegex, "Saturation", "splitShadowsSat", "0", "1", "0.01", "`${(v * 100).toFixed(0)}`", "0");

// Split Balance
const sbRegex = /<div className="space-y-3 pt-2">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Balance<\/label>\s*<span className="font-mono text-white">\{\(splitBalance \* 100\)\.toFixed\(0\)\}<\/span>\s*<\/div>\s*<input type="range" min="-1" max="1" step="0\.01" value=\{splitBalance\} onChange=\{e => setSplitBalance\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(sbRegex, "Balance", "splitBalance", "-1", "1", "0.01", "`${(v * 100).toFixed(0)}`", "0");

// Effects
const vigRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Vignette<\/label>\s*<span className="font-mono text-white">\{vignette\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="0" max="1" step="0\.05" value=\{vignette\} onChange=\{e => setVignette\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(vigRegex, "Vignette", "vignette", "0", "1", "0.05", "v.toFixed(2)", "0");

const grainRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Grain<\/label>\s*<span className="font-mono text-white">\{grain\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="0" max="1" step="0\.05" value=\{grain\} onChange=\{e => setGrain\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(grainRegex, "Grain", "grain", "0", "1", "0.05", "v.toFixed(2)", "0");

const sharpenRegex = /<div className="space-y-3">\s*<div className="flex justify-between text-\[11px\] mb-1">\s*<label className="font-medium text-gray-400 uppercase tracking-widest">Sharpen<\/label>\s*<span className="font-mono text-white">\{sharpen\.toFixed\(2\)\}<\/span>\s*<\/div>\s*<input type="range" min="0" max="1" step="0\.05" value=\{sharpen\} onChange=\{e => setSharpen\(parseFloat\(e\.target\.value\)\)\} \/>\s*<\/div>/;
replaceSlider(sharpenRegex, "Sharpen", "sharpen", "0", "1", "0.05", "v.toFixed(2)", "0");

fs.writeFileSync('src/App.tsx', code);
