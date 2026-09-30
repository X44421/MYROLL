import { memo, useMemo, useCallback, useState, useEffect } from "react";
import * as RadixSlider from "@radix-ui/react-slider";

export const EditorSlider = memo(function EditorSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onLiveChange,
  unit = "",
  collapsible = true,
  defaultValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onLiveChange?: (v: number) => void;
  unit?: string;
  collapsible?: boolean;
  defaultValue?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [liveValue, setLiveValue] = useState(value);

  useEffect(() => setLiveValue(value), [value]);

  const rangeStyle = useMemo(() =>
    min < 0
      ? liveValue > 0
        ? { background: "linear-gradient(90deg, rgba(255,255,255,0.7) 0%, rgba(255,200,100,0.9) 100%)" }
        : liveValue < 0
          ? { background: "linear-gradient(90deg, rgba(100,180,255,0.9) 0%, rgba(255,255,255,0.7) 100%)" }
          : { background: "rgba(255,255,255,0.7)" }
      : { background: "rgba(255,255,255,0.7)" },
  [liveValue, min]);

  const handleChange = useCallback(([v]: number[]) => {
    setLiveValue(v);
    onLiveChange?.(v);
  }, [onLiveChange]);
  const handleCommit = useCallback(([v]: number[]) => onChange(v), [onChange]);
  const handleDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) { setLiveValue(defaultValue); onChange(defaultValue); }
  }, [onChange, defaultValue]);

  const displayValue = `${liveValue > 0 && min < 0 ? `+${liveValue}` : liveValue}${unit}`;

  const labelRow = (
    <div className="flex items-baseline justify-between">
      <span className="font-['IBM_Plex_Mono'] text-[10px] text-white/70">{label}</span>
      <span className="font-['IBM_Plex_Mono'] text-[10px] text-white/45 tabular-nums">
        {displayValue}
      </span>
    </div>
  );

  if (collapsible && !expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)}
        className="w-full flex flex-col gap-[4px] py-[6px] active:scale-[0.99] transition-transform">
        {labelRow}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-[4px]">
      {collapsible ? (
        <button type="button" onClick={() => setExpanded(false)}
          className="w-full flex items-baseline justify-between active:scale-[0.99] transition-transform">
          <span className="font-['IBM_Plex_Mono'] text-[10px] text-white/70">{label}</span>
          <span className="font-['IBM_Plex_Mono'] text-[10px] text-white/45 tabular-nums">
            {displayValue}
          </span>
        </button>
      ) : labelRow}
      <RadixSlider.Root
        className="relative flex items-center w-full h-[24px] touch-none select-none"
        value={[liveValue]}
        min={min}
        max={max}
        step={step}
        onValueChange={handleChange}
        onValueCommit={handleCommit}
      >
        <RadixSlider.Track className="relative h-[2px] flex-1 rounded-full bg-white/20">
          <RadixSlider.Range className="absolute h-full rounded-full" style={rangeStyle} />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          className="block size-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] focus:outline-none focus:shadow-[0_0_0_2px rgba(255,255,255,0.5)] active:scale-105 transition-transform"
          aria-label={label}
          onDoubleClick={handleDoubleClick}
        />
      </RadixSlider.Root>
    </div>
  );
});
