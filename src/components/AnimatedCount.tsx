import { AnimatePresence, motion } from "motion/react";
import { T } from "../lib/motion/tokens";

export function AnimatedCount({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-block tabular-nums ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={T.base}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
