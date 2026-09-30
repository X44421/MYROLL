import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Edit3 } from "lucide-react";
import { FilterBar } from "../FilterBar";
import { PhotoCard } from "../cards/PhotoCard";
import { fadeUp, SPRING } from "../../lib/motion/tokens";
import { useAppStore } from "../../store/appStore";
import type { Photo } from "../../lib/data/filmTypes";

type GalleryFilter = "all" | "color" | "bw" | "edited";

const OPTIONS: { id: GalleryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "color", label: "Color" },
  { id: "bw", label: "B&W" },
  { id: "edited", label: "Edited" },
];

const isBW = (id: string) => id.startsWith("bw") || id.startsWith("BW");

function matchesFilter(photo: Photo, filter: GalleryFilter): boolean {
  if (filter === "all") return true;
  const { presetId } = photo.editState;
  if (filter === "bw") return isBW(presetId);
  if (filter === "color") return !isBW(presetId);
  if (filter === "edited") {
    const { adjust, grain, effects } = photo.editState;
    return (
      presetId !== "" ||
      Object.values(adjust).some((v) => v !== 0) ||
      grain.amount > 0 ||
      effects.halation > 0 ||
      effects.lightLeak > 0
    );
  }
  return true;
}

export function GalleryScreen() {
  const { photos, pushOverlay, deletePhoto } = useAppStore();
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [viewerPhoto, setViewerPhoto] = useState<Photo | null>(null);

  const filtered = useMemo(
    () => photos.filter((p) => matchesFilter(p, filter)),
    [photos, filter]
  );

  const [colA, colB] = useMemo(() => {
    const a: Photo[] = [];
    const b: Photo[] = [];
    let ha = 0, hb = 0;
    for (const photo of filtered) {
      const h = (photo.height / photo.width) * 175;
      if (ha <= hb) { a.push(photo); ha += h + 12; }
      else { b.push(photo); hb += h + 12; }
    }
    return [a, b];
  }, [filtered]);

  const renderCol = (col: Photo[], offset: number) => (
    <div className="flex-1 min-w-0 flex flex-col gap-[12px]">
      {col.map((photo, i) => (
        <motion.div
          key={photo.id}
          custom={offset + i}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
          <PhotoCard
            photo={photo}
            onOpen={() => setViewerPhoto(photo)}
          />
        </motion.div>
      ))}
    </div>
  );

  return (
    <div className="relative h-full w-full bg-[#f4f4f4] flex flex-col overflow-hidden">
      <div className="shrink-0">
        {/* Header row */}
        <div className="flex items-center justify-between px-[20px] pt-[10px] pb-[24px]">
          <div className="flex items-baseline gap-[10px]">
            <span
              className="font-['Platypi'] text-[20px] text-black tracking-[-0.6px]"
              style={{ lineHeight: 1.1 }}
            >
              My Roll
            </span>
            <span className="font-['IBM_Plex_Mono'] text-[12px] text-[#999]">
              [{photos.length}]
            </span>
          </div>
          <img src="/film.png" alt="Film" className="h-[20px] w-auto" />
        </div>

        {/* Filter bar */}
        <div className="px-[20px] pb-[20px]">
          <FilterBar
            options={OPTIONS}
            value={filter}
            onChange={(v: GalleryFilter) => setFilter(v)}
            layoutId="galleryFilterInk"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[120px]">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex gap-[12px] items-start px-[20px] w-full">
            {renderCol(colA, 0)}
            {renderCol(colB, colA.length)}
          </div>
        )}
      </div>

      {/* Full-screen viewer */}
      <AnimatePresence>
        {viewerPhoto && (
          <motion.div
            key="fullscreen-viewer"
            className="fixed inset-0 z-[100] bg-black flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={() => setViewerPhoto(null)}
              className="absolute top-[16px] left-[16px] z-10 size-[36px] rounded-full bg-black/50 flex items-center justify-center"
            >
              <X size={20} color="white" />
            </button>
            <button
              type="button"
              onClick={() => {
                const id = viewerPhoto.id;
                setViewerPhoto(null);
                pushOverlay({ type: "itemDetail", itemId: id });
              }}
              className="absolute top-[16px] right-[16px] z-10 size-[36px] rounded-full bg-white/20 flex items-center justify-center"
            >
              <Edit3 size={18} color="white" />
            </button>
            <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={viewerPhoto.processedUrl || viewerPhoto.dataUrl}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between px-[20px] py-[16px]">
              <span className="font-['IBM_Plex_Mono'] text-[11px] text-white/60">
                {viewerPhoto.editState.presetId || "original"}
              </span>
              <span className="font-['IBM_Plex_Mono'] text-[11px] text-white/60">
                {viewerPhoto.width} × {viewerPhoto.height}
              </span>
              <button type="button" onClick={() => {
                if (confirm(`Delete "${viewerPhoto.name}"?`)) {
                  const id = viewerPhoto.id;
                  setViewerPhoto(null);
                  deletePhoto(id);
                }
              }} className="text-red-400/80 text-[11px] font-['IBM_Plex_Mono'] hover:text-red-400 transition-colors">
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-[24px] px-[40px] py-[60px]">
      <p
        className="font-['Platypi'] text-[28px] text-black tracking-[-0.8px] text-center"
        style={{ lineHeight: 1.2, fontWeight: 300 }}
      >
        Import a photo to begin
      </p>
      <p className="font-['IBM_Plex_Mono'] text-[12px] text-[#999] text-center">
        Apply film simulations, grain, and light effects
      </p>
    </div>
  );
}
