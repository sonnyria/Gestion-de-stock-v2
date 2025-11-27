// HTML5 barcode scanning service
// Uses the `logger` service to gate debug logs behind the DEV flag
import logger from './logger';
// Uses the native BarcodeDetector when available, then falls back to a CDN-delivered ZXing browser build

export const readBarcodeFromImage = async (base64Image: string): Promise<string | null> => {
  try {
    if (!base64Image) return null;

    // Create a blob from the data URL and an ImageBitmap (modern browsers)
    let blob: Blob;
    try {
      const response = await fetch(base64Image);
      blob = await response.blob();
    } catch (e) {
      logger.error('Failed to fetch image blob from data URL', e);
      return null;
    }

    // Prefer BarcodeDetector if supported by the platform
    if ('BarcodeDetector' in window) {
      try {
        const imageBitmap = await createImageBitmap(blob);
        // If no explicit formats are provided, the implementation uses all supported formats — easier for compatibility
        const detector = new (window as any).BarcodeDetector();
        const results = await detector.detect(imageBitmap as any);
        if (results?.length) {
          logger.debug('barcodeService: BarcodeDetector found', results);
          return results[0].rawValue || null;
        }
        logger.debug('barcodeService: BarcodeDetector returned no results');
      } catch (err) {
        // Fall through to ZXing fallback; some browsers restrict BarcodeDetector
        logger.warn('barcodeService: BarcodeDetector failed or is restricted, falling back to library', err);
      }
    }

    // Fallback: dynamically import ZXing from CDN to avoid a hard dependency at build time
    try {
      const img = new Image();
      img.src = base64Image;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (err) => reject(err);
      });

      // Dynamically import ZXing via CDN. This avoids bundling it and avoids a failing npm install.
      // We intentionally use an absolute CDN URL that supports ESM; change the version if needed.
      let ZXing: any = null;
      try {
        // Try local package import first (more reliable across browsers and policies)
        try {
          ZXing = await import('@zxing/browser');
          logger.debug('barcodeService: ZXing imported from @zxing/browser local package');
        } catch (localErr) {
          logger.debug('barcodeService: local @zxing/browser import failed, trying CDN', localErr);
          // @ts-ignore - dynamic CDN import (no local typings)
          ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.18.6/dist/index.min.js');
          logger.debug('barcodeService: ZXing imported via CDN');
        }
      } catch (err) {
        logger.warn('barcodeService: ZXing import attempts failed', err);
      }
      const BrowserMultiFormatReader = ZXing?.BrowserMultiFormatReader || ZXing?.default?.BrowserMultiFormatReader;
      if (!BrowserMultiFormatReader) {
        logger.warn('ZXing BrowserMultiFormatReader not available via CDN fallback');
      }
      const reader = BrowserMultiFormatReader ? new BrowserMultiFormatReader() : null;
      try {
        // Try decode directly from the element first (convenient if supported internally)
        if (reader) {
          const result = await reader.decodeFromImageElement(img);
          if (result?.getText) return result.getText();
          if ((result as any)?.text) return (result as any).text;
        }
      } catch (e) {
        // Try drawing to a canvas as a further fallback (works if the reader needs canvas)
          try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 640;
          canvas.height = img.naturalHeight || img.height || 480;
          const ctx = canvas.getContext('2d');
            if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            if (reader) {
              const canvasResult = await reader.decodeFromCanvas(canvas);
              if (canvasResult?.getText) return canvasResult.getText();
              if ((canvasResult as any)?.text) return (canvasResult as any).text;
            }
          }
        } catch (e2) {
          // Still failed, will return null below
          logger.warn('barcodeService: ZXing canvas decode failed', e2);
        }
      } finally {
        if (reader?.reset) reader.reset();
      }
    } catch (err) {
      logger.error('barcodeService: ZXing fallback failed', err);
    }

    return null;
  } catch (error) {
    logger.error('readBarcodeFromImage error', error);
    return null;
  }
};

export default {
  readBarcodeFromImage
};

// Read barcode directly from an HTML element (video or image) — useful when frame is available
export const readBarcodeFromMediaElement = async (el: HTMLVideoElement | HTMLImageElement): Promise<string | null> => {
  try {
    if (!el) return null;

    // If BarcodeDetector is supported, prefer it – try with an ImageBitmap first (more reliable)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector();
        let imageBitmap: ImageBitmap | null = null;
        try {
          // createImageBitmap accepts HTMLVideoElement or HTMLImageElement
          imageBitmap = await createImageBitmap(el as any);
        } catch (bitmapErr) {
          logger.debug('barcodeService: createImageBitmap failed for element; falling back to direct detect', bitmapErr);
        }
        const results = imageBitmap ? await detector.detect(imageBitmap as any) : await detector.detect(el as any);
        if (results?.length) {
          logger.debug('barcodeService: BarcodeDetector (element) found', results);
          return results[0].rawValue || null;
        }
      } catch (err) {
        logger.warn('barcodeService: BarcodeDetector (element) failed', err);
      }
    }

    // Fallback to ZXing reading from element
    try {
      let ZXing: any = null;
      try {
        ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.18.6/dist/index.min.js');
      } catch (err) {
        logger.warn('barcodeService: CDN ZXing import failed (element)', err);
      }
      const BrowserMultiFormatReader = ZXing?.BrowserMultiFormatReader || ZXing?.default?.BrowserMultiFormatReader;
      const reader = BrowserMultiFormatReader ? new BrowserMultiFormatReader() : null;
      if (reader) {
        try {
          // If it's a video element, draw a single frame to a canvas and decode from canvas
          if ((el as HTMLVideoElement).tagName && (el as HTMLVideoElement).tagName.toLowerCase() === 'video') {
            const video = el as HTMLVideoElement;
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || video.clientWidth || 640;
            canvas.height = video.videoHeight || video.clientHeight || 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const canvasResult = await reader.decodeFromCanvas(canvas);
                if (canvasResult?.getText) return canvasResult.getText();
                if ((canvasResult as any)?.text) return (canvasResult as any).text;
                } catch (e) {
                logger.warn('barcodeService: ZXing decode from video canvas failed', e);
              }
            }
          } else {
            // If it's an <img>, try decodeFromImageElement first, then canvas fallback
            try {
              const result = await reader.decodeFromImageElement(el as any);
              if (result?.getText) return result.getText();
              if ((result as any)?.text) return (result as any).text;
            } catch (e) {
              try {
                const img = el as HTMLImageElement;
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width || 640;
                canvas.height = img.naturalHeight || img.height || 480;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const canvasResult = await reader.decodeFromCanvas(canvas);
                  if (canvasResult?.getText) return canvasResult.getText();
                  if ((canvasResult as any)?.text) return (canvasResult as any).text;
                }
                } catch (e2) {
                logger.warn('barcodeService: ZXing decode fallback for image failed', e2);
              }
            }
          }
          } catch (e) {
          logger.warn('barcodeService: ZXing element decode failed', e);
        } finally {
          if (reader?.reset) reader.reset();
        }
      }
    } catch (err) {
      logger.error('barcodeService: ZXing element fallback failed', err);
    }
    return null;
  } catch (error) {
    logger.error('readBarcodeFromMediaElement error', error);
    return null;
  }
};
