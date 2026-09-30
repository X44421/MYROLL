import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoreVertical, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "../../store/appStore";
import type { EditState, Preset } from "../../lib/data/filmTypes";
import { DEFAULT_EDIT_STATE } from "../../lib/data/filmTypes";
import { SavePresetModal } from "../SavePresetModal";
import { LUTProcessor } from "../../lib/webgl";
import { saveProcessedBlob } from "../../lib/storage";
import type { ILUTProcessor, RenderParams } from "../../lib/processor";
import { EditorSlider } from "../EditorSlider";



type EditorTab = "film" | "color" | "grain" | "effects";

const TABS: { id: EditorTab; label: string }[] = [
  { id: "film", label: "Film" },
  { id: "color", label: "Color" },
  { id: "grain", label: "Grain" },
  { id: "effects", label: "FX" },
];

const DEFAULT_GRAIN_SEED = 1.337;
const EXPORT_MAX_DIMENSION = 2560;
const HSL_BANDS = ["Red", "Orange", "Yellow", "Green", "Aqua", "Blue", "Purple", "Magenta"] as const;

const BORDER_OPTIONS = [
  { id: 0, label: "Off" },
  { id: 1, label: "White" },
  { id: 2, label: "Black" },
  { id: 3, label: "Film" },
];

function getPhotoEffectSeed(photoId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < photoId.length; i++) hash = Math.imul(hash ^ photoId.charCodeAt(i), 16777619);
  return (hash >>> 0) / 0xffffffff;
}

function buildRenderParamsFromEditState(editState: EditState, time: number, leakSeed = 0.337): RenderParams {
  const { adjust, grain, effects, hsl, splitTone, lut, crop } = editState;
  return {
    exposure: (adjust.exposure / 100) * 2,
    contrast: 1 + (adjust.contrast / 100) * 0.5,
    temperature: adjust.temperature / 100,
    tint: adjust.tint / 100,
    shadows: adjust.shadows / 100,
    highlights: adjust.highlights / 100,
    saturation: 1 + (adjust.saturation / 100) * 0.5,
    intensity: lut.intensity / 100,
    vignette: adjust.vignette / 100,
    grain: grain.amount / 100,
    grainSize: grain.size,
    grainType: grain.type === "fine" ? 0 : grain.type === "medium" ? 1 : 2,
    halation: effects.halation / 100,
    lightLeak: effects.lightLeak / 100,
    bloom: effects.bloom / 100,
    dispersion: effects.dispersion / 100,
    hslH: new Float32Array(hsl.h),
    hslS: new Float32Array(hsl.s),
    hslL: new Float32Array(hsl.l),
    splitShadowsHue: splitTone.shadowsHue / 360,
    splitShadowsSat: splitTone.shadowsSat / 100,
    splitHighlightsHue: splitTone.highlightsHue / 360,
    splitHighlightsSat: splitTone.highlightsSat / 100,
    splitBalance: splitTone.balance / 100,
    fade: adjust.fade / 100,
    borderMode: crop.borderMode,
    borderWidth: crop.borderWidth,
    lut4DAxis: lut.axis / 100,
    time,
    grainSeed: DEFAULT_GRAIN_SEED,
    leakSeed,
  };
}

const FilmStrip = memo(function FilmStrip({ colorPresets, bwPresets, activePresetId, onSelect, photoDataUrl, thumbMap }: {
  colorPresets: Preset[]; bwPresets: Preset[]; activePresetId: string; onSelect: (preset: Preset) => void; photoDataUrl: string; thumbMap: Record<string, string>;
}) {
  const renderThumb = (preset: Preset) => {
    const active = activePresetId === preset.id;
    const src = thumbMap[preset.id] || photoDataUrl;
    return (
      <button key={preset.id} onClick={() => onSelect(preset)}
        className={`flex-shrink-0 flex flex-col items-center gap-[4px] ${active ? "opacity-100" : "opacity-50"} ${active ? "scale-105" : "scale-100"}`}>
        <div className="relative w-[64px] h-[64px] overflow-hidden"
          style={{
            background: "#444",
            boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.9)" : undefined,
          }}>
          <img src={src} alt={preset.name} className="w-full h-full object-cover"
            style={!thumbMap[preset.id] && preset.filterCSS !== "none" ? { filter: preset.filterCSS } : undefined} />
        </div>
        <span className="text-white/80 text-[10px] whitespace-nowrap max-w-[64px] truncate">
          {preset.name}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-[12px] pb-[4px]">
      {colorPresets.length > 0 && (
        <div>
          <span className="font-['IBM_Plex_Mono'] text-[9px] text-white/40 ml-[8px] mb-[4px] block">Color</span>
          <div className="flex gap-[8px] overflow-x-auto no-scrollbar py-[4px] px-[8px]">
            {colorPresets.map(renderThumb)}
          </div>
        </div>
      )}
      {bwPresets.length > 0 && (
        <div>
          <span className="font-['IBM_Plex_Mono'] text-[9px] text-white/40 ml-[8px] mb-[4px] block">B&amp;W</span>
          <div className="flex gap-[8px] overflow-x-auto no-scrollbar py-[4px] px-[8px]">
            {bwPresets.map(renderThumb)}
          </div>
        </div>
      )}
    </div>
  );
});

