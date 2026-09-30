import { motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { fadeUp, SPRING } from "../../lib/motion/tokens";
import { useAppStore } from "../../store/appStore";
import type { PresetPack, Preset } from "../../lib/data/filmTypes";

export function PresetsScreen() {
  const { packs, presets, pushOverlay, deletePack } = useAppStore();
  const userPacks = packs.filter((p) => p.id !== "pack-base" && p.id !== "pack-color" && p.id !== "pack-bw");
  const cubeLoaded = Object.values(presets).some(p => p.kind === "builtin" && p.lutData);

  return (
    <div className="relative h-full w-full bg-[#f4f4f4] flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-[120px] px-[20px]">
        <div className="flex flex-col gap-[21px] items-center justify-center py-[40px]">
          <div className="flex flex-col gap-[22px] items-center">
            <h1
              className="font-['Platypi'] text-[50px] text-black tracking-[-1.5px]"
              style={{ lineHeight: 1.2, fontWeight: 300 }}
            >
              Presets
            </h1>
            <p className="font-['IBM_Plex_Mono'] text-[12px] text-[#999]">
              {userPacks.length} preset packs{cubeLoaded ? "" : " · loading…"}
            </p>
          </div>
          <motion.button
            type="button"
            onClick={() => pushOverlay({ type: "newCollection" })}
            whileTap={{ scale: 0.92 }}
            transition={SPRING}
            aria-label="Import LUT pack"
            className="size-[41px] rounded-full bg-black flex items-center justify-center"
          >
            <Plus size={20} color="white" strokeWidth={2} />
          </motion.button>
        </div>

        <div className="flex flex-col gap-[16px] items-center pt-[8px]">
          {userPacks.map((pack, i) => (
            <motion.div
              key={pack.id}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="w-full"
            >
              <PresetPackCard
                pack={pack}
                onOpen={() =>
                  pushOverlay({ type: "collectionDetail", collectionId: pack.id })
                }
                onDelete={deletePack}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PresetPackCard({
  pack,
  onOpen,
  onDelete,
}: {
  pack: PresetPack;
  onOpen: () => void;
  onDelete: (id: string) => void;
}) {
  const { presetsInPack, photos } = useAppStore();
  const packPresets = presetsInPack(pack.id);
  const previews = packPresets.slice(0, 4);
  const baseSrc = photos[0]?.thumbUrl || photos[0]?.dataUrl;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      className="w-full bg-white rounded-[12px] overflow-hidden block"
    >
      <div className="flex flex-col gap-[16px] items-center justify-end px-[24px] pt-[28px] pb-[10px]">
        <p
          className="font-['Platypi'] font-light text-[20px] text-black tracking-[-0.6px] text-center"
          style={{ lineHeight: 1.2 }}
        >
          {pack.name}
        </p>
        <p className="font-['IBM_Plex_Mono'] text-[10px] text-[#999]">
          {packPresets.length} presets
        </p>
      </div>
      {baseSrc && previews.length > 0 && (
        <div className="flex gap-[8px] items-center p-[8px] h-[107px]">
          {previews.map((preset) => (
            <PresetThumbnail key={preset.id} preset={preset} src={baseSrc} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-end px-[12px] pb-[8px]">
        <span onClick={(e) => { e.stopPropagation(); if (confirm(`Delete pack "${pack.name}"?`)) onDelete(pack.id); }}
          className="size-[22px] inline-flex items-center justify-center rounded-full bg-black/5 hover:bg-red-500/10 transition-colors cursor-pointer select-none">
          <X size={12} color="#999" strokeWidth={2} />
        </span>
      </div>
    </motion.button>
  );
}

function PresetThumbnail({ preset, src }: { preset: Preset; src: string }) {
  return (
    <div className="flex-1 h-full overflow-hidden relative bg-black/10">
      <img
        src={src}
        alt={preset.name}
        className="w-full h-full object-cover"
        style={{ filter: preset.filterCSS !== "none" ? preset.filterCSS : undefined }}
        loading="lazy"
      />
      {preset.tint && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: preset.tint, mixBlendMode: "soft-light" }}
        />
      )}
    </div>
  );
}
