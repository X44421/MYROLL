import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Math Rhythm
// Change h-10 to h-12 (48px) for Header
content = content.replace(
  '<header className="h-10 flex-shrink-0 bg-transparent flex items-center justify-between px-4 border-b border-white/10">',
  '<header className="h-12 flex-shrink-0 bg-transparent flex items-center justify-between px-4 border-b border-white/10">'
);
// Change Left Activity Bar w-14 to w-12 (48px)
content = content.replace(
  '<div className="w-14 flex-shrink-0 bg-transparent border-r border-white/10 flex flex-col items-center py-3 gap-3 z-20">',
  '<div className="w-12 flex-shrink-0 bg-transparent border-r border-white/10 flex flex-col items-center py-4 z-20 justify-between">'
);
// Remove Right Activity Bar, we will move its contents.
const rightActivityBarStr = `<div className="w-14 flex-shrink-0 bg-transparent border-l border-white/10 flex flex-col items-center py-3 gap-3 z-20">
          {[
             { id: 'luts', label: 'Luts', Icon: Layers },
             { id: 'light', label: 'Light', Icon: Sun },
             { id: 'color', label: 'Color', Icon: Palette },
             { id: 'effects', label: 'Effects', Icon: Wand2 },
          ].map(({ id, label, Icon }) => (
            <button 
              key={id}
              title={label}
              onClick={() => setActiveTab(activeTab === id ? null : id as any)} 
              className={\`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors group \${activeTab === id ? 'bg-white/10' : 'hover:bg-white/10/50'}\`}
            >
              {activeTab === id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />}
              <Icon size={22} weight={activeTab === id ? "regular" : "light"} className={\`\${activeTab === id ? 'text-zinc-50' : 'text-zinc-400 group-hover:text-zinc-50'}\`} />
            </button>
          ))}
        </div>`;
content = content.replace(rightActivityBarStr, '');

// Rebuild Left Activity Bar to include all these things
const oldLeftActivityBarInner = `<label title="Import" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10/50 cursor-pointer text-zinc-400 hover:text-zinc-50 transition-colors">
            <input type="file" accept="image/*,.cr2,.nef,.arw,.dng,.raw,.orf,.rw2" onChange={handleImageUpload} className="hidden" />
            <FolderOpen size={22} weight="regular" />
          </label>
          <button title="Library" onClick={() => setShowGallery(true)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10/50 text-zinc-400 hover:text-zinc-50 transition-colors">
            <Library size={22} weight="regular" />
          </button>
          <button title="Camera" onClick={handleCameraToggle} className={\`w-10 h-10 flex items-center justify-center rounded-xl transition-colors \${isCameraActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'hover:bg-white/10/50 text-zinc-400 hover:text-zinc-50'}\`}>
            <Camera size={22} weight={isCameraActive ? "fill" : "regular"} />
          </button>
          <div className="w-6 h-[1px] bg-white/10 my-1" />
          <button title="Export" onClick={handleDownload} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10/50 text-zinc-400 hover:text-zinc-50 transition-colors">
            <Download size={22} weight="regular" />
          </button>`;

const newLeftActivityBarInner = `
          {/* Top: Global Operations */}
          <div className="flex flex-col gap-2 w-full items-center">
            <label title="Import" className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10/50 cursor-pointer text-zinc-400 hover:text-zinc-50 transition-colors">
              <input type="file" accept="image/*,.cr2,.nef,.arw,.dng,.raw,.orf,.rw2" onChange={handleImageUpload} className="hidden" />
              <FolderOpen size={20} weight="regular" />
            </label>
            <button title="Library" onClick={() => setShowGallery(true)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10/50 text-zinc-400 hover:text-zinc-50 transition-colors">
              <Library size={20} weight="regular" />
            </button>
            <button title="Camera" onClick={handleCameraToggle} className={\`w-10 h-10 flex items-center justify-center rounded-xl transition-colors \${isCameraActive ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'hover:bg-white/10/50 text-zinc-400 hover:text-zinc-50'}\`}>
              <Camera size={20} weight={isCameraActive ? "fill" : "regular"} />
            </button>
          </div>

          {/* Center: Module Panels */}
          <div className="flex flex-col gap-2 w-full items-center flex-1 justify-center">
            {[
               { id: 'luts', label: 'Luts', Icon: Layers },
               { id: 'light', label: 'Light', Icon: Sun },
               { id: 'color', label: 'Color', Icon: Palette },
               { id: 'effects', label: 'Effects', Icon: Wand2 },
            ].map(({ id, label, Icon }) => (
              <button 
                key={id}
                title={label}
                onClick={() => setActiveTab(activeTab === id ? null : id as any)} 
                className={\`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors group \${activeTab === id ? 'bg-white/10' : 'hover:bg-white/10/50'}\`}
              >
                {activeTab === id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full" />}
                <Icon size={20} weight={activeTab === id ? "regular" : "light"} className={\`\${activeTab === id ? 'text-zinc-50' : 'text-zinc-400 group-hover:text-zinc-50'}\`} />
              </button>
            ))}
          </div>

          {/* Bottom: Export */}
          <div className="flex flex-col gap-2 w-full items-center">
            <button title="Export" onClick={handleDownload} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10/50 text-zinc-400 hover:text-zinc-50 transition-colors">
              <Download size={20} weight="regular" />
            </button>
          </div>
`;
content = content.replace(oldLeftActivityBarInner, newLeftActivityBarInner);

// 3. Right Panel Cramping
// Make sure w-[340px] -> w-[320px] and unified gaps
content = content.replace('w-full sm:w-[340px]', 'w-full sm:w-[320px]');
// Move Histogram to the very top, full bleed.
// Delete it from inside the tab content wrapper:
const oldHistSection = `<div className="px-5 pt-5 pb-4 border-b border-white/5">
                <Histogram ref={histogramRef} sourceCanvas={canvasRef.current} />
              </div>`;
content = content.replace(oldHistSection, '');

const rightPanelHeaderStart = `<div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between px-4 h-11 border-b border-white/5 flex-shrink-0 bg-transparent">`;
// 3a. Histogram is Bleed Layout at top
// Also 3b. Padding adjustment. from px-5 py-6 to px-6 py-6 for rigorous grid (24px padding = px-6)
content = content.replace(
  rightPanelHeaderStart, 
  `<div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-shrink-0 border-b border-white/5 bg-zinc-950">
                {/* Histogram Full Bleed */}
                <Histogram ref={histogramRef} sourceCanvas={canvasRef.current} />
              </div>
              <div className="flex items-center justify-between px-6 h-12 border-b border-white/5 flex-shrink-0 bg-transparent">`
);

// We need to change all px-4 h-11 to px-6 h-12 and px-5 to px-6
content = content.replace(
  '<div className="flex-1 overflow-y-auto px-5 py-6 custom-scrollbar">',
  '<div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar flex flex-col gap-6">'
);

// 4. Viewport Safe Area
content = content.replace(
  '<main className="flex-1 bg-[#09090b] relative flex flex-col overflow-hidden items-center justify-center">',
  '<main className="flex-1 bg-[#09090b] relative flex flex-col overflow-hidden items-center justify-center p-8 lg:p-12">'
);
content = content.replace(
  '<div className="relative flex items-center justify-center w-full h-full max-h-full">',
  '<div className="relative flex items-center justify-center w-full h-full max-h-full shadow-2xl ring-1 ring-white/5">'
);

fs.writeFileSync('src/App.tsx', content);
