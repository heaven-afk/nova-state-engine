import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        index:        resolve(__dirname, 'index.html'),
        login:        resolve(__dirname, 'login.html'),
        '404':        resolve(__dirname, '404.html'),
        dashboard:    resolve(__dirname, 'dashboard.html'),
        stats:        resolve(__dirname, 'stats.html'),
        matches:      resolve(__dirname, 'matches.html'),
        weekly:       resolve(__dirname, 'weekly.html'),
        upload:       resolve(__dirname, 'upload.html'),
        gfx:          resolve(__dirname, 'gfx.html'),
        users:        resolve(__dirname, 'users.html'),
        settings:     resolve(__dirname, 'settings.html'),
        profile:      resolve(__dirname, 'profile.html'),
        teams:        resolve(__dirname, 'teams.html'),
        'team-profile': resolve(__dirname, 'team-profile.html'),
        'player-profile': resolve(__dirname, 'player-profile.html'),
        'reset-password': resolve(__dirname, 'reset-password.html')
      }
    }
  }
});
