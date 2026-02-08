import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_app_name__',
  version: pkg.version,
  description: '__MSG_app_description__',
  default_locale: 'en',
  incognito: 'split',
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_title: '__MSG_action_title__',
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/main.ts',
    type: 'module',
  },
  permissions: ['tabs', 'storage'],
  host_permissions: [
    'https://www.pixiv.net/*',
    'https://www.google-analytics.com/*',
  ],
  content_scripts: [],
  commands: {
    'jump-random-bookmark': {
      suggested_key: {
        default: 'Ctrl+Shift+B',
        mac: 'Ctrl+Shift+B',
      },
      description: '__MSG_command_random_bookmark__',
    },
  },
});
