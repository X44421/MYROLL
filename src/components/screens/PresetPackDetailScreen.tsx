import { motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { AnimatedCount } from "../AnimatedCount";
import { T, SPRING } from "../../lib/motion/tokens";
import { useAppStore } from "../../store/appStore";
import type { Preset } from "../../lib/data/filmTypes";

export function PresetPackDetailScreen({ packId }: { packId: string }) {
  const getPack = useAppStore((s) => s.getPack);
  const presetsInPack = useAppStore((s) => s.presetsInPack);
  const pushOverlay = useAppStore((s) => s.pushOverlay);
  const popOverlay = useAppStore((s) => s.popOverlay);
  const pack = getPack(packId);
  const packPresets = presetsInPack(packId);

  if (!pack) return null;

  const builtinCount = packPresets.filter((p) => p.kind === "builtin").length;
  const importedCount = packPresets.filter((p) => p.kind === "imported").length;
  const userCount = packPresets.filter((p) => p.kind === "user").length;

  return (
    <div className="relative h-full w-full bg-[#f4f4f4] flex flex-col overflow-hidden">

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[120px]">
        <motion.div
          className="px-[20px] flex flex-col gap-[40px] py-[40px]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { ...T.base, delay: 0.1 } }}
        >
          <div className="flex flex-col gap-[20px]">
            <p className="font-['IBM_Plex_Mono'] text-[12px] text-[#999]">Preset Pack</p>
            <div className="flex gap-[4px] items-start text-black">
              <p
                className="flex-1 font-['Platypi'] text-[30px] tracking-[-0.9px]"
                style={{ lineHeight: 1.2, fontWeight: 300 }}
              >
                {pack.name}
              </p>
              <p className="font-['IBM_Plex_Mono'] text-[12px] whitespace-nowrap">
                [<AnimatedCount value={packPresets.length} />]
              </p>
              <button type="button" onClick={popOverlay}
                className="size-[32px] rounded-full bg-black/10 flex items-center justify-center shrink-0">
                <X size={16} color="black" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="flex gap-[21px] items-center flex-wrap">
            <Legend color="#a261da" n={builtinCount} label="Built-in" />
            <Legend color="#3d83ed" n={importedCount} label="Imported LUT" />
            {userCount > 0 && <Legend color="#61da8c" n={userCount} label="User" />}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { ...T.base, delay: 0.24 } }}
        >
          <div className="px-[20px] flex flex-col items-center py-[20px] border-t border-[rgba(0,0,0,0.1)]">
            <motion.button
              type="button"
              onClick={() =>
                pushOverlay({ type: "newCollection", targetPackId: packId })
              }
              whileTap={{ scale: 0.95 }}
              transition={SPRING}
              className="bg-[#1c1c1c] flex gap-[6px] items-center pl-[12px] pr-[19px] py-[10px] rounded-[50px]"
            >
              <Plus size={18} color="white" strokeWidth={2} />
              <span className="font-['Platypi'] text-[14px] text-white tracking-[-0.42px]" style={{ lineHeight: 1.2 }}>
                Import .cube to this pack
              </span>
            </motion.button>
          </div>

          <div className="px-[20px] flex flex-col gap-[10px] pb-[20px]">
            {packPresets.map((preset, i) => (
              <PresetRow key={preset.id} preset={preset} index={i} />
            ))}
            {packPresets.length === 0 && (
              <p className="font-['IBM_Plex_Mono'] text-[12px] text-[#999] text-center py-[40px]">
                No presets yet. Import a .cube file.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function PresetRow({ preset, index }: { preset: Preset; index: number }) {
  const deletePreset = useAppStore((s) => s.deletePreset);
  const photos = useAppStore((s) => s.photos);
  const baseSrc = photos[0]?.thumbUrl || photos[0]?.dataUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { ...T.base, delay: 0.28 + index * 0.04 } }}
      className="flex items-center gap-[14px] bg-white rounded-[10px] p-[10px]"
    >
      {baseSrc && (
        <div className="size-[52px] overflow-hidden shrink-0 relative bg-black/10">
          <img
            src={baseSrc}
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
      )}
      <div className="flex flex-col gap-[2px] flex-1 min-w-0">
        <p
          className="font-['Platypi'] text-[15px] text-black tracking-[-0.45px] truncate"
          style={{ lineHeight: 1.2 }}
        >
          {preset.name}
        </p>
        <span
          className={`font-['IBM_Plex_Mono'] text-[10px] ${
            preset.kind === "imported" ? "text-[#3d83ed]" : preset.kind === "user" ? "text-[#61da8c]" : "text-[#999]"
          }`}
        >
          {preset.kind === "imported"
            ? `Imported LUT \u00B7 ${preset.lutSize ?? 33}\u00B3`
            : preset.kind === "user"
            ? "User preset"
            : "Built-in"}
        </span>
      </div>
      <div className="flex gap-[2px] items-center">
        {preset.filterCSS !== "none" && (
          <div className="size-[6px] rounded-full bg-[#a261da]" />
        )}
        {preset.grain > 0 && (
          <div className="size-[6px] rounded-full bg-[#cada61]" />
        )}
        {preset.kind === "user" && (
          <button type="button" onClick={() => { if (window.confirm(`Delete "${preset.name}"?`)) deletePreset(preset.id); }}
            className="ml-[6px] size-[22px] flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 transition-colors">
            <X size={12} color="#ef4444" strokeWidth={2} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Legend({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <div className="flex gap-[6px] items-center">
      <span className="size-[9px]" style={{ background: color }} />
      <span className="font-['IBM_Plex_Mono'] text-[10px] text-black">
        <AnimatedCount value={n} />
      </span>
      <span className="font-['IBM_Plex_Mono'] text-[10px] text-black">{label}</span>
    </div>
  );
}
