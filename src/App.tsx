import { lazy, Suspense } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { useAppStore, type Overlay } from "./store/appStore";
import { GalleryScreen } from "./components/screens/GalleryScreen";
import { PresetsScreen } from "./components/screens/PresetsScreen";
import { PresetPackDetailScreen } from "./components/screens/PresetPackDetailScreen";
import { ImportLUTScreen } from "./components/screens/ImportLUTScreen";
import { PackCreatedScreen } from "./components/screens/PackCreatedScreen";
import { BottomNav } from "./components/BottomNav";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { slideUp, scrim, expandIn, settleIn, tabContent } from "./lib/motion/tokens";

const PhotoEditorScreen = lazy(() => import("./components/screens/PhotoEditorScreen").then((module) => ({ default: module.PhotoEditorScreen })));

function overlayKey(o: Overlay) {
  if (o.type === "collectionDetail") return `cd-${o.collectionId}`;
  if (o.type === "itemDetail") return `id-${o.itemId}`;
  if (o.type === "newCollectionMade") return `ncm-${o.collectionId}`;
  return `nc-${o.attachItemId ?? "root"}`;
}

function renderOverlay(o: Overlay) {
  switch (o.type) {
    case "collectionDetail":
      return <PresetPackDetailScreen packId={o.collectionId} />;
    case "itemDetail":
      return <Suspense fallback={<div className="size-full bg-[#1c1c1c]" />}><PhotoEditorScreen photoId={o.itemId} /></Suspense>;
    case "newCollection":
      return <ImportLUTScreen targetPackId={o.targetPackId} attachPhotoId={o.attachItemId} />;
    case "newCollectionMade":
      return <PackCreatedScreen packId={o.collectionId} />;
  }
}

function variantsFor(o: Overlay) {
  if (o.type === "newCollection") return slideUp;
  if (o.type === "newCollectionMade") return settleIn;
  return expandIn;
}

function Shell() {
  const { activeTab, overlayStack } = useAppStore();
  const topOverlay = overlayStack[overlayStack.length - 1];
  const navVisible = topOverlay?.type !== "itemDetail";

  return (
    <div className="relative size-full overflow-hidden bg-[#f4f4f4]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          variants={tabContent}
          initial="hidden"
          animate="show"
          exit="exit"
          className="absolute inset-0"
        >
          {activeTab === "gallery" && <GalleryScreen />}
          {activeTab === "presets" && <PresetsScreen />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {overlayStack.map((o, i) => {
          if (o.type === "itemDetail") {
            return (
              <motion.div
                key={overlayKey(o) + "-" + i}
                className="fixed inset-0 z-50"
              >
                {renderOverlay(o)}
              </motion.div>
            );
          }
          const isSheet = o.type === "newCollection";
          return (
            <motion.div
              key={overlayKey(o) + "-" + i}
              variants={scrim}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 z-20 bg-black/30"
            >
              <motion.div
                variants={variantsFor(o)}
                initial="hidden"
                animate="show"
                exit="exit"
                className={`absolute inset-0 ${isSheet ? "top-[8px]" : ""}`}
              >
                {renderOverlay(o)}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <BottomNav variant="light" visible={navVisible} />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="size-full bg-[#f4f4f4]">
        <div className="relative w-full h-full">
          <ErrorBoundary><Shell /></ErrorBoundary>
        </div>
      </div>
      <Toaster theme="dark" position="top-center" />
    </MotionConfig>
  );
}
