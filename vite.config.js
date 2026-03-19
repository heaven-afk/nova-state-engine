import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'esnext',   // enables top-level await support
    rollupOptions: {
      input: {
        main:         resolve(__dirname, 'index.html'),
        login:        resolve(__dirname, 'login.html'),
        weeks:        resolve(__dirname, 'weeks.html'),
        weekView:     resolve(__dirname, 'week-view.html'),
        dayView:      resolve(__dirname, 'day-view.html'),
        ocrReview:    resolve(__dirname, 'ocr-review.html'),
        leaderboards: resolve(__dirname, 'leaderboards.html'),
        exports:      resolve(__dirname, 'exports.html'),
        settings:     resolve(__dirname, 'settings.html'),
        users:        resolve(__dirname, 'users.html')
      }
    }
  }
});
