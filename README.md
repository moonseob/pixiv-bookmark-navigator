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
- Support more bookmark types (illustrations/manga, novels, collections).
- Support private bookmarks.
- Firefox support

## Disclaimer
This project is not affiliated with pixiv inc. Use at your own risk; any disadvantages or damages resulting from using this program are the responsibility of each user.
