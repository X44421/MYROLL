import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Photo, Preset, PresetPack, EditState } from '../lib/data/filmTypes';
import { DEFAULT_EDIT_STATE } from '../lib/data/filmTypes';
import { BUILTIN_PACKS, PRESET_MAP, loadCubePresets } from '../lib/data/filmStocks';
import { buildCSSFromAdjust } from '../lib/data/filterUtils';
import { savePhoto, deletePhotoRecord, getAllPhotos, getProcessedBlobUrl, getPresetLibrary, savePresetLibrary } from '../lib/storage';

// Clean up old storage keys
try { localStorage.removeItem('3dlut-app-storage'); } catch {}
try { localStorage.removeItem('myroll-storage'); } catch {}

export type Tab = "gallery" | "presets";

export type Overlay =
  | { type: "collectionDetail"; collectionId: string }
  | { type: "itemDetail"; itemId: string }
  | { type: "newCollection"; attachItemId?: string; targetPackId?: string }
  | { type: "newCollectionMade"; collectionId: string };

export type Status = "loading" | "ready";

interface AppState {
  status: Status;
  activeTab: Tab;
  overlayStack: Overlay[];
  photos: Photo[];

  getPhoto: (id: string) => Photo | undefined;
  importPhoto: (file: File) => Promise<string>;
  updateEditState: (photoId: string, state: EditState) => void;
  deletePhoto: (photoId: string) => void;

  presets: Record<string, Preset>;
  packs: PresetPack[];
  getPack: (id: string) => PresetPack | undefined;
  presetsInPack: (packId: string) => Preset[];
  importLUT: (file: File, packId?: string) => Promise<string>;
  createPack: (name: string) => string;
  addPresetToPack: (presetId: string, packId: string) => void;
  savePreset: (name: string, snapshot: NonNullable<Preset["snapshot"]>) => string;
  deletePreset: (presetId: string) => void;
  deletePack: (packId: string) => void;

  setTab: (t: Tab) => void;
  pushOverlay: (o: Overlay) => void;
  popOverlay: () => void;
  closeOverlays: () => void;
}

function persistPresetLibrary(presets: Record<string, Preset>, packs: PresetPack[]) {
  const customPresets = Object.fromEntries(Object.entries(presets).filter(([, preset]) => preset.kind !== 'builtin'));
  void savePresetLibrary({ presets: customPresets, packs }).catch((error) => {
    console.warn('Could not save preset library', error);
  });
}

