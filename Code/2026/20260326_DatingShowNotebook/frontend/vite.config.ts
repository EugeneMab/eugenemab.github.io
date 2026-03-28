import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/favicon.ico') {
            res.writeHead(200, { 'Content-Type': 'image/png' });
            // 1x1 Magenta PNG: iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==
            const magentaPng = Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
              'base64'
            );
            res.end(magentaPng);
            return;
          }
          if (req.url === '/quit') {
            res.end('Quitting...');
            setTimeout(() => {
              server.close();
              process.exit(0);
            }, 100);
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 3762,
    proxy: {
      '/api': 'http://localhost:13762',
    },
  },
});
