import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Ensure section headers have sticky behavior to reduce scroll fatigue
content = content.replace(
  '<div className="flex justify-between items-center">',
  '<div className="flex justify-between items-center sticky top-0 bg-zinc-900/90 backdrop-blur-md z-10 pb-2 pt-2 border-b border-white/5 mb-4">'
);
content = content.replace(
  '<div className="flex justify-between items-center">',
  '<div className="flex justify-between items-center sticky top-0 bg-zinc-900/90 backdrop-blur-md z-10 pb-2 pt-2 border-b border-white/5 mb-4">'
);
content = content.replace(
  '<div className="flex justify-between items-center">',
  '<div className="flex justify-between items-center sticky top-0 bg-zinc-900/90 backdrop-blur-md z-10 pb-2 pt-2 border-b border-white/5 mb-4">'
);
content = content.replace(
  '<div className="flex justify-between items-center">',
  '<div className="flex justify-between items-center sticky top-0 bg-zinc-900/90 backdrop-blur-md z-10 pb-2 pt-2 border-b border-white/5 mb-4">'
);

fs.writeFileSync('src/App.tsx', content);

