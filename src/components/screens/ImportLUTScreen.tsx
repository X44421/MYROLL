import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Upload, FileCheck, X } from "lucide-react";
import { toast } from "sonner";
import { SPRING, T } from "../../lib/motion/tokens";
import { useAppStore } from "../../store/appStore";

function nameFontSize(len: number) {
  if (len <= 14) return 40;
  if (len <= 22) return 32;
  if (len <= 34) return 26;
  return 22;
}

const BUILTIN_PACK_IDS = new Set(["pack-base", "pack-color", "pack-bw", "pack-imported", "pack-user"]);

export function ImportLUTScreen({
  targetPackId,
}: {
  targetPackId?: string;
  attachPhotoId?: string;
}) {
  const packs = useAppStore((s) => s.packs);
  const presetsInPack = useAppStore((s) => s.presetsInPack);
  const createPack = useAppStore((s) => s.createPack);
  const importLUT = useAppStore((s) => s.importLUT);
  const popOverlay = useAppStore((s) => s.popOverlay);

  const [packName, setPackName] = useState(
    packs.find((p) => p.id === targetPackId)?.name || ""
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [packName]);

  const fontSize = nameFontSize(packName.length);
  const canSavePack = packName.trim().length > 0;
  const userPacks = packs.filter((p) => !BUILTIN_PACK_IDS.has(p.id));

  // Resolve the target pack: existing pack matching name, or create new
  const resolvedPack = packName.trim()
    ? packs.find((p) => p.name === packName.trim()) || userPacks.find((p) => p.id === targetPackId)
    : null;
  const currentPresetCount = resolvedPack ? presetsInPack(resolvedPack.id).length : 0;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!canSavePack) return;
    const name = packName.trim();
    let packId = packs.find((p) => p.name === name)?.id;
    if (!packId) {
      packId = createPack(name);
    }
    if (selectedFiles.length === 0) {
      toast.success(`Pack "${name}" created`);
      popOverlay();
      return;
    }
    setImporting(true);
    try {
      for (const file of selectedFiles) {
        await importLUT(file, packId);
      }
      toast.success(`Imported ${selectedFiles.length} LUT(s) to "${name}"`);
      popOverlay();
    } catch (e) {
      toast.error("Failed to import: " + (e instanceof Error ? e.message : "Invalid file"));
      setImporting(false);
    }
  };

  const removeFile = (i: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="relative h-full w-full bg-[#f4f4f4] rounded-t-[24px] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between pt-[10px] px-[20px] shrink-0">
        <div className="w-[40px] h-[4px] rounded-full bg-black/15" />
        <button type="button" onClick={popOverlay}
          className="size-[32px] rounded-full bg-black/10 flex items-center justify-center shrink-0">
          <X size={16} color="black" strokeWidth={2} />
        </button>
      </div>

      <div className="px-[20px] pb-[10px]">
        <p className="font-['IBM_Plex_Mono'] text-[11px] text-[#999] mb-[12px]">Pack name</p>
        <textarea
          ref={inputRef}
          value={packName}
          onChange={(e) => setPackName(e.target.value.replace(/\n/g, ""))}
          rows={1}
          placeholder="My LUT Pack"
          className="w-full resize-none overflow-hidden bg-transparent text-center outline-none font-['Platypi'] tracking-[-1px] caret-black text-black placeholder:text-black/30"
          style={{ fontSize, lineHeight: 1.25, paddingBottom: 4 }}
          aria-label="Pack name"
        />
        {resolvedPack && (
          <p className="font-['IBM_Plex_Mono'] text-[10px] text-[#999] text-center mt-[8px]">
            {currentPresetCount} preset{currentPresetCount !== 1 ? "s" : ""} in pack
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col pb-[40px] px-[20px]">
        <input
          ref={fileInputRef}
          type="file"
          accept=".cube,.3dl"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        <motion.button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          className={`w-full min-h-[140px] rounded-[16px] border-[1.5px] border-dashed flex flex-col items-center justify-center gap-[10px] ${
            selectedFiles.length > 0 ? "border-black/40 bg-black/4" : "border-black/20 bg-black/2"
          }`}
        >
          {selectedFiles.length > 0 ? (
            <>
              <FileCheck size={24} color="black" strokeWidth={1.5} />
              <p className="font-['Platypi'] text-[14px] text-black tracking-[-0.42px]" style={{ lineHeight: 1.2 }}>
                {selectedFiles.length} file(s) selected
              </p>
              <p className="font-['IBM_Plex_Mono'] text-[10px] text-[#999]">tap to add more</p>
            </>
          ) : (
            <>
              <Upload size={24} color="rgba(0,0,0,0.4)" strokeWidth={1.5} />
              <p className="font-['Platypi'] text-[14px] text-black/60 tracking-[-0.42px]" style={{ lineHeight: 1.2 }}>
                Drop .cube files here
              </p>
              <p className="font-['IBM_Plex_Mono'] text-[10px] text-[#999]">or tap to browse</p>
            </>
          )}
        </motion.button>

        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-[6px] mt-[12px]">
            {selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-[8px] bg-black/4 rounded-[8px] px-[10px] py-[6px]">
                <span className="flex-1 font-['IBM_Plex_Mono'] text-[10px] text-black/70 truncate">{f.name}</span>
                <span className="font-['IBM_Plex_Mono'] text-[9px] text-[#999]">{(f.size / 1024).toFixed(0)}KB</span>
                <button type="button" onClick={() => removeFile(i)} className="size-[18px] flex items-center justify-center rounded-full hover:bg-red-500/10">
                  <X size={10} color="#999" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}

        {userPacks.length > 0 && !targetPackId && (
          <div className="flex flex-col gap-[8px] mt-[16px]">
            <p className="font-['IBM_Plex_Mono'] text-[10px] text-[#999]">Or add to existing pack</p>
            <div className="flex gap-[6px] flex-wrap">
              {userPacks.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setPackName(pack.name)}
                  className={`px-[12px] py-[6px] rounded-full font-['IBM_Plex_Mono'] text-[10px] max-w-[130px] truncate ${
                    resolvedPack?.id === pack.id ? "bg-black text-white" : "bg-black/8 text-black/70"
                  }`}
                >
                  {pack.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {canSavePack && (
          <div className="flex justify-center mt-[16px]">
            <motion.button
              type="button"
              onClick={handleImport}
              disabled={importing}
              whileTap={{ scale: 0.96 }}
              className="bg-black text-white font-['Platypi'] text-[14px] tracking-[-0.42px] px-[24px] py-[12px] rounded-[30px]"
              style={{ lineHeight: 1.2 }}
            >
              {importing
                ? "Importing\u2026"
                : selectedFiles.length > 0
                  ? `Create & Import (${selectedFiles.length})`
                  : "Create pack"}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
