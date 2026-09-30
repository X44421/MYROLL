import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrainAtlas, GRAIN_ENCODING_SCALE, GRAIN_ZERO } from '../src/lib/filmGrain';

const atlas = createGrainAtlas();
const decode = (value: number) => (value - GRAIN_ZERO) / GRAIN_ENCODING_SCALE;

test('correlated fields are reproducible, centered, and have equal RMS', () => {
  assert.strictEqual(createGrainAtlas(), atlas);
  const { size, data } = atlas[0];
  for (let channel = 0; channel < 3; channel++) {
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0; i < size * size; i++) {
      const value = decode(data[i * 4 + channel]);
      sum += value;
      sumSquares += value * value;
    }
    assert.ok(Math.abs(sum / (size * size)) < 0.001);
    assert.ok(Math.abs(sumSquares / (size * size) - 1) < 0.01);
  }
});

test('adjacent grain samples are correlated in both axes, including the wrap seam', () => {
  const { size, data } = atlas[0];
  for (let channel = 0; channel < 3; channel++) {
    let horizontal = 0;
    let vertical = 0;
    let distant = 0;
    let seam = 0;
    let seamVariance = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const value = decode(data[(y * size + x) * 4 + channel]);
        horizontal += value * decode(data[(y * size + (x + 1) % size) * 4 + channel]);
        vertical += value * decode(data[(((y + 1) % size) * size + x) * 4 + channel]);
        distant += value * decode(data[(y * size + (x + 12) % size) * 4 + channel]);
      }
      const left = decode(data[(y * size) * 4 + channel]);
      const right = decode(data[(y * size + size - 1) * 4 + channel]);
      seam += left * right;
      seamVariance += (left * left + right * right) * 0.5;
    }
    horizontal /= size * size;
    vertical /= size * size;
    assert.ok(horizontal > 0.55 && horizontal < 0.75);
    assert.ok(Math.abs(horizontal - vertical) < 0.035);
    assert.ok(Math.abs(distant / (size * size)) < 0.04);
    assert.ok(seam / seamVariance > 0.45);
  }
});

test('color fields are independent rather than three copies of one pattern', () => {
  const { size, data } = atlas[0];
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) {
    let covariance = 0;
    for (let i = 0; i < size * size; i++) covariance += decode(data[i * 4 + a]) * decode(data[i * 4 + b]);
    assert.ok(Math.abs(covariance / (size * size)) < 0.04);
  }
});

test('area mips reduce fine-grain variance and converge to exact neutral', () => {
  assert.deepEqual(atlas.map(level => level.size), [256, 128, 64, 32, 16, 8, 4, 2, 1]);
  let previous = Infinity;
  for (const { size, data } of atlas) {
    let energy = 0;
    let sum = 0;
    for (let i = 0; i < size * size; i++) {
      for (let channel = 0; channel < 3; channel++) {
        const value = decode(data[i * 4 + channel]);
        sum += value;
        energy += value * value;
      }
    }
    energy /= size * size * 3;
    assert.ok(energy <= previous + 0.001);
    assert.ok(Math.abs(sum / (size * size * 3)) < 0.005);
    previous = energy;
  }
  assert.deepEqual([...atlas.at(-1)!.data], [128, 128, 128, 255]);
});