const ColorPanel = memo(function ColorPanel({ exposure, contrast, saturation, temperature, tint, shadows, highlights,
  hsl, splitTone, onChange, onLiveChange, onHslChange, onHslLiveChange, onSplitToneChange, onSplitToneLiveChange }: {
  exposure: number; contrast: number; saturation: number; temperature: number; tint: number; shadows: number; highlights: number;
  hsl: EditState["hsl"];
  splitTone: EditState["splitTone"];
  onChange: (patch: Partial<EditState["adjust"]>) => void;
  onLiveChange?: (patch: Partial<EditState["adjust"]>) => void;
  onHslChange: (patch: Partial<EditState["hsl"]>) => void;
  onHslLiveChange?: (patch: Partial<EditState["hsl"]>) => void;
  onSplitToneChange: (patch: Partial<EditState["splitTone"]>) => void;
  onSplitToneLiveChange?: (patch: Partial<EditState["splitTone"]>) => void;
}) {
  const [activeHslBand, setActiveHslBand] = useState(0);
  const changeHsl = (key: "h" | "s" | "l", value: number, live: boolean) => {
    const values = [...hsl[key]];
    values[activeHslBand] = value / 100;
    const patch = key === "h" ? { h: values } : key === "s" ? { s: values } : { l: values };
    if (live) onHslLiveChange?.(patch);
    else onHslChange(patch);
  };
  return (
    <div className="flex flex-col gap-[14px] pb-[8px]">
      <EditorSlider label="Exposure" value={exposure} min={-100} max={100} defaultValue={0} onChange={(v) => onChange({ exposure: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ exposure: v }) : undefined} />
      <EditorSlider label="Contrast" value={contrast} min={-100} max={100} defaultValue={0} onChange={(v) => onChange({ contrast: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ contrast: v }) : undefined} />
      <EditorSlider label="Saturation" value={saturation} min={-100} max={100} defaultValue={0} onChange={(v) => onChange({ saturation: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ saturation: v }) : undefined} />
      <EditorSlider label="Temperature" value={temperature} min={-100} max={100} defaultValue={0} onChange={(v) => onChange({ temperature: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ temperature: v }) : undefined} />
      <EditorSlider label="Tint" value={tint} min={-100} max={100} defaultValue={0} onChange={(v) => onChange({ tint: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ tint: v }) : undefined} />
      <EditorSlider label="Shadows" value={shadows} min={-100} max={100} defaultValue={0} onChange={(v) => onChange({ shadows: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ shadows: v }) : undefined} />
      <EditorSlider label="Highlights" value={highlights} min={-100} max={100} defaultValue={0} onChange={(v) => onChange({ highlights: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ highlights: v }) : undefined} />
      <div className="h-px bg-white/10 my-[2px]" />
      <span className="font-['IBM_Plex_Mono'] text-[10px] text-white/60">HSL</span>
      <div className="grid grid-cols-4 gap-[4px]">
        {HSL_BANDS.map((band, index) => (
          <button key={band} type="button" onClick={() => setActiveHslBand(index)}
            className={`py-[5px] rounded-full text-[9px] transition-colors ${activeHslBand === index ? "bg-white text-black" : "bg-white/5 text-white/55 hover:text-white/80"}`}>
            {band}
          </button>
        ))}
      </div>
      <EditorSlider label={`${HSL_BANDS[activeHslBand]} hue`} value={Math.round(hsl.h[activeHslBand] * 100)} min={-100} max={100} defaultValue={0}
        onChange={(v) => changeHsl("h", v, false)} onLiveChange={onHslLiveChange ? (v) => changeHsl("h", v, true) : undefined} />
      <EditorSlider label={`${HSL_BANDS[activeHslBand]} saturation`} value={Math.round(hsl.s[activeHslBand] * 100)} min={-100} max={100} defaultValue={0}
        onChange={(v) => changeHsl("s", v, false)} onLiveChange={onHslLiveChange ? (v) => changeHsl("s", v, true) : undefined} />
      <EditorSlider label={`${HSL_BANDS[activeHslBand]} lightness`} value={Math.round(hsl.l[activeHslBand] * 100)} min={-100} max={100} defaultValue={0}
        onChange={(v) => changeHsl("l", v, false)} onLiveChange={onHslLiveChange ? (v) => changeHsl("l", v, true) : undefined} />
      <div className="h-px bg-white/10 my-[2px]" />
      <span className="font-['IBM_Plex_Mono'] text-[10px] text-white/60">Split tone</span>
      <EditorSlider label="Shadows hue" value={splitTone.shadowsHue} min={-180} max={180} defaultValue={0} unit="°"
        onChange={(v) => onSplitToneChange({ shadowsHue: v })} onLiveChange={onSplitToneLiveChange ? (v) => onSplitToneLiveChange({ shadowsHue: v }) : undefined} />
      <EditorSlider label="Shadows amount" value={splitTone.shadowsSat} min={0} max={100} defaultValue={0}
        onChange={(v) => onSplitToneChange({ shadowsSat: v })} onLiveChange={onSplitToneLiveChange ? (v) => onSplitToneLiveChange({ shadowsSat: v }) : undefined} />
      <EditorSlider label="Highlights hue" value={splitTone.highlightsHue} min={-180} max={180} defaultValue={0} unit="°"
        onChange={(v) => onSplitToneChange({ highlightsHue: v })} onLiveChange={onSplitToneLiveChange ? (v) => onSplitToneLiveChange({ highlightsHue: v }) : undefined} />
      <EditorSlider label="Highlights amount" value={splitTone.highlightsSat} min={0} max={100} defaultValue={0}
        onChange={(v) => onSplitToneChange({ highlightsSat: v })} onLiveChange={onSplitToneLiveChange ? (v) => onSplitToneLiveChange({ highlightsSat: v }) : undefined} />
      <EditorSlider label="Balance" value={splitTone.balance} min={-100} max={100} defaultValue={0}
        onChange={(v) => onSplitToneChange({ balance: v })} onLiveChange={onSplitToneLiveChange ? (v) => onSplitToneLiveChange({ balance: v }) : undefined} />
    </div>
  );
});

