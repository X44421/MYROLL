import type { Preset, EditState } from "./filmTypes";

export function buildCSSFromAdjust(adjust: EditState["adjust"]): string {
  const parts: string[] = [];
  const { exposure, contrast, saturation, temperature, fade } = adjust;

  if (saturation !== 0) parts.push(`saturate(${(1 + saturation / 120).toFixed(4)})`);

  if (temperature > 0) {
    parts.push(`sepia(${(temperature / 250).toFixed(4)})`);
  } else if (temperature < 0) {
    parts.push(`hue-rotate(${(temperature / 6).toFixed(1)}deg)`);
  }

  let effectiveBrightness = 1;
  if (exposure !== 0) effectiveBrightness *= 1 + exposure / 200;
  if (fade > 0) effectiveBrightness *= 1 + fade / 400;
  if (effectiveBrightness !== 1) parts.push(`brightness(${effectiveBrightness.toFixed(4)})`);

  let effectiveContrast = 1;
  if (contrast !== 0) effectiveContrast *= 1 + contrast / 150;
  if (fade > 0) effectiveContrast *= 1 - fade / 300;
  if (effectiveContrast !== 1) parts.push(`contrast(${effectiveContrast.toFixed(4)})`);

  return parts.length ? parts.join(" ") : "none";
}

export function buildLiveFilter(preset: Preset | undefined, adjust: EditState["adjust"]): string {
  const parts: string[] = [];

  if (preset && preset.filterCSS && preset.filterCSS !== "none") {
    parts.push(preset.filterCSS);
  }

  const base = buildCSSFromAdjust(adjust);
  if (base !== "none") parts.push(base);

  return parts.length ? parts.join(" ") : "none";
}

export function combinedFilter(
  preset: Preset | undefined,
  editState: EditState
): string {
  const base = buildLiveFilter(preset, editState.adjust);
  return base !== "none" ? base : "none";
}
