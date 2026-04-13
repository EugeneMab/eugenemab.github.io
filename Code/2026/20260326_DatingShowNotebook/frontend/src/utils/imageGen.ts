import netClient from './NetClient';
import { toSafeBase64 } from '../store/useStore';

const JPEG_QUALITY = 0.8;

/**
 * Builds a URL with folder and client-id parameters.
 */
function buildUrl(baseUrl: string, folderPath: string | null, clientId: string): string {
  if (!folderPath) {
    return baseUrl;
  }
  const url = new URL(baseUrl, window.location.origin);
  url.searchParams.set('folder', toSafeBase64(folderPath));
  url.searchParams.set('client-id', clientId);
  return url.pathname + url.search;
}

export async function svgToJpeg(svgString: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Using base64 data URI for SVG is often safer for canvas export than Blob URL
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const url = `data:image/svg+xml;base64,${svgBase64}`;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Failed to get canvas context'));
      }

      // JPEG background must be solid (SVG is transparent by default)
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const jpegBase64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      return resolve(jpegBase64);
    };

    img.onerror = (e) => {
      return reject(e);
    };

    img.src = url;
  });
}

export async function saveEventImage(
  filename: string,
  base64: string,
  folderPath: string | null,
  clientId: string
) {
  const url = buildUrl('/api/save-image', folderPath, clientId);
  await netClient.post(url, {
    filename,
    base64,
  });
}

export async function cleanupZombieImages(
  activeFilenames: string[],
  folderPath: string | null,
  clientId: string
) {
  const url = buildUrl('/api/cleanup-images', folderPath, clientId);
  await netClient.post(url, {
    activeFilenames,
  });
}
