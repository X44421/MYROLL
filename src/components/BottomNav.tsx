import { useRef } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { SPRING, T } from "../lib/motion/tokens";

type Tab = "gallery" | "presets";

const ICONS: Record<Tab, { viewBox: string; d: string; size: number }> = {
  gallery: {
    viewBox: "0 0 17 17",
    d: "M1.5 2.5C1.5 1.948 1.948 1.5 2.5 1.5H14.5C15.052 1.5 15.5 1.948 15.5 2.5V14.5C15.5 15.052 15.052 15.5 14.5 15.5H2.5C1.948 15.5 1.5 15.052 1.5 14.5V2.5ZM3 3V14H14V3H3ZM5 9.5L7.5 6.5L9.5 9L11 7.5L14 11H3.5L5 9.5ZM5.75 7C5.75 6.31 6.31 5.75 7 5.75C7.69 5.75 8.25 6.31 8.25 7C8.25 7.69 7.69 8.25 7 8.25C6.31 8.25 5.75 7.69 5.75 7Z",
    size: 17,
  },
  presets: {
    viewBox: "0 0 17 17",
    d: "M1.5 4.5H4.5V3H6V4.5H15.5V6H6V7.5H4.5V6H1.5V4.5ZM1.5 10.5H11V9H12.5V10.5H15.5V12H12.5V13.5H11V12H1.5V10.5Z",
    size: 17,
  },
};

function NavIcon({ tab }: { tab: Tab }) {
  const { viewBox, d, size } = ICONS[tab];
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none">
      <path d={d} fill="white" fillRule="evenodd" />
    </svg>
  );
}

const TABS: Tab[] = ["gallery", "presets"];

export function BottomNav({
  variant = "light",
  visible = true,
}: {
  variant?: "light" | "dark";
  visible?: boolean;
}) {
  const { activeTab, setTab, importPhoto } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importPhoto(file);
    e.target.value = "";
  };

  return (
    <div className="absolute bottom-0 left-0 w-full flex justify-center pb-[34px] px-[10px] pointer-events-none z-40">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <motion.div
        animate={{ y: visible ? 0 : 140, opacity: visible ? 1 : 0 }}
        transition={SPRING}
        style={{
          background:
            variant === "dark" ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.3)",
          backdropFilter: "blur(16px)",
          boxShadow: "0px 4px 21px rgba(0,0,0,0.25)",
        }}
        className="flex gap-[12px] items-center p-[8px] rounded-full pointer-events-auto"
      >
        <motion.button
          key={TABS[0]}
          type="button"
          onClick={() => setTab(TABS[0])}
          whileTap={{ scale: 0.9 }}
          transition={T.micro}
          aria-label={TABS[0]}
          aria-pressed={activeTab === TABS[0]}
          className="relative flex items-center justify-center size-[50px] rounded-full"
        >
          {activeTab === TABS[0] && (
            <motion.span
              layoutId="navPill"
              transition={SPRING}
              className="absolute inset-0 rounded-full bg-black"
            />
          )}
          <span className="relative z-10">
            <NavIcon tab={TABS[0]} />
          </span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          whileTap={{ scale: 0.9 }}
          transition={T.micro}
          aria-label="Import photo"
          className="relative flex items-center justify-center size-[56px] rounded-full bg-white"
        >
          <Plus size={22} color="black" strokeWidth={2.5} />
        </motion.button>

        <motion.button
          key={TABS[1]}
          type="button"
          onClick={() => setTab(TABS[1])}
          whileTap={{ scale: 0.9 }}
          transition={T.micro}
          aria-label={TABS[1]}
          aria-pressed={activeTab === TABS[1]}
          className="relative flex items-center justify-center size-[50px] rounded-full"
        >
          {activeTab === TABS[1] && (
            <motion.span
              layoutId="navPill"
              transition={SPRING}
              className="absolute inset-0 rounded-full bg-black"
            />
          )}
          <span className="relative z-10">
            <NavIcon tab={TABS[1]} />
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
