import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { AnimatedCount } from "../AnimatedCount";
import { SPRING, fadeUp, T } from "../../lib/motion/tokens";
import { useAppStore } from "../../store/appStore";

export function PackCreatedScreen({ packId }: { packId: string }) {
  const getPack = useAppStore((s) => s.getPack);
  const presetsInPack = useAppStore((s) => s.presetsInPack);
  const setTab = useAppStore((s) => s.setTab);
  const pushOverlay = useAppStore((s) => s.pushOverlay);
  const photos = useAppStore((s) => s.photos);
  const baseSrc = photos[0]?.thumbUrl || photos[0]?.dataUrl;
  const pack = getPack(packId);
  const packPresets = presetsInPack(packId);

  if (!pack) return null;

  const importedCount = packPresets.filter((p) => p.kind === "imported").length;
  const userCount = packPresets.filter((p) => p.kind === "user").length;

  return (
    <div className="relative h-full w-full bg-[#f4f4f4] flex flex-col overflow-hidden">

      <motion.div
        className="flex-1 overflow-y-auto no-scrollbar pb-[120px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { ...T.base, delay: 0.22 } }}
      >
        <div className="px-[20px] flex flex-col gap-[40px] py-[40px]">
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
            </div>
          </div>
          <div className="flex gap-[6px] items-center flex-wrap">
            {importedCount > 0 && (
              <>
                <span className="size-[9px] bg-[#a261da]" />
                <span className="font-['IBM_Plex_Mono'] text-[12px] text-black">
                  <AnimatedCount value={importedCount} />
                </span>
                <span className="font-['IBM_Plex_Mono'] text-[12px] text-black">Imported LUTs</span>
              </>
            )}
            {userCount > 0 && (
              <>
                <span className="size-[9px] bg-[#61da8c]" />
                <span className="font-['IBM_Plex_Mono'] text-[12px] text-black">
                  <AnimatedCount value={userCount} />
                </span>
                <span className="font-['IBM_Plex_Mono'] text-[12px] text-black">User</span>
              </>
            )}
          </div>
        </div>

        <div className="px-[20px] flex flex-col items-center py-[24px] border-t border-[rgba(0,0,0,0.1)] gap-[12px]">
          <motion.button
            type="button"
            onClick={() => pushOverlay({ type: "newCollection", targetPackId: packId })}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className="bg-[#1c1c1c] flex gap-[8px] items-center pl-[12px] pr-[19px] py-[10px] rounded-[50px]"
          >
            <Plus size={20} color="white" strokeWidth={2} />
            <span className="font-['Platypi'] text-[16px] text-white tracking-[-0.48px]" style={{ lineHeight: 1.2 }}>
              Import .cube to this pack
            </span>
          </motion.button>
          <motion.button
            type="button"
            onClick={() => setTab("presets")}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className="flex gap-[8px] items-center px-[19px] py-[10px] rounded-[50px] border border-black/20"
          >
            <span className="font-['Platypi'] text-[16px] text-black tracking-[-0.48px]" style={{ lineHeight: 1.2 }}>
              Back to Presets
            </span>
          </motion.button>
        </div>

        <div className="px-[20px] flex flex-col gap-[10px]">
          {packPresets.map((preset, i) => (
            <motion.div
              key={preset.id}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="flex items-center gap-[14px] bg-white rounded-[10px] p-[10px]"
            >
              {baseSrc && (
                <div className="size-[48px] overflow-hidden shrink-0 relative bg-black/10">
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
                <p className="font-['Platypi'] text-[15px] text-black tracking-[-0.45px] truncate" style={{ lineHeight: 1.2 }}>
                  {preset.name}
                </p>
                <span className={`font-['IBM_Plex_Mono'] text-[10px] ${preset.kind === "user" ? "text-[#61da8c]" : "text-[#999]"}`}>
                  {preset.kind === "imported" ? "Imported LUT" : preset.kind === "user" ? "User preset" : "Built-in"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

