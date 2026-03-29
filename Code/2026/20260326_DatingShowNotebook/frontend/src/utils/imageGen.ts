import axios, { AxiosRequestConfig } from 'axios';

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
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // JPEG background must be solid (SVG is transparent by default)
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const jpegBase64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(jpegBase64);
    };

    img.onerror = (e) => {
      reject(e);
    };

    img.src = url;
  });
}

export async function saveEventImage(filename: string, base64: string, config?: AxiosRequestConfig) {
  await axios.post('/api/save-image', { filename, base64 }, config);
}

export async function cleanupZombieImages(activeFilenames: string[], config?: AxiosRequestConfig) {
  await axios.post('/api/cleanup-images', { activeFilenames }, config);
}
