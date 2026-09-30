import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Reduce vertical gaps in sliders
content = content.replace(/className="flex flex-col gap-8"/g, 'className="flex flex-col gap-5"');
content = content.replace(/gap-8/g, 'gap-5');
content = content.replace(/gap-6 py-2/g, 'gap-5 py-2');

// Standardize sub-section headers spacing & border
// Just doing a selective replace for the subheaders tracking
content = content.replace(/tracking-\[0\.15em\]/g, 'tracking-[0.1em]');

// Subtabs container
content = content.replace(/bg-white\/5\/50/g, 'bg-zinc-950/30');

// Change `p-3 rounded-lg` to `p-2.5 rounded-md` for LUT blocks
content = content.replace(/p-3 rounded-lg flex flex-col/g, 'p-2.5 rounded-md flex flex-col');

fs.writeFileSync('src/App.tsx', content);
