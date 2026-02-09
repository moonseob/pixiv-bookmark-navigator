# pixiv Bookmark Navigator

A lightweight browser extension that helps you navigate and manage pixiv bookmarks.

Available on [Chrome Web Store](https://chromewebstore.google.com/detail/ecddglechhfilpbkgaholhemfiocjmgp)

## Features
- Jump to a random bookmark.
- Bookmark tag filter synced from pixiv bookmark pages.
- Optional keyboard shortcut for random jumps (configurable in Chrome).
- Login-aware UI state and pixiv-only activation.

## Overview
<img width="1280" height="800" alt="" src="https://github.com/user-attachments/assets/66b42616-4400-414a-8bec-8308227500b5" />

- Works only on `www.pixiv.net` and requires you to be logged in.
- UI is shown through the extension popup (no content scripts).
- Login state is checked and cached in session storage.
- Keyboard shortcut support for random bookmarks (optional).

## Built With
- [CRXJS](https://crxjs.dev) + Vite.
- React + TypeScript.
- [@charcoal-ui](https://github.com/pixiv/charcoal) by pixiv

## Development
- Use the project Node.js version with pnpm:
  ```bash
  pnpm env use --global $(cat .node-version)
  ```
- Install git hooks:
  ```bash
  pnpm install
  ```
- Start the dev server:
  ```bash
  pnpm dev
  ```
- Load the extension from the dev output if prompted by CRXJS, or continue using the `dist` folder after a build.

### Localization
- Keep `public/_locales/en/messages.json` as the source of truth.
- When adding or changing UI/manifest strings, update all locale files.

## Future Goals
- Allow unbookmarking via a button click.
- Navigate to previous/next bookmark with left/right arrow keys (pixiv mobile app-style).
- Firefox support

## Chrome Web Store Image Automation
- Generate localized popup screenshots (`en`, `ja`, `ko`) and 1280x800 listing images:
  ```bash
  pnpm store:images
  ```
- Run in headless mode (optional):
  ```bash
  pnpm store:images -- --headless=true
  ```
- Build latest assets before capture when needed:
  ```bash
  pnpm store:images -- --build=true
  ```
- Generate only light-mode assets:
  ```bash
  pnpm store:images -- --withDarkVariant=false
  ```
- Enable headed fallback retry only when using headless mode:
  ```bash
  pnpm store:images -- --headless=true --headedFallback=true
  ```
- Output paths:
  - `artifacts/chrome-web-store/popup-screenshots/popup-<locale>.png`
  - `artifacts/chrome-web-store/popup-screenshots/popup-<locale>-dark.png`
  - `artifacts/chrome-web-store/listing-images/store-<locale>.jpg`
  - `artifacts/chrome-web-store/listing-images/store-<locale>-dark.jpg`
- Requirement:
  - `playwright` + Chromium runtime are required.
  - Popup capture runs in headed mode by default.
  - In headless mode, service worker initialization can fail on some environments; optional fallback retry can be enabled with `--headedFallback=true`.
  - If port `5173` is used by a non-Vite service, the script exits with an error.
  - If not installed yet:
    ```bash
    pnpm add -D playwright
    pnpm exec playwright install chromium
    ```
  - Profile avatar for screenshots is loaded from `scripts/assets/demo-avatar.png`.
  - Script entry point: `scripts/generate-store-images.mjs`.

## Disclaimer
This project is not affiliated with pixiv inc. Use at your own risk; any disadvantages or damages resulting from using this program are the responsibility of each user.
