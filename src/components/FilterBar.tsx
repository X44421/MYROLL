import { motion } from "motion/react";
import { SPRING } from "../lib/motion/tokens";

export function FilterBar<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  justify = "between",
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  justify?: "between" | "start";
}) {
  return (
    <div
      className={`flex items-center gap-[18px] w-full ${
        justify === "between" ? "justify-between" : "justify-start"
      }`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="relative pb-[6px]"
          >
            <motion.span
              animate={{ opacity: active ? 1 : 0.4 }}
              transition={{ duration: 0.14 }}
              className="font-['IBM_Plex_Mono'] text-[12px] text-black tracking-[-0.22px] whitespace-nowrap"
            >
              {opt.label}
            </motion.span>
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING}
                className="absolute left-0 right-0 bottom-0 h-[1.5px] bg-black rounded-full"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
