import { motion } from "motion/react";
import { SPRING, SPRING_HERO } from "../../lib/motion/tokens";
import type { Photo } from "../../lib/data/filmTypes";

export function PhotoCard({
  photo,
  onOpen,
}: {
  photo: Photo;
  onOpen: () => void;
}) {
  const ratio = photo.height / photo.width || 0.75;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      layout
      whileTap={{ scale: 0.97 }}
      transition={SPRING}
      className="block w-full"
    >
      <div
        className="relative w-full bg-[#e8e5e0] overflow-hidden"
        style={{ aspectRatio: `1 / ${ratio}` }}
      >
        <motion.div
          layoutId={`art-${photo.id}`}
          transition={SPRING_HERO}
          className="absolute inset-0"
        >
          <img
            src={photo.thumbUrl || photo.dataUrl}
            alt={photo.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </motion.div>
      </div>
    </motion.button>
  );
}