function computeTint(snapshot: NonNullable<Preset["snapshot"]>): string | undefined {
  const { temperature, tint: tintVal } = snapshot.adjust;
  if (temperature === 0 && tintVal === 0) return undefined;
  let r = 200, g = 200, b = 200;
  if (temperature > 0) { r += Math.round(temperature * 0.4); g -= Math.round(temperature * 0.1); }
  else if (temperature < 0) { b += Math.round(Math.abs(temperature) * 0.4); r -= Math.round(Math.abs(temperature) * 0.1); }
  if (tintVal > 0) { r += Math.round(tintVal * 0.4); g -= Math.round(tintVal * 0.15); b -= Math.round(tintVal * 0.15); }
  else if (tintVal < 0) { g += Math.round(Math.abs(tintVal) * 0.3); r -= Math.round(Math.abs(tintVal) * 0.1); }
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  const alpha = Math.min(0.12, (Math.abs(temperature) + Math.abs(tintVal)) / 2000);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      status: 'ready',
      activeTab: 'gallery',
      overlayStack: [],

      photos: [],
      getPhoto: (id: string) => get().photos.find((p) => p.id === id),
      importPhoto: async (file: File): Promise<string> => {
        const isRaw = !!file.name.match(/\.(cr2|cr3|nef|arw|dng|raw|orf|rw2|tif|tiff|heic|heif)$/i);
        const blob = isRaw ? await (async () => {
          const { loadImageFromFile } = await import('../lib/rawLoader');
          const src = await loadImageFromFile(file);
          try {
            const resp = await fetch(src);
            return await resp.blob();
          } finally {
            URL.revokeObjectURL(src);
          }
        })() : file;
        const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const dataUrl = URL.createObjectURL(blob);
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = dataUrl; });
          const { width, height } = { width: img.naturalWidth, height: img.naturalHeight };
          // Decode once for dimensions and thumbnail, then persist the original blob.
          let thumbUrl: string | undefined;
          const c = document.createElement("canvas");
          const maxDim = 256;
          const s = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
          c.width = Math.max(1, Math.round(img.naturalWidth * s));
          c.height = Math.max(1, Math.round(img.naturalHeight * s));
          const context = c.getContext("2d");
          if (context) {
            context.drawImage(img, 0, 0, c.width, c.height);
            thumbUrl = c.toDataURL("image/jpeg", 0.7);
          }
          const name = file.name.replace(/\.[^.]+$/, "");
          await savePhoto(id, blob, width, height, name);
          set((state) => ({
            photos: [
              { id, dataUrl, thumbUrl, name, width, height, editState: { ...DEFAULT_EDIT_STATE } },
              ...state.photos,
            ],
          }));
          return id;
        } catch (error) {
          URL.revokeObjectURL(dataUrl);
          throw error;
        }
      },
      updateEditState: (photoId: string, state: EditState) => {
        set((s) => ({
          photos: s.photos.map((p) => (p.id === photoId ? { ...p, editState: state } : p)),
        }));
      },
      deletePhoto: (photoId: string) => {
        deletePhotoRecord(photoId);
        const photo = get().getPhoto(photoId);
        if (photo?.dataUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.dataUrl);
        if (photo?.processedUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.processedUrl);
        set((s) => ({ photos: s.photos.filter((p) => p.id !== photoId) }));
      },

      presets: PRESET_MAP,
      packs: BUILTIN_PACKS,
      getPack: (id: string) => get().packs.find((p) => p.id === id),
      presetsInPack: (packId: string) => {
        const pack = get().getPack(packId);
        if (!pack) return [];
        return pack.presetIds.map((id) => get().presets[id]).filter(Boolean) as Preset[];
      },
      importLUT: async (file: File, packId?: string): Promise<string> => {
        const { parseCubeText, buildCSSApproximation } = await import('../lib/cubeParser');
        const text = await file.text();
        const { size, data, title } = parseCubeText(text);
        const filterCSS = buildCSSApproximation(data, size);
        const id = `lut-${Date.now()}`;
        const name = (title || file.name.replace(/\.(cube|3dl)$/i, "")).replace(/[_-]/g, " ");
        const preset: Preset = { id, name, kind: "imported", filterCSS, grain: 0, lutData: data, lutSize: size };
        set((s) => ({ presets: { ...s.presets, [id]: preset } }));
        const targetPackId = packId ?? `pack-imported`;
        set((s) => {
          const existing = s.packs.find((pk) => pk.id === targetPackId);
          if (existing) {
            return {
              packs: s.packs.map((pk) =>
                pk.id === targetPackId ? { ...pk, presetIds: [...pk.presetIds, id] } : pk
              ),
            };
          }
          return { packs: [...s.packs, { id: targetPackId, name: "Imported LUTs", presetIds: [id] }] };
        });
        persistPresetLibrary(get().presets, get().packs);
        return id;
      },
      createPack: (name: string) => {
        const id = `pack-${Date.now()}`;
        set((s) => ({ packs: [...s.packs, { id, name: name.trim() || "New Pack", presetIds: [] }] }));
        persistPresetLibrary(get().presets, get().packs);
        return id;
      },
      addPresetToPack: (presetId: string, packId: string) => {
        set((s) => ({
          packs: s.packs.map((p) =>
            p.id === packId && !p.presetIds.includes(presetId)
              ? { ...p, presetIds: [...p.presetIds, presetId] }
              : p
          ),
        }));
        persistPresetLibrary(get().presets, get().packs);
      },

      savePreset: (name: string, snapshot: NonNullable<Preset["snapshot"]>) => {
        const id = `user-${Date.now()}`;
        const filterCSS = buildCSSFromAdjust(snapshot.adjust);
        const grain = snapshot.grain.amount / 100;
        const tint = computeTint(snapshot);
        const preset: Preset = { id, name, kind: "user", filterCSS, grain, tint, snapshot };
        set((s) => ({ presets: { ...s.presets, [id]: preset } }));
        const packId = "pack-user";
        set((s) => {
          const existing = s.packs.find((pk) => pk.id === packId);
          if (existing) {
            return {
              packs: s.packs.map((pk) =>
                pk.id === packId ? { ...pk, presetIds: [id, ...pk.presetIds] } : pk
              ),
            };
          }
          return { packs: [{ id: packId, name: "My Presets", presetIds: [id] }, ...s.packs] };
        });
        persistPresetLibrary(get().presets, get().packs);
        return id;
      },

      deletePreset: (presetId: string) => {
        set((s) => {
          const { [presetId]: _, ...rest } = s.presets;
          return {
            presets: rest,
            packs: s.packs.map((p) => ({
              ...p,
              presetIds: p.presetIds.filter((id) => id !== presetId),
            })),
          };
        });
        persistPresetLibrary(get().presets, get().packs);
      },
      deletePack: (packId: string) => {
        set((s) => {
          const pack = s.packs.find((p) => p.id === packId);
          if (!pack) return s;
          const toDelete = new Set(pack.presetIds);
          const remainingPresets: Record<string, Preset> = {};
          for (const [id, preset] of Object.entries(s.presets)) {
            if (!toDelete.has(id)) remainingPresets[id] = preset;
          }
          return {
            packs: s.packs.filter((p) => p.id !== packId),
            presets: remainingPresets,
          };
        });
        persistPresetLibrary(get().presets, get().packs);
      },

      setTab: (t: Tab) => set({ activeTab: t, overlayStack: [] }),
      pushOverlay: (o: Overlay) => set((s) => ({ overlayStack: [...s.overlayStack, o] })),
      popOverlay: () => set((s) => ({ overlayStack: s.overlayStack.slice(0, -1) })),
      closeOverlays: () => set({ overlayStack: [] }),
    }),
    {
      name: 'myroll-storage-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        photos: state.photos.map(({ dataUrl: _, processedUrl: _p, ...rest }) => rest),
        activeTab: state.activeTab,
      }),
      onRehydrateStorage: () => async (state) => {
        if (!state) return;
        const library = await getPresetLibrary().catch(() => undefined);
        const restoredPresets: Record<string, Preset> = { ...(state.presets as Record<string, Preset>), ...(library?.presets ?? {}) };
        for (const preset of Object.values(restoredPresets) as Preset[]) {
          if (preset.lutData && !(preset.lutData instanceof Float32Array)) {
            preset.lutData = new Float32Array(preset.lutData as unknown as number[]);
          }
        }
        useAppStore.setState((current) => ({
          presets: { ...current.presets, ...restoredPresets },
          packs: library?.packs ?? state.packs,
        }));
        // Restore photo blob URLs from IndexedDB
        try {
          const records = await getAllPhotos();
          if (records.length > 0 && state.photos.length === 0) {
            // Fresh rehydrate: build photos array from IndexedDB records
            // Filter out processed_* records (width=0,height=0) which would
            // cause the masonry algorithm to produce NaN and collapse to one column
            state.photos = records
              .filter((r) => !r.id.startsWith("processed_"))
              .map((r) => ({
              id: r.id,
              dataUrl: URL.createObjectURL(r.blob),
              thumbUrl: undefined as string | undefined,
              name: r.name,
              width: r.width,
              height: r.height,
              editState: { ...DEFAULT_EDIT_STATE },
            }));
          } else {
            // Rehydrate: restore dataUrl for each persisted photo
            for (const photo of state.photos) {
              const rec = records.find((r) => r.id === photo.id);
              if (rec) (photo as any).dataUrl = URL.createObjectURL(rec.blob);
            }
            // Restore processedUrl from IndexedDB
            for (const photo of state.photos) {
              const procUrl = await getProcessedBlobUrl(photo.id);
              if (procUrl) (photo as any).processedUrl = procUrl;
            }
          }
        } catch {}
      },
    }
  )
);

// Load built-in cube LUTs into the store after initialization
loadCubePresets().then((cubePresets) => {
  useAppStore.setState((s) => ({
    presets: { ...s.presets, ...cubePresets },
  }));
});
