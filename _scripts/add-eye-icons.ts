import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');


const eyeIconContent = `
  const EyeToggle = ({ enabled, onClick }: { enabled: boolean, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className={\`p-1 rounded transition-colors \${enabled ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-600 bg-zinc-900/50 hover:text-zinc-400'}\`}
      title={enabled ? "Disable Module temporarily" : "Enable Module"}
    >
      <Eye size={14} weight={enabled ? "bold" : "regular"} className={enabled ? "" : "opacity-30"} />
    </button>
  );
`;

if (!content.includes('const EyeToggle')) {
  content = content.replace(
    'export default function App() {\n',
    'export default function App() {\n' + eyeIconContent
  );
}

const headerBlockSearch = `<h3 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                   {activeTab === 'luts' ? 'LUTs & Presets' : 
                    activeTab === 'light' ? 'Light Adjustments' : 
                    activeTab === 'color' ? 'Color Grading' : 
                    activeTab === 'effects' ? 'Effects & Framing' : 'Properties'}
                 </h3>`;

const headerBlockReplace = `<div className="flex items-center gap-2">
                   {activeTab === 'luts' && <EyeToggle enabled={enableLuts} onClick={() => setEnableLuts(!enableLuts)} />}
                   {activeTab === 'light' && <EyeToggle enabled={enableLight} onClick={() => setEnableLight(!enableLight)} />}
                   {activeTab === 'color' && <EyeToggle enabled={enableColor} onClick={() => setEnableColor(!enableColor)} />}
                   {activeTab === 'effects' && <EyeToggle enabled={enableEffects} onClick={() => setEnableEffects(!enableEffects)} />}
                   <h3 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
                     {activeTab === 'luts' ? 'LUTs & Presets' : 
                      activeTab === 'light' ? 'Light Adjustments' : 
                      activeTab === 'color' ? 'Color Grading' : 
                      activeTab === 'effects' ? 'Effects & Framing' : 'Properties'}
                   </h3>
                 </div>`;

content = content.replace(headerBlockSearch, headerBlockReplace);


// Targeted Adjustment Tool (Pipette / Eyedropper) implementation
// We need to support picking HSL target.
// 1. Add state for picker mode `isPickingHsl`
// 2. Add an onClick or absolute overlay on Canvas area when `isPickingHsl` is true.

if (!content.includes('const [isPickingHsl')) {
  content = content.replace(
    'const [isBeforeView, setIsBeforeView] = useState(false);',
    'const [isBeforeView, setIsBeforeView] = useState(false);\n  const [isPickingHsl, setIsPickingHsl] = useState(false);'
  );
}

const pickerBtn = `
                        <button
                          onClick={() => setIsPickingHsl(!isPickingHsl)}
                          className={\`p-1.5 rounded transition-colors text-zinc-400 \${isPickingHsl ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5 hover:text-zinc-200'}\`}
                          title="Targeted Adjustment Tool (Click image to select color range)"
                        >
                          <Pipette size={14} weight={isPickingHsl ? "fill" : "regular"} />
                        </button>
`;
// Inject it next to the HSL Color row
content = content.replace(
  '<div className="flex gap-2 mb-6">',
  '<div className="flex items-center gap-3 mb-6">' + pickerBtn + '<div className="flex gap-2 flex-wrap">'
);
content = content.replace(
  // Close the inner div
  'onClick={() => setActiveHslColor(i)}',
  'onClick={() => setActiveHslColor(i)}'
).replace(
  '           </div>\n                    \n                    <div className="space-y-6">',
  '           </div></div>\n                    \n                    <div className="space-y-6">'
);

// We need a helper to read pixel from canvas:
const pickColorFunc = `
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingHsl || !canvasRef.current) return;
    
    // Get mouse coordinates relative to canvas drawn area
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Wait, getting exact color from webgl canvas is reading pixels directly.
    // WebGL allows readPixels
    const gl = canvasRef.current.getContext('webgl2') || canvasRef.current.getContext('webgl');
    if (gl) {
        // Read 1x1 pixel. Remember WebGL coordinates are bottom-left
        const glY = canvasRef.current.height - (y / rect.height) * canvasRef.current.height;
        const glX = (x / rect.width) * canvasRef.current.width;
        
        const pixels = new Uint8Array(4);
        gl.readPixels(glX, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        let [r, g, b] = pixels;
        r /= 255; g /= 255; b /= 255;
        
        // Convert to HSL
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }

        // HUE_CENTERS: 0.0, 0.0833, 0.1666, 0.3333, 0.5, 0.6666, 0.75, 0.8333
        const CENTERS = [0.0, 0.0833, 0.1666, 0.3333, 0.5, 0.6666, 0.75, 0.8333];
        
        // Find closest
        let minDiff = 1.0;
        let bestIdx = 0;
        for (let i = 0; i < CENTERS.length; i++) {
           // distance wrapped
           const hc = CENTERS[i];
           let d1 = Math.abs(h - hc);
           let d2 = Math.abs(h - (hc + 1.0));
           let d3 = Math.abs((h + 1.0) - hc);
           let d = Math.min(d1, d2, d3);
           
           // Special weight for red vs magenta vs orange to solve edge cases
           if (d < minDiff) { minDiff = d; bestIdx = i; }
        }
        
        setActiveHslColor(bestIdx);
        setIsPickingHsl(false);
    }
  };
`;

if (!content.includes('const handleCanvasClick')) {
  // Inject before return
  content = content.replace(
    '  return (\n    <div className=',
    pickColorFunc + '\n  return (\n    <div className='
  );
}

// Add onClick to canvas and cursor
content = content.replace(
  '<canvas \n              ref={canvasRef}',
  '<canvas \n              ref={canvasRef}\n              onClick={handleCanvasClick}\n              className={isPickingHsl ? "cursor-crosshair" : ""}'
);

content = content.replace(
  '<canvas\n            ref={canvasRef}\n            style={{',
  '<canvas\n            ref={canvasRef}\n            onClick={handleCanvasClick}\n            className={isPickingHsl ? "cursor-crosshair" : ""}\n            style={{'
);


fs.writeFileSync('src/App.tsx', content);

