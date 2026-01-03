import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'pixiv Bookmark Helper',
  version: pkg.version,
  description: pkg.description,
  incognito: 'split',
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_title: 'pixiv Bookmark Helper',
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  permissions: ['tabs', 'storage'],
  host_permissions: ['https://www.pixiv.net/*'],
  content_scripts: [],
  commands: {
    'jump-random-bookmark': {
      suggested_key: {
        default: 'Ctrl+Shift+B',
        mac: 'Ctrl+Shift+B',
      },
      description: 'Random bookmark',
    },
  },
});
