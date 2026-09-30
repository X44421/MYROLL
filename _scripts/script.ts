import * as fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /const \[([a-zA-Z0-9_]+), set([a-zA-Z0-9_]+)\] = useState(?:<.*?>)?\((.*?)\);/g;
const storeVariables = [
  'exposure','contrast','temperature','tint','shadows','highlights','saturation',
  'intensity','vignette','grain','sharpen','halation','bloom','hslH','hslS','hslL',
  'splitShadowsHue','splitShadowsSat','splitHighlightsHue','splitHighlightsSat','splitBalance',
  'fade','lut4DAxis','cropRatio','borderMode','borderWidth'
];

code = code.replace(regex, (match, stateName, setterNameRaw, defaultValue) => {
  if (storeVariables.includes(stateName)) {
    const setterName = "set" + setterNameRaw;
    return `const ${stateName} = useRootStore(s => s.${stateName});\n  const ${setterName} = (v: any) => useRootStore.setState({ ${stateName}: typeof v === 'function' ? v(useRootStore.getState().${stateName}) : v });`;
  }
  return match;
});

// Import the store at the top
if (!code.includes('useRootStore')) {
  code = code.replace("import React", "import { useRootStore } from './store/workspace';\nimport React");
}

fs.writeFileSync('src/App.tsx', code);
console.log("Successfully replaced state in App.tsx");
