# pixiv Bookmark Helper

A lightweight browser extension that helps you navigate and manage pixiv bookmarks.
Role: Popup-only WebExtension for bookmark navigation and quick actions on pixiv.net.

## Overview
- Works only on `www.pixiv.net` and requires you to be logged in.
- UI is shown through the extension popup (no content scripts).
- Login state is checked and cached in session storage.

## Features
- Jump to a random bookmark.
- Login-aware UI state and pixiv-only activation.

## Install
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Build the extension:
   ```bash
   pnpm build
   ```
3. Open `chrome://extensions` in Chrome (or Chromium-based browser).
4. Enable Developer mode.
5. Click "Load unpacked" and select the `dist` directory.

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

## Future Goals
- Allow unbookmarking via a button click.
- Navigate to previous/next bookmark with left/right arrow keys (pixiv mobile app-style).
- Support bookmark tags.
- Support more bookmark types (illustrations/manga, novels, collections).

## Disclaimer
This project is not affiliated with pixiv Inc. Use at your own risk; any disadvantages or damages resulting from using this program are the responsibility of each user.
