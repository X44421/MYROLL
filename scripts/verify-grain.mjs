// Exercise the production renderer, not a JavaScript copy of its noise model.
// Install a test browser once with: npx playwright install chromium
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const output = resolve(process.env.GRAIN_OUTPUT_DIR || 'grain-validation');
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || undefined,
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${server.resolvedUrls.local[0]}grain-preview.html`);
  await page.waitForFunction(() => !document.getElementById('status')?.textContent.includes('Loading renderer'));
  assert.match(await page.locator('#status').textContent(), /Production grain renderer/);
  await page.screenshot({ path: resolve(output, 'grain-preview.png') });
  await page.evaluate(async () => {
    const { LUTProcessor } = await import('/src/lib/webgl.ts');
    window.grainTest = async (options = {}) => {
      const size = options.imageSize || 512;
      const source = document.createElement('canvas');
      source.width = size; source.height = size;
      const ctx = source.getContext('2d');
      const value = options.tone ?? 128;
      ctx.fillStyle = options.color || `rgb(${value},${value},${value})`;
      ctx.fillRect(0, 0, size, size);
      const image = new Image();
      image.src = source.toDataURL();
      await image.decode();
      const canvas = document.createElement('canvas');
      const processor = new LUTProcessor(canvas);
      processor.setRenderScale(options.renderSize || size);
      processor.setImage(image, size, size);
      const params = {
        exposure: 0, contrast: 1, temperature: 0, tint: 0, shadows: 0, highlights: 0,
        saturation: 1, intensity: 0, vignette: 0, grain: options.amount ?? 0.8,
        grainSize: options.size ?? 1, grainType: options.type ?? 1,
        halation: 0, lightLeak: 0, bloom: 0, dispersion: 0,
        hslH: new Float32Array(8), hslS: new Float32Array(8), hslL: new Float32Array(8),
        splitShadowsHue: 0, splitShadowsSat: 0, splitHighlightsHue: 0,
        splitHighlightsSat: 0, splitBalance: 0, fade: 0, borderMode: 0,
        borderWidth: 0, lut4DAxis: 0.5, time: options.time ?? 0, grainSeed: options.seed ?? 1.337,
      };
      const gl = canvas.getContext('webgl2');
      const read = () => {
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const red = new Array(canvas.width * canvas.height);
        let chromaMax = 0;
        for (let i = 0; i < red.length; i++) {
          red[i] = pixels[i * 4];
          chromaMax = Math.max(chromaMax, Math.abs(pixels[i*4]-pixels[i*4+1]), Math.abs(pixels[i*4]-pixels[i*4+2]));
        }
        return { red, chromaMax };
      };
      processor.render({ ...params, grain: 0 });
      const original = read().red;
      processor.render(params);
      const result = read();
      if (options.png) result.png = canvas.toDataURL('image/png');
      result.width = canvas.width;
      result.noise = result.red.map((v, i) => v - original[i]);
      result.glError = gl.getError();
      processor.dispose();
      return result;
    };
  });

  const render = options => page.evaluate(options => window.grainTest(options), options);
  const metrics = result => {
    const a = result.noise;
    const mean = a.reduce((sum, value) => sum + value, 0) / a.length;
    const variance = a.reduce((sum, value) => sum + (value-mean)**2, 0) / a.length;
    const correlation = lag => {
      let cross = 0; let left = 0; let right = 0;
      for (let y = 0; y < result.width; y++) {
        for (let x = 0; x < result.width-lag; x++) {
          const i = y*result.width+x;
          const v = a[i]-mean; const w = a[i+lag]-mean;
          cross += v*w; left += v*v; right += w*w;
        }
      }
      return cross / Math.max(Math.sqrt(left*right), 1e-12);
    };
    // Energy surviving an 8x8 area average measures the coarse end of the spectrum.
    const blocks = [];
    for (let y = 0; y < result.width; y += 8) {
      for (let x = 0; x < result.width; x += 8) {
        let sum = 0;
        for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) sum += a[(y+j)*result.width+x+i]-mean;
        blocks.push(sum/64);
      }
    }
    return { mean, rms: Math.sqrt(variance), lag1: correlation(1), lag4: correlation(4),
      coarseEnergy: blocks.reduce((sum,v) => sum+v*v,0)/blocks.length/Math.max(variance,1e-12) };
  };
  const summary = { density: [], types: [], sizes: [], preview: {} };
  for (const tone of [0, 20, 60, 128, 210, 245, 255]) {
    const result = await render({ tone });
    const stats = metrics(result);
    assert.equal(result.glError, 0, 'WebGL must compile, link, and render without errors');
    assert.equal(result.chromaMax, 0, 'neutral images must retain monochrome grain');
    assert.ok(Math.abs(stats.mean) < 0.6, `grain changed gray ${tone} by ${stats.mean} code values`);
    if (tone === 0 || tone === 255) assert.equal(stats.rms, 0, 'black/white endpoints must stay clean');
    summary.density.push({ tone, ...stats });
  }
  assert.ok(summary.density[3].rms > summary.density[1].rms * 1.5, 'midtones need more grain than deep shadows');
  assert.ok(summary.density[3].rms > summary.density[5].rms * 1.8, 'highlight grain needs a smooth roll-off');

  for (const type of [0, 1, 2]) {
    const result = await render({ type, png: true });
    summary.types.push({ type, ...metrics(result) });
    await writeFile(resolve(output, `grain-${['fine','medium','coarse'][type]}.png`), Buffer.from(result.png.split(',')[1], 'base64'));
  }
  assert.ok(summary.types[0].lag1 < summary.types[1].lag1 && summary.types[1].lag1 < summary.types[2].lag1,
    'Fine/Medium/Coarse must progressively shift the spectrum toward correlated clumps');
  assert.ok(summary.types[2].coarseEnergy > summary.types[0].coarseEnergy * 1.5,
    'coarse grain needs appreciably more low-frequency energy');
  assert.ok(summary.types[2].lag1 < 0.97, 'coarse grain must retain a fine-particle component');
  for (const size of [0.5, 1, 2.5]) summary.sizes.push({ size, ...metrics(await render({ size })) });
  assert.ok(summary.sizes[0].lag1 < summary.sizes[1].lag1 && summary.sizes[1].lag1 < summary.sizes[2].lag1,
    'increasing Size must increase physical particle size');

  const still = await render({ time: 0 });
  const later = await render({ time: 120 });
  assert.deepEqual(still.red, later.red, 'time and new processor instances must not reroll still grain');
  const newSeed = await render({ seed: 2.337 });
  assert.notDeepEqual(still.red, newSeed.red, 'changing the seed must change the pattern');
  const half = metrics(await render({ amount: 0.4 }));
  const full = metrics(still);
  assert.ok(full.rms / half.rms > 1.8 && full.rms / half.rms < 2.1, 'Amount must control variance smoothly');

  const preview = await render({ renderSize: 128 });
  const previewStats = metrics(preview);
  assert.ok(previewStats.rms < full.rms * 0.7, 'subpixel grain must be integrated when preview shrinks');
  const reduced = [];
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) sum += still.noise[(y*4+j)*512+x*4+i];
    reduced.push(sum/16);
  }
  const meanA = reduced.reduce((a,b) => a+b,0)/reduced.length;
  const meanB = preview.noise.reduce((a,b) => a+b,0)/reduced.length;
  let cross = 0; let squareA = 0; let squareB = 0;
  for (let i = 0; i < reduced.length; i++) {
    const a = reduced[i]-meanA; const b = preview.noise[i]-meanB;
    cross += a*b; squareA += a*a; squareB += b*b;
  }
  const correlation = cross/Math.sqrt(squareA*squareB);
  assert.ok(correlation > 0.7, `preview/export grain should stay registered: correlation=${correlation}`);
  summary.preview = { ...previewStats, exportAreaAverageCorrelation: correlation };
  await writeFile(resolve(output, 'metrics.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));

  // Check the actual controls, including original comparison and a new pattern.
  await page.locator('#type').selectOption('2');
  await page.locator('#size').fill('2');
  await page.locator('#size').dispatchEvent('input');
  await page.screenshot({ path: resolve(output, 'grain-preview-coarse.png') });
  await page.locator('#original').click();
  assert.equal(await page.locator('#original').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: resolve(output, 'grain-preview-original.png') });
  await page.locator('#original').click();
  await page.locator('#seed').click();
  await page.locator('#photo').setInputFiles(resolve(output, 'grain-medium.png'));
  await page.waitForFunction(() => document.getElementById('status')?.textContent.includes('grain-medium.png'));
  await page.setViewportSize({ width: 900, height: 900 });
  await page.locator('#zoom').selectOption('2');
  assert.ok(await page.locator('main').evaluate(el => el.scrollWidth > el.clientWidth), '200% view must support scrolling');
  assert.ok(await page.locator('#preview').evaluate(el => el.getBoundingClientRect().left >= el.parentElement.getBoundingClientRect().left),
    'the leading edge must remain reachable when zooming');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#zoom').selectOption('fit');
  assert.ok(await page.locator('#preview').evaluate(el => el.getBoundingClientRect().width < 390), 'Fit must adapt to a narrow viewport');
  await page.screenshot({ path: resolve(output, 'grain-preview-mobile.png'), fullPage: true });
  await page.locator('#chart').click();
  assert.deepEqual(errors, [], 'the visual preview must not report runtime/shader errors');
  console.log('Production WebGL grain checks passed.');
} finally {
  await browser?.close();
  await server.close();
}
