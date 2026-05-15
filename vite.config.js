import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        index:        resolve(__dirname, 'index.html'),
        login:        resolve(__dirname, 'login.html'),
        dashboard:    resolve(__dirname, 'dashboard.html'),
        stats:        resolve(__dirname, 'stats.html'),
        matches:      resolve(__dirname, 'matches.html'),
        weekly:       resolve(__dirname, 'weekly.html'),
        upload:       resolve(__dirname, 'upload.html'),
        gfx:          resolve(__dirname, 'gfx.html'),
        users:        resolve(__dirname, 'users.html'),
        settings:     resolve(__dirname, 'settings.html')
      }
    }
  }
});
