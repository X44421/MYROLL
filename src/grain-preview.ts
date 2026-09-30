import { LUTProcessor } from './lib/webgl';
import type { RenderParams } from './lib/processor';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('preview');
const status = element<HTMLDivElement>('status');
const params: RenderParams = {
  exposure: 0, contrast: 1, temperature: 0, tint: 0, shadows: 0, highlights: 0,
  saturation: 1, intensity: 0, vignette: 0, grain: 0.6, grainSize: 1, grainType: 1,
  halation: 0, lightLeak: 0, bloom: 0, dispersion: 0,
  hslH: new Float32Array(8), hslS: new Float32Array(8), hslL: new Float32Array(8),
  splitShadowsHue: 0, splitShadowsSat: 0, splitHighlightsHue: 0,
  splitHighlightsSat: 0, splitBalance: 0, fade: 0, borderMode: 0,
  borderWidth: 0, lut4DAxis: 0.5, time: 0, grainSeed: 1.337,
};

async function init() {
  const processor = new LUTProcessor(canvas);
  processor.setRenderScale(2048);
  let source: HTMLImageElement;
  let showingOriginal = false;
  let sourceName = 'Gray chart';

  const render = () => {
    if (!source) return;
    processor.render(showingOriginal ? { ...params, grain: 0 } : params);
    const zoom = element<HTMLSelectElement>('zoom').value;
    const container = canvas.parentElement!;
    const style = getComputedStyle(container);
    const width = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = zoom === 'fit' ? Math.min(1, width / canvas.width, height / canvas.height) : Number(zoom);
    canvas.style.width = `${canvas.width * scale}px`;
    status.textContent = `${sourceName} · ${source.naturalWidth} × ${source.naturalHeight} · ${showingOriginal ? 'Original' : 'Production grain renderer'}`;
  };

  const load = async (url: string, name: string) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    source = image;
    sourceName = name;
    processor.setImage(image, image.naturalWidth, image.naturalHeight);
    render();
  };

  const chart = async () => {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 660;
    const ctx = c.getContext('2d')!;
    const values = [0, 12, 31, 56, 89, 128, 166, 204, 235, 255];
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(i * 120, 0, 120, 340);
      ctx.fillStyle = value < 128 ? '#eee' : '#111';
      ctx.font = '14px monospace';
      ctx.fillText(`${Math.round(value / 255 * 100)}%`, i * 120 + 16, 30);
    }
    const gradient = ctx.createLinearGradient(0, 0, 1200, 0);
    gradient.addColorStop(0, '#000'); gradient.addColorStop(1, '#fff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 340, 1200, 200);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = ['#5a6c51', '#b89b80', '#889ba9', '#a16548', '#ddd9c8', '#252f3e'][i];
      ctx.fillRect(i * 200, 540, 200, 120);
    }
    await load(c.toDataURL(), 'Gray chart');
  };

  for (const [id, parameter] of [['amount', 'grain'], ['size', 'grainSize']] as const) {
    element<HTMLInputElement>(id).addEventListener('input', event => {
      const value = Number((event.target as HTMLInputElement).value);
      params[parameter] = id === 'amount' ? value / 100 : value;
      element<HTMLOutputElement>(`${id}-value`).value = id === 'amount' ? String(value) : value.toFixed(2);
      render();
    });
  }
  element<HTMLSelectElement>('type').addEventListener('change', event => {
    params.grainType = Number((event.target as HTMLSelectElement).value);
    render();
  });
  element<HTMLSelectElement>('zoom').addEventListener('change', render);
  element<HTMLButtonElement>('original').addEventListener('click', event => {
    showingOriginal = !showingOriginal;
    (event.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(showingOriginal));
    render();
  });
  element<HTMLButtonElement>('seed').addEventListener('click', () => {
    params.grainSeed! += 1;
    render();
  });
  element<HTMLButtonElement>('chart').addEventListener('click', () => { void chart().catch(showError); });
  element<HTMLInputElement>('photo').addEventListener('change', async event => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try { await load(url, file.name); } catch (error) { showError(error); }
    finally { URL.revokeObjectURL(url); }
  });
  window.addEventListener('pagehide', () => processor.dispose(), { once: true });
  window.addEventListener('resize', render);
  await chart();
}

function showError(error: unknown) {
  status.textContent = error instanceof Error ? error.message : 'Could not render preview';
}
void init().catch(showError);