const GrainPanel = memo(function GrainPanel({ amount, size, type, onChange, onLiveChange }: {
  amount: number; size: number; type: "fine" | "medium" | "coarse";
  onChange: (patch: Partial<EditState["grain"]>) => void;
  onLiveChange?: (patch: Partial<EditState["grain"]>) => void;
}) {
  return (
    <div className="flex flex-col gap-[14px] pb-[8px]">
      <EditorSlider label="Amount" value={amount} min={0} max={100} defaultValue={0} onChange={(v) => onChange({ amount: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ amount: v }) : undefined} />
      <EditorSlider label="Size" value={Math.round(size * 33)} min={17} max={100} defaultValue={33} onChange={(v) => onChange({ size: v / 33 })} onLiveChange={onLiveChange ? (v) => onLiveChange({ size: v / 33 }) : undefined} />
      <div className="flex flex-col gap-[6px]">
        <span className="font-['IBM_Plex_Mono'] text-[10px] text-white/60">Grain type</span>
        <div className="flex gap-[6px]">
          {(["fine", "medium", "coarse"] as const).map((t) => (
            <button key={t} onClick={() => onChange({ type: t })}
              className={`flex-1 py-[3px] rounded-full text-[10px] font-medium transition-colors active:scale-90 ${type === t ? "bg-white text-black" : "text-white/50 hover:text-white/70"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

const EffectsPanel = memo(function EffectsPanel({ halation, lightLeak, bloom, dispersion, fade, vignette, borderMode, borderWidth, onChange, onLiveChange }: {
  halation: number; lightLeak: number; bloom: number; dispersion: number; fade: number; vignette: number; borderMode: number; borderWidth: number;
  onChange: (patch: Partial<EditState["effects"] | EditState["crop"] | EditState["adjust"]>) => void;
  onLiveChange?: (patch: any) => void;
}) {
  return (
    <div className="flex flex-col gap-[14px] pb-[8px]">
      <EditorSlider label="Halation" value={halation} min={0} max={100} defaultValue={0} onChange={(v) => onChange({ halation: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ halation: v }) : undefined} />
      <EditorSlider label="Light Leak" value={lightLeak} min={0} max={100} defaultValue={0} onChange={(v) => onChange({ lightLeak: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ lightLeak: v }) : undefined} />
      <EditorSlider label="Bloom" value={bloom} min={0} max={100} defaultValue={0} onChange={(v) => onChange({ bloom: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ bloom: v }) : undefined} />
      <EditorSlider label="Dispersion" value={dispersion} min={0} max={100} defaultValue={0} onChange={(v) => onChange({ dispersion: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ dispersion: v }) : undefined} />

      <EditorSlider label="Fade" value={fade} min={0} max={100} defaultValue={0} onChange={(v) => onChange({ fade: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ fade: v }) : undefined} />
      <EditorSlider label="Vignette" value={vignette} min={0} max={100} defaultValue={0} onChange={(v) => onChange({ vignette: v })} onLiveChange={onLiveChange ? (v) => onLiveChange({ vignette: v }) : undefined} />
      <div className="h-px bg-white/10 my-[4px]" />
      <span className="font-['IBM_Plex_Mono'] text-[10px] text-white/60">Border</span>
      <div className="flex gap-[4px]">
        {BORDER_OPTIONS.map((opt) => (
          <button key={opt.id} type="button" onClick={() => onChange({ borderMode: opt.id } as any)}
            className={`flex-1 py-[3px] rounded-full text-[10px] font-medium transition-colors active:scale-90 ${borderMode === opt.id ? "bg-white text-black" : "text-white/50 hover:text-white/70"}`}>
            {opt.label}
          </button>
        ))}
      </div>
      {borderMode > 0 && (
        <EditorSlider label="Width" value={Math.round(borderWidth * 100)} min={1} max={15} step={1}
          onChange={(v) => onChange({ borderWidth: v / 100 } as any)} unit="%" defaultValue={4}
          onLiveChange={onLiveChange ? (v) => onLiveChange({ borderWidth: v / 100 }) : undefined} />
      )}
    </div>
  );
});

export function PhotoEditorScreen({ photoId }: { photoId: string }) {
  const getPhoto = useAppStore((s) => s.getPhoto);
  const presets = useAppStore((s) => s.presets);
  const updateEditState = useAppStore((s) => s.updateEditState);
  const popOverlay = useAppStore((s) => s.popOverlay);
  const updateEditStateRef = useRef(updateEditState);
  updateEditStateRef.current = updateEditState;

  const [tab, setTab] = useState<EditorTab>("film");
  const [loading, setLoading] = useState(false);

  const photo = getPhoto(photoId);
  if (!photo) return null;

  const editStateRef = useRef(photo.editState);
  editStateRef.current = photo.editState;
  const editState = photo.editState;

  const savePreset = useAppStore((s) => s.savePreset);
  const originalRef = useRef(editState);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef(0);
  const zoomRef = useRef(1);
  const zoomPendingRef = useRef(false);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const panDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const isPanningRef = useRef(false);
  const dragHandleStartRef = useRef(0);

  const { colorPresets, bwPresets } = useMemo(() => {
    const builtins = Object.values(presets).filter((p) => p.kind === "builtin");
    const others = Object.values(presets).filter((p) => (p.kind === "imported" || p.kind === "user") && (p.snapshot || p.lutData || p.filterCSS !== "none"));
    const color = [...builtins.filter((p) => !p.id.startsWith("bw") && !p.id.startsWith("BW")), ...others.filter((p) => !p.id.startsWith("bw") && !p.id.startsWith("BW"))];
    const bw = [...builtins.filter((p) => p.id.startsWith("bw") || p.id.startsWith("BW")), ...others.filter((p) => p.id.startsWith("bw") || p.id.startsWith("BW"))];
    return { colorPresets: color, bwPresets: bw };
  }, [presets]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<ILUTProcessor | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const dirtyRef = useRef(true);
  const cachedLutRef = useRef<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState(photo.dataUrl);
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});
  const thumbImgRef = useRef<HTMLImageElement | null>(null);
  const thumbGenerationRef = useRef(0);
  const innerImgRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    try {
      const p = new LUTProcessor(canvasRef.current);
      p.setRenderScale(1024);
      processorRef.current = p;
    } catch {
      toast.error("WebGL not supported. Please use a modern browser.");
      return;
    }

    setLoading(true);
    const img = new Image();
    if (photo.dataUrl.startsWith("http")) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled || !processorRef.current) return;
      sourceImageRef.current = img;
      processorRef.current.setImage(img, img.naturalWidth, img.naturalHeight);
      sizeCanvas(img.naturalWidth / img.naturalHeight);
      processorRef.current.render(
        buildRenderParamsFromEditState(editStateRef.current, performance.now() / 1000, getPhotoEffectSeed(photo.id))
      );
      // Generate 96x96 base image + trigger WebGL thumbnails once cube data is ready
      const c = document.createElement("canvas");
      c.width = 96; c.height = 96;
      c.getContext("2d")?.drawImage(img, 0, 0, 96, 96);
      const fallbackUrl = c.toDataURL("image/jpeg", 0.6);
      setThumbUrl(fallbackUrl);
      const small = new Image();
      small.onload = () => {
        thumbImgRef.current = small;
        void genThumbsRef.current(small);
      };
      small.src = fallbackUrl;
      setLoading(false);
    };
    img.onerror = () => {
      if (cancelled) return;
      toast.error("Failed to load image. Try importing again.");
      setLoading(false);
    };
    img.src = photo.dataUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      sourceImageRef.current = null;
      processorRef.current?.dispose();
      processorRef.current = null;
    };
  }, [photo.dataUrl]);

  useEffect(() => {
    const activePreset = presets[editState.presetId];
    if (activePreset?.lutData && activePreset?.lutSize && processorRef.current) {
      if (cachedLutRef.current !== editState.presetId) {
        processorRef.current.setLUT(activePreset.lutSize, activePreset.lutData);
        cachedLutRef.current = editState.presetId;
        processorRef.current.render(buildRenderParamsFromEditState(editStateRef.current, performance.now() / 1000, getPhotoEffectSeed(photo.id)));
        dirtyRef.current = false;
      }
    } else if (processorRef.current) {
      if (cachedLutRef.current) {
        processorRef.current.setLUT(0, new Float32Array(0));
        cachedLutRef.current = null;
      }
    }
  }, [editState.presetId, presets]);

  // Render once on the next frame after committed edits; do not keep an idle RAF alive.
  useEffect(() => {
    dirtyRef.current = true;
    const rafId = requestAnimationFrame(() => {
      if (!dirtyRef.current) return;
      if (processorRef.current) {
        processorRef.current.render(
          buildRenderParamsFromEditState(editStateRef.current, performance.now() / 1000, getPhotoEffectSeed(photo.id))
        );
      }
      dirtyRef.current = false;
    });
    return () => cancelAnimationFrame(rafId);
  }, [editState, photo.id]);

  // Programmatically size canvas to fit preview container
  const sizeCanvas = useCallback((aspect: number) => {
    const cvs = canvasRef.current;
    const parent = cvs?.parentElement;
    if (!cvs || !parent) return;
    const maxH = Math.min(window.innerHeight * 0.45, 380) - 12;
    const maxW = parent.clientWidth;
    let w: number, h: number;
    if (maxW / maxH > aspect) { h = maxH; w = h * aspect; }
    else { w = maxW; h = w / aspect; }
    cvs.style.width = Math.floor(w) + "px";
    cvs.style.height = Math.floor(h) + "px";
  }, []);

  // Generate WebGL-rendered 96x96 thumbnails for all cube presets
  const genThumbs = useCallback(async (srcImg: HTMLImageElement) => {
    const generation = ++thumbGenerationRef.current;
    const cubes = Object.values(presets).filter((p) => p.kind === "builtin" && p.lutData && p.lutSize);
    if (cubes.length === 0) { setThumbMap({}); return; }
    const c = document.createElement("canvas");
    c.width = 96; c.height = 96;
    let proc: ILUTProcessor | null = null;
    try { proc = new LUTProcessor(c); } catch { return; }
    const np: RenderParams = {
      exposure: 0, contrast: 1, temperature: 0, tint: 0, shadows: 0, highlights: 0,
      saturation: 1, intensity: 1, vignette: 0, grain: 0, grainSize: 1, grainType: 1,
      halation: 0, lightLeak: 0, bloom: 0, dispersion: 0, hslH: new Float32Array(8),
      hslS: new Float32Array(8), hslL: new Float32Array(8), splitShadowsHue: 0,
      splitShadowsSat: 0, splitHighlightsHue: 0, splitHighlightsSat: 0,
      splitBalance: 0, fade: 0, borderMode: 0, borderWidth: 0, lut4DAxis: 0.5,
      time: 0, grainSeed: 1.337, leakSeed: getPhotoEffectSeed(photo.id),
    };
    const map: Record<string, string> = {};
    try {
      proc.setRenderScale(96);
      proc.setImage(srcImg, srcImg.naturalWidth, srcImg.naturalHeight);
      for (const preset of cubes) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (generation !== thumbGenerationRef.current) return;
        proc.setLUT(preset.lutSize!, preset.lutData!);
        proc.render(np);
        map[preset.id] = c.toDataURL("image/jpeg", 0.6);
      }
      if (generation === thumbGenerationRef.current) setThumbMap(map);
    } catch (error) {
      console.warn("Could not generate LUT thumbnails", error);
    } finally {
      proc.dispose();
    }
  }, [presets]);

  // Ref to avoid stale closure in small.onload + re-trigger when cubes finish loading
  const genThumbsRef = useRef(genThumbs);
  genThumbsRef.current = genThumbs;
  useEffect(() => {
    const small = thumbImgRef.current;
    if (small && small.width) void genThumbsRef.current(small);
  }, [presets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { thumbGenerationRef.current++; }, []);

  const handleImgPointerDown = useCallback((e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      isPanningRef.current = false;
      panDragStartRef.current = { x: e.clientX, y: e.clientY, panX: panXRef.current, panY: panYRef.current };
    } else if (pointersRef.current.size === 2) {
        clearTimeout(holdTimerRef.current);
        setShowOriginal(false);
        const pts = [...pointersRef.current.values()];
        pinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  }, []);

  const handleImgPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pointersRef.current.size === 1 && zoomRef.current > 1) {
      const dx = e.clientX - panDragStartRef.current.x;
      const dy = e.clientY - panDragStartRef.current.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isPanningRef.current = true;
        clearTimeout(holdTimerRef.current);
        panXRef.current = panDragStartRef.current.panX + dx;
        panYRef.current = panDragStartRef.current.panY + dy;
        if (innerImgRef.current) {
          innerImgRef.current.style.transform = `translate(${panXRef.current}px, ${panYRef.current}px) scale(${zoomRef.current})`;
        }
      }
    }
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const delta = dist / pinchDistRef.current;
      pinchDistRef.current = dist;
      zoomRef.current = Math.min(Math.max(0.5, zoomRef.current * (1 + (delta - 1) * 0.75)), 8);
      if (!zoomPendingRef.current && innerImgRef.current) {
        zoomPendingRef.current = true;
        requestAnimationFrame(() => {
          zoomPendingRef.current = false;
          if (innerImgRef.current) {
            innerImgRef.current.style.transform = zoomRef.current > 1
              ? `translate(${panXRef.current}px, ${panYRef.current}px) scale(${zoomRef.current})`
              : 'none';
          }
        });
      }
    }
  }, []);

  const handleImgPointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    clearTimeout(holdTimerRef.current);
    setShowOriginal(false);
    if (pointersRef.current.size < 2) {
      pinchDistRef.current = 0;
    }
    if (pointersRef.current.size === 0) {
      isPanningRef.current = false;
      if (zoomRef.current <= 1) {
        panXRef.current = 0;
        panYRef.current = 0;
      }
    }
  }, []);

  const handleImgPointerLeave = useCallback(() => {
    pointersRef.current.clear();
    clearTimeout(holdTimerRef.current);
    setShowOriginal(false);
    isPanningRef.current = false;
  }, []);

  const handleDragHandleDown = useCallback((e: React.PointerEvent) => {
    dragHandleStartRef.current = e.clientY;
    if (editorRef.current) {
      editorRef.current.style.transition = 'none';
    }
  }, []);

  const handleDragHandleMove = useCallback((e: React.PointerEvent) => {
    const dy = e.clientY - dragHandleStartRef.current;
    if (dy > 0 && editorRef.current) {
      editorRef.current.style.transform = `translateY(${dy}px)`;
      editorRef.current.style.opacity = `${Math.max(0, 1 - dy / 200)}`;
    }
  }, []);

  const handleDragHandleUp = useCallback(() => {
    const dy = dragHandleStartRef.current > 0 ? Math.abs(parseFloat(editorRef.current?.style.transform?.match(/translateY\(([\d.]+)px\)/)?.[1] || '0')) : 0;
    if (dy > 120) { popOverlay(); return; }
    if (editorRef.current) {
      editorRef.current.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      editorRef.current.style.transform = '';
      editorRef.current.style.opacity = '';
    }
    dragHandleStartRef.current = 0;
  }, [popOverlay]);

  const update = useCallback((patch: Partial<EditState>) => {
    updateEditStateRef.current(photoId, { ...editStateRef.current, ...patch });
  }, [photoId]);

  const applyPreset = useCallback((preset: Preset) => {
    if (editStateRef.current.presetId === preset.id) {
      update({ presetId: "" });
      return;
    }
    if (preset.snapshot) {
      update({
        presetId: preset.id,
        adjust: { ...preset.snapshot.adjust },
        effects: { ...preset.snapshot.effects },
        grain: { ...preset.snapshot.grain },
        hsl: { ...preset.snapshot.hsl, h: [...preset.snapshot.hsl.h], s: [...preset.snapshot.hsl.s], l: [...preset.snapshot.hsl.l] },
        splitTone: { ...preset.snapshot.splitTone },
        lut: { ...preset.snapshot.lut },
      });
    } else {
      update({
        presetId: preset.id,
        grain: { ...editStateRef.current.grain, amount: Math.round(preset.grain * 100) },
      });
    }
  }, [update]);

  const resetAll = useCallback(() => update({
    presetId: "",
    adjust: { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, shadows: 0, highlights: 0, fade: 0, vignette: 0 },
    grain: { amount: 0, size: 1, type: "medium" },
    effects: { halation: 0, lightLeak: 0, bloom: 0, dispersion: 0 },
    hsl: { h: [0, 0, 0, 0, 0, 0, 0, 0], s: [0, 0, 0, 0, 0, 0, 0, 0], l: [0, 0, 0, 0, 0, 0, 0, 0] },
    splitTone: { shadowsHue: 0, shadowsSat: 0, highlightsHue: 0, highlightsSat: 0, balance: 0 },
    lut: { intensity: 100, axis: 50 },
    crop: { borderMode: 0, borderWidth: 0.04 },
  }), [update]);



  const createExportProcessor = useCallback((): ILUTProcessor => {
    const image = sourceImageRef.current;
    if (!image) throw new Error("Photo is still loading");
    const canvas = document.createElement("canvas");
    const processor = new LUTProcessor(canvas);
    try {
      processor.setRenderScale(EXPORT_MAX_DIMENSION);
      processor.setImage(image, image.naturalWidth, image.naturalHeight);
      const preset = useAppStore.getState().presets[editStateRef.current.presetId];
      if (preset?.lutData && preset.lutSize) processor.setLUT(preset.lutSize, preset.lutData);
      return processor;
    } catch (error) {
      processor.dispose();
      throw error;
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!processorRef.current) return;
    const toastId = toast.loading("Exporting photo...");
    let processor: ILUTProcessor | null = null;
    try {
      processor = createExportProcessor();
      const blob = await processor.exportToBlob(
        buildRenderParamsFromEditState(editStateRef.current, performance.now() / 1000, getPhotoEffectSeed(photo.id))
      );
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl; a.download = `${photo.name}-edited.jpg`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
      toast.success("Photo exported successfully", { id: toastId });
    } catch { toast.error("Export failed", { id: toastId }); }
    finally { processor?.dispose(); }
  }, [createExportProcessor, photo.id, photo.name]);

  const handleCancel = useCallback(() => {
    updateEditState(photoId, originalRef.current);
    popOverlay();
  }, [photoId, updateEditState, popOverlay]);

  const handleSaveAndClose = useCallback(async () => {
    if (!processorRef.current) { popOverlay(); return; }
    const toastId = toast.loading("Saving photo...");
    let processor: ILUTProcessor | null = null;
    try {
      processor = createExportProcessor();
      const blob = await processor.exportToBlob(
        buildRenderParamsFromEditState(editStateRef.current, performance.now() / 1000, getPhotoEffectSeed(photo.id))
      );
      const processedUrl = await saveProcessedBlob(photoId, blob);
      let thumbUrl = photo.thumbUrl;
      try {
        const bitmap = await createImageBitmap(blob);
        const c = document.createElement("canvas");
        const scale = Math.min(256 / bitmap.width, 256 / bitmap.height, 1);
        c.width = Math.max(1, Math.round(bitmap.width * scale));
        c.height = Math.max(1, Math.round(bitmap.height * scale));
        c.getContext("2d")?.drawImage(bitmap, 0, 0, c.width, c.height);
        thumbUrl = c.toDataURL("image/jpeg", 0.7);
        bitmap.close();
      } catch { /* Keep the previous thumbnail if this browser cannot decode the blob. */ }
      useAppStore.setState((s) => ({
        photos: s.photos.map((p) =>
          p.id === photoId ? { ...p, thumbUrl, processedUrl, editState: editStateRef.current } : p
        ),
      }));
      if (photo.processedUrl?.startsWith("blob:")) URL.revokeObjectURL(photo.processedUrl);
      toast.success("Photo saved", { id: toastId });
      popOverlay();
    } catch { toast.error("Save failed", { id: toastId }); }
    finally { processor?.dispose(); }
  }, [createExportProcessor, photo.thumbUrl, photo.processedUrl, photoId, popOverlay]);

  const handleSavePreset = useCallback((name: string) => {
    const es = editStateRef.current;
    const h = [...es.hsl.h];
    const s = [...es.hsl.s];
    const l = [...es.hsl.l];
    savePreset(name, {
      adjust: { ...es.adjust },
      effects: { ...es.effects },
      grain: { ...es.grain },
      hsl: { h, s, l },
      splitTone: { ...es.splitTone },
      lut: { ...es.lut },
      });
    setShowSaveModal(false);
    toast.success(`Settings saved as "${name}"`);
  }, [savePreset]);



  const updateAdjust = useCallback((patch: Partial<EditState["adjust"]>) =>
    update({ adjust: { ...editStateRef.current.adjust, ...patch } }), [update]);

  const updateGrain = useCallback((patch: Partial<EditState["grain"]>) =>
    update({ grain: { ...editStateRef.current.grain, ...patch } }), [update]);

  const updateEffects = useCallback((patch: Partial<EditState["effects"]>) =>
    update({ effects: { ...editStateRef.current.effects, ...patch } }), [update]);

  const updateLutCrop = useCallback((patch: Partial<EditState>) => update(patch), [update]);

  const updateLut = useCallback((patch: Partial<EditState["lut"]>) => {
    update({ lut: { ...editStateRef.current.lut, ...patch } });
  }, [update]);

  const updateHsl = useCallback((patch: Partial<EditState["hsl"]>) => {
    update({ hsl: { ...editStateRef.current.hsl, ...patch } });
  }, [update]);

  const updateSplitTone = useCallback((patch: Partial<EditState["splitTone"]>) => {
    update({ splitTone: { ...editStateRef.current.splitTone, ...patch } });
  }, [update]);

  // Live GPU-only updates (bypass zustand — direct WebGL render for responsive dragging)
  const rpRef = useRef<RenderParams | null>(null);
  const hslHCache = useRef(new Float32Array(8));
  const hslSCache = useRef(new Float32Array(8));
  const hslLCache = useRef(new Float32Array(8));
  const liveRender = useCallback((patch: Partial<EditState>) => {
    if (!processorRef.current) return;
    const merged = { ...editStateRef.current, ...patch };
    editStateRef.current = merged;
    const { adjust, grain, effects, hsl, splitTone, lut, crop } = merged;

    if (!rpRef.current) {
      const full = buildRenderParamsFromEditState(merged, performance.now() / 1000, getPhotoEffectSeed(photo.id));
      full.hslH = hslHCache.current;
      full.hslS = hslSCache.current;
      full.hslL = hslLCache.current;
      rpRef.current = full;
    }
    const rp = rpRef.current;
    hslHCache.current.set(hsl.h);
    hslSCache.current.set(hsl.s);
    hslLCache.current.set(hsl.l);
    rp.time = performance.now() / 1000;

    if ('adjust' in patch || 'crop' in patch || 'effects' in patch || 'grain' in patch || 'lut' in patch || 'splitTone' in patch) {
      rp.exposure = (adjust.exposure / 100) * 2;
      rp.contrast = 1 + (adjust.contrast / 100) * 0.5;
      rp.temperature = adjust.temperature / 100;
      rp.tint = adjust.tint / 100;
      rp.shadows = adjust.shadows / 100;
      rp.highlights = adjust.highlights / 100;
      rp.saturation = 1 + (adjust.saturation / 100) * 0.5;
      rp.vignette = adjust.vignette / 100;
      rp.fade = adjust.fade / 100;
      rp.grain = grain.amount / 100;
      rp.grainSize = grain.size;
      rp.grainType = grain.type === "fine" ? 0 : grain.type === "medium" ? 1 : 2;
      rp.halation = effects.halation / 100;
      rp.lightLeak = effects.lightLeak / 100;
      rp.bloom = effects.bloom / 100;
      rp.dispersion = effects.dispersion / 100;
      rp.intensity = lut.intensity / 100;
      rp.lut4DAxis = lut.axis / 100;
      rp.splitShadowsHue = splitTone.shadowsHue / 360;
      rp.splitShadowsSat = splitTone.shadowsSat / 100;
      rp.splitHighlightsHue = splitTone.highlightsHue / 360;
      rp.splitHighlightsSat = splitTone.highlightsSat / 100;
      rp.splitBalance = splitTone.balance / 100;
      rp.borderMode = crop.borderMode;
      rp.borderWidth = crop.borderWidth;
    }
    processorRef.current.render(rp);
  }, [photo.id]);
  const liveAdjust = useCallback((patch: Partial<EditState["adjust"]>) =>
    liveRender({ adjust: { ...editStateRef.current.adjust, ...patch } }), [liveRender]);
  const liveGrain = useCallback((patch: Partial<EditState["grain"]>) =>
    liveRender({ grain: { ...editStateRef.current.grain, ...patch } }), [liveRender]);
  const liveEffects = useCallback((patch: Partial<EditState["effects"]>) =>
    liveRender({ effects: { ...editStateRef.current.effects, ...patch } }), [liveRender]);
  const liveHsl = useCallback((patch: Partial<EditState["hsl"]>) =>
    liveRender({ hsl: { ...editStateRef.current.hsl, ...patch } }), [liveRender]);
  const liveSplitTone = useCallback((patch: Partial<EditState["splitTone"]>) =>
    liveRender({ splitTone: { ...editStateRef.current.splitTone, ...patch } }), [liveRender]);

  // --- Per-tab reset ---
  const resetCurrentTab = useCallback(() => {
    switch (tab) {
      case "film":
        update({
          presetId: "none", crop: { ...DEFAULT_EDIT_STATE.crop },
          adjust: { ...DEFAULT_EDIT_STATE.adjust }, grain: { ...DEFAULT_EDIT_STATE.grain },
          effects: { ...DEFAULT_EDIT_STATE.effects },
          hsl: { h: [...DEFAULT_EDIT_STATE.hsl.h], s: [...DEFAULT_EDIT_STATE.hsl.s], l: [...DEFAULT_EDIT_STATE.hsl.l] },
          splitTone: { ...DEFAULT_EDIT_STATE.splitTone }, lut: { ...DEFAULT_EDIT_STATE.lut },
        }); break;
      case "color": update({
        adjust: { ...DEFAULT_EDIT_STATE.adjust },
        hsl: { h: [...DEFAULT_EDIT_STATE.hsl.h], s: [...DEFAULT_EDIT_STATE.hsl.s], l: [...DEFAULT_EDIT_STATE.hsl.l] },
        splitTone: { ...DEFAULT_EDIT_STATE.splitTone },
      }); break;
      case "grain": update({ grain: { ...DEFAULT_EDIT_STATE.grain } }); break;
      case "effects": update({
        effects: { ...DEFAULT_EDIT_STATE.effects },
        adjust: { ...editStateRef.current.adjust, fade: 0, vignette: 0 },
        crop: { ...DEFAULT_EDIT_STATE.crop },
      }); break;
    }
  }, [tab, update]);

  const { adjust, grain, effects, hsl, splitTone, lut, crop } = editState;


  return (
    <div ref={editorRef} className="relative h-full w-full overflow-hidden bg-[#1c1c1c]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a2a2a] to-[#1c1c1c]" />
      <div className="relative h-full flex flex-col">
        <div className="shrink-0 h-[24px] flex items-center justify-center"
          onPointerDown={handleDragHandleDown}
          onPointerMove={handleDragHandleMove}
          onPointerUp={handleDragHandleUp}
          style={{ touchAction: "none" }}>
          <div className="w-[36px] h-[4px] rounded-full bg-white/30" />
        </div>
        <div className="flex items-center justify-between px-[20px] pb-[6px] shrink-0">
          <button type="button" onClick={() => setShowOriginal((v) => !v)} className="size-[32px] rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform">
            <span className="text-white text-[11px] font-['IBM_Plex_Mono'] font-medium">AB</span>
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 top-[8px]">
            <button type="button" onClick={handleSaveAndClose} className="active:scale-90 transition-transform" aria-label="Close">
              <X size={24} color="white" strokeWidth={1.5} />
            </button>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((v) => !v)} className="p-[6px] active:scale-90 transition-transform" aria-label="Menu">
              <MoreVertical size={18} color="white" strokeWidth={1.5} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-[4px] z-40 bg-[#2a2a2a] rounded-[10px] overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.5)] min-w-[160px]">
                  <button type="button" onClick={() => { setMenuOpen(false); handleExport(); }} className="w-full flex items-center gap-[8px] px-[14px] py-[10px] text-white/80 text-[12px] hover:bg-white/10 active:bg-white/15 transition-colors text-left">
                    Export Photo
                  </button>
                  <div className="h-px bg-white/10 mx-[10px]" />
                  <button type="button" onClick={() => { setMenuOpen(false); resetAll(); }} className="w-full flex items-center gap-[8px] px-[14px] py-[10px] text-white/80 text-[12px] hover:bg-white/10 active:bg-white/15 transition-colors text-left">
                    Reset All
                  </button>
                  <div className="h-px bg-white/10 mx-[10px]" />
                  <button type="button" onClick={() => { setMenuOpen(false); setShowSaveModal(true); }} className="w-full flex items-center gap-[8px] px-[14px] py-[10px] text-white/80 text-[12px] hover:bg-white/10 active:bg-white/15 transition-colors text-left">
                    Save Settings
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-center px-[16px] py-[6px] relative"
          style={{ height: "min(45vh, 380px)", touchAction: "none" }}
          onPointerDown={handleImgPointerDown}
          onPointerMove={handleImgPointerMove}
          onPointerUp={handleImgPointerUp}
          onPointerLeave={handleImgPointerLeave}>
          <div ref={innerImgRef} className="relative flex items-center justify-center w-full h-full shadow-[0px_8px_32px_rgba(0,0,0,0.55)]"
            style={{ transition: "transform 100ms ease-out" }}>
            <canvas ref={canvasRef} className={`${showOriginal ? "opacity-0 pointer-events-none" : ""}`} />

            {loading && <div className="absolute inset-0 flex items-center justify-center z-10"><div className="size-[24px] border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>}
            <img src={photo.dataUrl} alt=""
              className={`absolute inset-0 size-full object-contain ${showOriginal ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              style={{ transition: "opacity 150ms ease" }} />
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-black/40 backdrop-blur-xl flex flex-col" style={{ paddingBottom: "max(0px,env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-[3px] mx-[10px] mt-[6px]">
            <div className="flex-1 flex gap-[3px] p-[3px] rounded-full bg-white/10 min-w-max overflow-x-auto no-scrollbar">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`shrink-0 px-[8px] py-[3px] rounded-full text-[10px] font-medium transition-colors active:scale-90 ${tab === t.id ? "bg-white text-black" : "text-white/50 hover:text-white/70"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={resetCurrentTab}
              className="shrink-0 size-[28px] flex items-center justify-center rounded-full bg-white/10 active:scale-90 transition-transform"
              aria-label="Reset current tab">
              <RotateCcw size={14} color="white" strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-[14px] pt-[16px]"
            style={{ paddingBottom: "max(8px,env(safe-area-inset-bottom))" }}>
            {tab === "film" && (
              <>
                <FilmStrip colorPresets={colorPresets} bwPresets={bwPresets} activePresetId={editState.presetId} onSelect={applyPreset} photoDataUrl={thumbUrl} thumbMap={thumbMap} />
                <div className="h-px bg-white/10 my-[8px]" />
              </>
            )}
            {tab === "color" && (
              <ColorPanel
                exposure={adjust.exposure} contrast={adjust.contrast}
                saturation={adjust.saturation} temperature={adjust.temperature}
                tint={adjust.tint} shadows={adjust.shadows} highlights={adjust.highlights}
                hsl={hsl} splitTone={splitTone}
                onChange={updateAdjust} onLiveChange={liveAdjust}
                onHslChange={updateHsl} onHslLiveChange={liveHsl}
                onSplitToneChange={updateSplitTone} onSplitToneLiveChange={liveSplitTone}
              />
            )}
            {tab === "grain" && (
              <GrainPanel
                amount={grain.amount} size={grain.size} type={grain.type}
                onChange={updateGrain} onLiveChange={liveGrain}
              />
            )}
            {tab === "effects" && (
              <EffectsPanel
                halation={effects.halation} lightLeak={effects.lightLeak}
                bloom={effects.bloom} dispersion={effects.dispersion}
                fade={adjust.fade} vignette={adjust.vignette}
                borderMode={crop.borderMode} borderWidth={crop.borderWidth}
                onChange={(patch: any) => {
                  if ('borderMode' in patch || 'borderWidth' in patch) {
                    update({ crop: { ...crop, ...patch } });
                  } else if ('fade' in patch || 'vignette' in patch) {
                    update({ adjust: { ...adjust, ...patch } });
                  } else {
                    updateEffects(patch);
                  }
                }}
                onLiveChange={(patch: any) => {
                  if ('borderMode' in patch || 'borderWidth' in patch) {
                    liveRender({ crop: { ...crop, ...patch } });
                  } else if ('fade' in patch || 'vignette' in patch) {
                    liveRender({ adjust: { ...adjust, ...patch } });
                  } else {
                    liveEffects(patch);
                  }
                }}
              />
            )}

          </div>
        </div>
      </div>
      {showSaveModal && <SavePresetModal onSave={handleSavePreset} onClose={() => setShowSaveModal(false)} />}
    </div>
  );
}

