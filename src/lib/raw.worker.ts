export {};

import UTIF from 'utif';

function extractLargestJpeg(buffer: ArrayBuffer): Uint8Array | null {
  const view = new Uint8Array(buffer);
  let bestStart = -1;
  let bestEnd = -1;
  let maxLen = 0;
  
  const lenLimit = view.length;
  let i = 0;
  while (i < lenLimit - 3) {
    // SOI marker: FF D8. The next marker starts with FF.
    if (view[i] === 0xFF && view[i + 1] === 0xD8 && view[i + 2] === 0xFF) {
      // Find the next EOI marker: FF D9
      let foundEnd = -1;
      for (let j = i + 2; j < lenLimit - 1; j++) {
        if (view[j] === 0xFF && view[j + 1] === 0xD9) {
          foundEnd = j + 2;
          break;
        }
      }
      if (foundEnd !== -1) {
        const len = foundEnd - i;
        if (len > maxLen) {
          maxLen = len;
          bestStart = i;
          bestEnd = foundEnd;
        }
        // Jump past the current JPEG block to keep search extremely fast
        i = foundEnd;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  
  if (bestStart !== -1 && maxLen > 5120) { // Keep if greater than 5KB
    return view.slice(bestStart, bestEnd);
  }
  return null;
}

self.onmessage = (e) => {
  const { type, buffer } = e.data;
  if (type === 'EXTRACT') {
    try {
      const result = extractLargestJpeg(buffer);
      if (result) {
        (self as any).postMessage({ type: 'RESULT', data: result }, [result.buffer]);
        return;
      }
      
      // Fallback: UTIF.js
      const ifds = UTIF.decode(buffer);
      let largestIfd = null;
      let maxArea = 0;
      
      for (const ifd of ifds) {
        if (ifd.t256 && ifd.t257) { 
          const width = ifd.t256[0];
          const height = ifd.t257[0];
          const area = width * height;
          if (area > maxArea) {
            maxArea = area;
            largestIfd = ifd;
          }
        }
      }

      if (largestIfd) {
        UTIF.decodeImage(buffer, largestIfd);
        const rgba = UTIF.toRGBA8(largestIfd);
        const w = largestIfd.t256?.[0] || largestIfd.width || 0;
        const h = largestIfd.t257?.[0] || largestIfd.height || 0;
        (self as any).postMessage({ 
          type: 'UTIF_RESULT', 
          width: w, 
          height: h, 
          rgba: rgba 
        }, [rgba.buffer]);
      } else {
        (self as any).postMessage({ type: 'RESULT', data: null });
      }
    } catch (err: any) {
      (self as any).postMessage({ type: 'ERROR', error: err.message });
    }
  }
};
