import { useState, useEffect, useRef } from "react";

export function SavePresetModal({ onSave, onClose }: {
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[16px] w-[280px] p-[20px] flex flex-col gap-[14px]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-['IBM_Plex_Mono'] text-[12px] text-black font-medium">
          Save Settings
        </span>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          placeholder="My Preset"
          className="w-full px-[10px] py-[8px] rounded-[8px] bg-[#f4f4f4] text-[13px] text-black outline-none placeholder:text-[#999]"
        />
        <div className="flex gap-[6px]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-[8px] rounded-[8px] bg-[#f4f4f4] text-[11px] text-black/60 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-[8px] rounded-[8px] bg-black text-[11px] text-white font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
