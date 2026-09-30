// @ts-ignore
import RawWorker from './raw.worker.ts?worker';

export async function loadImageFromFile(file: File): Promise<string> {
  const isRaw = file.name.match(/\.(cr2|cr3|nef|arw|dng|raw|orf|rw2|tif|tiff)$/i);
  const isHeic = file.name.match(/\.(heic|heif)$/i);

  if (isHeic) {
    // Safari can decode HEIC itself; avoid loading the large converter there.
    const nativeUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Native HEIC decoding unavailable'));
        image.src = nativeUrl;
      });
      return nativeUrl;
    } catch {
      URL.revokeObjectURL(nativeUrl);
    }
    try {
      const { default: heic2any } = await import('heic2any');
      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.8
      });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn("Failed to convert HEIC:", e);
    }
  }
  
  if (isRaw) {
    try {
      const buffer = await file.arrayBuffer();
      const workerResult = await new Promise<{ type: string; data?: Uint8Array; rgba?: Uint8Array; width?: number; height?: number }>((resolve, reject) => {
        const worker = new RawWorker();
        worker.onmessage = (e) => {
          worker.terminate();
          if (e.data.type === 'ERROR') {
            reject(new Error(e.data.error));
          } else {
            resolve(e.data);
          }
        };
        worker.onerror = (e) => {
          worker.terminate();
          reject(e);
        };
        worker.postMessage({ type: 'EXTRACT', buffer }, [buffer]);
      });

      if (workerResult.type === 'RESULT' && workerResult.data) {
        const blob = new Blob([workerResult.data], { type: 'image/jpeg' });
        return URL.createObjectURL(blob);
      } else if (workerResult.type === 'UTIF_RESULT' && workerResult.rgba) {
        const canvas = document.createElement('canvas');
        canvas.width = workerResult.width || 0;
        canvas.height = workerResult.height || 0;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = new ImageData(new Uint8ClampedArray(workerResult.rgba), canvas.width, canvas.height);
          ctx.putImageData(imageData, 0, 0);
          return new Promise<string>((resolve) => {
             canvas.toBlob((blob) => {
               if (blob) resolve(URL.createObjectURL(blob));
               else resolve(URL.createObjectURL(file)); 
             }, 'image/jpeg', 0.9);
          });
        }
      }
    } catch (e: any) {
      console.warn("Worker extraction failed:", e);
    }

    try {
      // Fallback: Try exifr as a last resort
      const { default: exifr } = await import('exifr');
      const thumbData = await exifr.thumbnail(file);
      if (thumbData) {
        const blob = new Blob([thumbData], { type: 'image/jpeg' });
        return URL.createObjectURL(blob);
      }
    } catch (e: any) {
      console.warn("exifr failed to parse RAW preview:", e);
    }
  }
  
  // Standard load fallback
  return URL.createObjectURL(file);
}

export function resizeImageToMax(img: HTMLImageElement, maxDimension: number = 4096): Promise<HTMLImageElement> {
  if (img.width <= maxDimension && img.height <= maxDimension) {
    return Promise.resolve(img);
  }

  // Calculate new dimensions keeping aspect ratio
  let newWidth = img.width;
  let newHeight = img.height;
  if (newWidth > newHeight) {
    if (newWidth > maxDimension) {
      newHeight = Math.round((newHeight * maxDimension) / newWidth);
      newWidth = maxDimension;
    }
  } else {
    if (newHeight > maxDimension) {
      newWidth = Math.round((newWidth * maxDimension) / newHeight);
      newHeight = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.resolve(img);
  }

  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  return new Promise<HTMLImageElement>((resolve) => {
    const resizedImg = new Image();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
      resizedImg.crossOrigin = 'anonymous';
    }
    resizedImg.onload = () => resolve(resizedImg);
    resizedImg.onerror = () => resolve(img); // fallback to original on error
    resizedImg.src = dataUrl;
  });
}

export function loadImageToElement(src: string, originalFile?: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = async () => {
      try {
        const resized = await resizeImageToMax(img, 4096);
        resolve(resized);
      } catch (e) {
        console.warn("Resize failed, using original:", e);
        resolve(img);
      }
    };
    img.onerror = () => {
      let ext = originalFile?.name && originalFile.name.includes('.') ? originalFile.name.split('.').pop()?.toUpperCase() || '' : '';
      if (!ext || ext.length > 5 || /^\d+$/.test(ext)) {
        ext = 'Unknown format / No extension';
      }
      reject(new Error(`Browser could not decode the image (${ext}). If this is a RAW file, it may lack an embedded JPEG preview. Alternatively, please convert it to JPEG/PNG first.`));
    };
    img.src = src;
  });
}
