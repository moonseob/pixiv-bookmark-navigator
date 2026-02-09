#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const LOCALE_CONFIG = {
  en: {
    browserLocale: 'en-US',
    chromeLang: 'en-US',
    title: 'pixiv Bookmark Navigator',
    subtitle: 'Jump to random bookmarks fast.',
    bullets: [
      'Works only on www.pixiv.net',
      'Tag filter aware random jump',
      'Keyboard shortcut support',
    ],
    darkSubtitle: 'Dark mode support included.',
  },
  ja: {
    browserLocale: 'ja-JP',
    chromeLang: 'ja',
    title: 'pixiv Bookmark Navigator',
    subtitle: 'pixivブックマークを素早くランダム移動。',
    bullets: [
      'www.pixiv.net専用で動作',
      'タグ条件を維持したランダム移動',
      'キーボードショートカット対応',
    ],
    darkSubtitle: 'ダークモードにも対応。',
  },
  ko: {
    browserLocale: 'ko-KR',
    chromeLang: 'ko',
    title: 'pixiv Bookmark Navigator',
    subtitle: '픽시브 북마크를 빠르게 랜덤 이동.',
    bullets: [
      'www.pixiv.net에서만 동작',
      '태그 조건을 유지한 랜덤 이동',
      '키보드 단축키 지원',
    ],
    darkSubtitle: '다크모드도 지원합니다.',
  },
};

const DEFAULT_LOCALES = ['en', 'ja', 'ko'];
const MOCK_USER_ID = 'Moonseob';
const MOCK_USER_NAME = 'Moonseob';
const MOCK_AVATAR_FILE = path.resolve(
  process.cwd(),
  'scripts/assets/demo-avatar.png',
);

const argMap = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.split('=');
    return [key, value ?? 'true'];
  }),
);

const outputRoot = path.resolve(
  process.cwd(),
  argMap.get('--outDir') ?? 'artifacts/chrome-web-store',
);
const distDir = path.resolve(process.cwd(), argMap.get('--distDir') ?? 'dist');
const locales = (argMap.get('--locales') ?? DEFAULT_LOCALES.join(','))
  .split(',')
  .map((locale) => locale.trim())
  .filter(Boolean);
const imageFormat = argMap.get('--format') === 'png' ? 'png' : 'jpeg';
const headless = argMap.get('--headless') === 'true';
const headedFallback = argMap.get('--headedFallback') === 'true';
const shouldBuild = argMap.get('--build') === 'true';
const withDarkVariant =
  argMap.get('--withDarkVariant') === 'false' ? false : true;
const VITE_PORT = 5173;

const ensurePlaywright = async () => {
  try {
    return await import('playwright');
  } catch {
    console.error(
      '[store-image] playwright is required. Run: pnpm add -D playwright && pnpm exec playwright install chromium',
    );
    process.exit(1);
  }
};

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(
        new Error(`${command} ${args.join(' ')} exited with code ${code}`),
      );
    });
    child.on('error', reject);
  });

const isPortOpen = (port, host = '127.0.0.1') =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once('timeout', onError);
    socket.once('error', onError);
    socket.connect(port, host);
  });

const ensurePort5173IsSafe = async () => {
  const isOpen = await isPortOpen(VITE_PORT);
  if (!isOpen) return;

  try {
    const response = await fetch(`http://127.0.0.1:${VITE_PORT}`, {
      signal: AbortSignal.timeout(1500),
    });
    const text = await response.text();
    const looksLikeVite =
      /@vite\/client/.test(text) ||
      /<title>\s*Vite/i.test(text) ||
      response.headers.get('server')?.toLowerCase().includes('vite');
    if (looksLikeVite) {
      return;
    }
  } catch {
    // If we cannot verify it's Vite, treat as unknown process and fail safe.
  }

  throw new Error(
    `[store-image] port ${VITE_PORT} is already in use by a non-Vite service. Stop it before running screenshots.`,
  );
};

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const resolveMessage = (template, substitutions) => {
  if (!template) return '';
  const values = Array.isArray(substitutions)
    ? substitutions
    : substitutions != null
      ? [substitutions]
      : [];
  return template.replaceAll(/\$([1-9]\d*)/g, (_match, index) => {
    const at = Number(index) - 1;
    return values[at] ?? '';
  });
};

const mockChromeApis = (
  mockUserId,
  mockName,
  mockAvatarUrl,
  localeMessages,
) => {
  const tryOverride = (obj, key, value) => {
    if (!obj) return;
    try {
      obj[key] = value;
    } catch {}
    try {
      Object.defineProperty(obj, key, {
        configurable: true,
        writable: true,
        value,
      });
    } catch {}
  };

  const runtime = globalThis.chrome?.runtime;
  if (runtime?.sendMessage) {
    const originalSendMessage = runtime.sendMessage.bind(runtime);
    tryOverride(runtime, 'sendMessage', (message, callback) => {
      if (message?.type === 'PIXIV_RESOLVE_USER_ID') {
        if (typeof callback === 'function') {
          callback({ ok: true, userId: mockUserId });
        }
        return;
      }
      return originalSendMessage(message, callback);
    });
  }

  const i18n = globalThis.chrome?.i18n;
  if (i18n?.getMessage) {
    const originalGetMessage = i18n.getMessage.bind(i18n);
    tryOverride(i18n, 'getMessage', (name, substitutions) => {
      const messageValue = localeMessages?.[name];
      if (typeof messageValue === 'string') {
        return resolveMessage(messageValue, substitutions);
      }
      return originalGetMessage(name, substitutions);
    });
  }

  const tabs = globalThis.chrome?.tabs;
  if (tabs?.query) {
    tryOverride(tabs, 'query', (_queryInfo, callback) => {
      if (typeof callback === 'function') {
        callback([
          {
            active: true,
            currentWindow: true,
            url: 'https://www.pixiv.net/bookmark.php',
          },
        ]);
      }
    });
  }

  const originalFetch = globalThis.fetch.bind(globalThis);
  tryOverride(globalThis, 'fetch', async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;

    if (/https:\/\/www\.pixiv\.net\/ajax\/user\//.test(url)) {
      return new Response(
        JSON.stringify({
          body: {
            userId: mockUserId,
            name: mockName,
            image: mockAvatarUrl,
            imageBig: mockAvatarUrl,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    return originalFetch(input, init);
  });
};

const makeStoreImageHtml = ({ localeData, popupImageDataUrl, isDark }) => {
  const bulletItems = localeData.bullets
    .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
    .join('');
  const subtitle = isDark ? localeData.darkSubtitle : localeData.subtitle;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        width: 1280px;
        height: 800px;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: ${isDark ? '#e8ecff' : '#f2f5ff'};
        background: ${
          isDark
            ? 'radial-gradient(circle at 12% 12%, #31364f 0%, #151827 45%, #0d0f1a 100%)'
            : 'radial-gradient(circle at 10% 10%, #4d5bff 0%, #2a3196 40%, #141934 100%)'
        };
        overflow: hidden;
      }
      .top-browser {
        position: absolute;
        top: 24px;
        left: 28px;
        right: 28px;
        height: 72px;
        border-radius: 16px;
        border: 1px solid ${isDark ? '#404862' : '#c4cde2'};
        background: ${isDark ? '#22293e' : '#eef2fb'};
        box-shadow: 0 16px 40px rgba(8, 12, 33, 0.35);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 16px;
      }
      .frame {
        width: 100%;
        height: 100%;
        padding: 124px 54px 54px;
        display: grid;
        grid-template-columns: 1fr 1.1fr;
        gap: 36px;
        align-items: start;
      }
      .left { display: flex; flex-direction: column; gap: 18px; }
      .eyebrow {
        display: inline-flex;
        width: fit-content;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
        border: 1px solid rgba(255, 255, 255, 0.24);
        font-size: 18px;
        font-weight: 700;
      }
      h1 { margin: 0; font-size: 67px; line-height: 1.04; }
      p.subtitle {
        margin: 0;
        font-size: 31px;
        line-height: 1.24;
        color: ${isDark ? '#d5dbff' : '#dbe1ff'};
      }
      ul {
        margin: 0;
        padding-left: 27px;
        display: grid;
        gap: 11px;
        font-size: 28px;
        color: ${isDark ? '#cfd7ff' : '#e8edff'};
      }

      .dot { width: 12px; height: 12px; border-radius: 50%; }
      .dot.red { background: #ff605c; }
      .dot.yellow { background: #ffbd44; }
      .dot.green { background: #00ca4e; }
      .address,
      .address {
        height: 32px;
        flex: 1;
        border-radius: 999px;
        border: 1px solid ${isDark ? '#525d80' : '#c3ccdf'};
        background: ${isDark ? '#1a2032' : '#ffffff'};
        color: ${isDark ? '#b9c4e6' : '#4e5675'};
        display: flex;
        align-items: center;
        padding: 0 12px;
        font-size: 14px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .toolbar-btn {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: ${isDark ? '#11182a' : '#dbe2f2'};
        border: 1px solid ${isDark ? '#44506f' : '#bbc6dd'};
      }
      .mock-region {
        position: relative;
        min-height: 640px;
      }
      .popup-drop {
        position: absolute;
        top: -2px;
        right: 20px;
        width: 446px;
        border-radius: 18px;
        background: ${isDark ? '#1a2134' : '#ecf1ff'};
        border: 1px solid ${isDark ? '#49567a' : '#c3ceec'};
        box-shadow: 0 24px 54px rgba(7, 12, 31, 0.48);
      }
      .drop-tip {
        position: absolute;
        top: -10px;
        right: 118px;
        width: 20px;
        height: 20px;
        background: ${isDark ? '#1a2134' : '#ecf1ff'};
        border-top: 1px solid ${isDark ? '#49567a' : '#c3ceec'};
        border-left: 1px solid ${isDark ? '#49567a' : '#c3ceec'};
        transform: rotate(45deg);
      }
      .popup-shell {
        margin: 12px;
        padding: 10px;
        border-radius: 14px;
        background: ${isDark ? '#2a3248' : '#f2f5ff'};
        border: 1px solid ${isDark ? '#556287' : '#cbd5f0'};
      }
      .shot { width: 100%; display: block; border-radius: 12px; }
    </style>
  </head>
  <body>
    <header class="top-browser">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <div class="address"></div>
      <div class="toolbar-btn"></div>
      <div class="toolbar-btn"></div>
      <div class="toolbar-btn"></div>
    </header>
    <main class="frame">
      <section class="left">
        <span class="eyebrow">Chrome Extension</span>
        <h1>${escapeHtml(localeData.title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
        <ul>${bulletItems}</ul>
      </section>
      <section class="mock-region" aria-label="Chrome popup dropdown mock">
        <div class="popup-drop">
          <div class="drop-tip"></div>
          <div class="popup-shell">
            <img class="shot" src="${popupImageDataUrl}" alt="popup screenshot" />
          </div>
        </div>
      </section>
    </main>
  </body>
</html>`;
};

const ensureDist = async () => {
  if (shouldBuild) {
    console.log('[store-image] running pnpm build...');
    await runCommand('pnpm', ['build']);
  }

  const info = await stat(distDir).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(
      `[store-image] missing dist folder: ${distDir}. Run "pnpm build" first, or pass --build=true.`,
    );
  }
};

const readAsDataUrl = async (filePath, mimeType) => {
  const bytes = await readFile(filePath);
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
};

const stampAvatarOnPopupScreenshot = async ({
  playwright,
  popupPath,
  mockAvatarDataUrl,
}) => {
  const popupImageDataUrl = await readAsDataUrl(popupPath, 'image/png');
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: 300px; height: 400px; overflow: hidden; }
      .root { position: relative; width: 300px; height: 400px; }
      .popup { position: absolute; inset: 0; width: 300px; height: 400px; }
      .avatar {
        position: absolute;
        left: 30px;
        top: 102px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
      }
    </style>
  </head>
  <body>
    <div class="root">
      <img class="popup" src="${popupImageDataUrl}" alt="popup" />
      <img class="avatar" src="${mockAvatarDataUrl}" alt="avatar" />
    </div>
  </body>
</html>`;
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 300, height: 400 },
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const img = document.querySelector('.avatar');
      return (
        img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
      );
    });
    await page.screenshot({ path: popupPath, type: 'png' });
  } finally {
    await browser.close();
  }
};

const capturePopupScreenshot = async ({
  playwright,
  locale,
  outputPath,
  colorScheme,
  mockAvatarDataUrl,
  runtimeHeadless,
}) => {
  const localeData = LOCALE_CONFIG[locale];
  if (!localeData) throw new Error(`Unsupported locale: ${locale}`);

  const localeMessagesRaw = await readFile(
    path.resolve(process.cwd(), `public/_locales/${locale}/messages.json`),
    'utf-8',
  );
  const localeMessagesJson = JSON.parse(localeMessagesRaw);
  const localeMessages = Object.fromEntries(
    Object.entries(localeMessagesJson).map(([key, value]) => [
      key,
      value?.message ?? '',
    ]),
  );

  const userDataDir = await mkdtemp(
    path.join(tmpdir(), `pixiv-store-${locale}-${colorScheme}-`),
  );
  const context = await playwright.chromium.launchPersistentContext(
    userDataDir,
    {
      headless: runtimeHeadless,
      locale: localeData.browserLocale,
      viewport: { width: 1400, height: 900 },
      args: [
        `--disable-extensions-except=${distDir}`,
        `--load-extension=${distDir}`,
        `--lang=${localeData.chromeLang}`,
      ],
    },
  );

  try {
    const serviceWorker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker', { timeout: 60000 }));
    const extensionId = new URL(serviceWorker.url()).hostname;

    const page = await context.newPage();
    await page.emulateMedia({ colorScheme });

    await page.addInitScript((messages) => {
      globalThis.__PBN_I18N_MESSAGES__ = messages;
    }, localeMessages);

    await page.addInitScript(
      mockChromeApis,
      MOCK_USER_ID,
      MOCK_USER_NAME,
      mockAvatarDataUrl,
      localeMessages,
    );

    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.setViewportSize({ width: 300, height: 400 });
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });
    await page
      .waitForFunction(
        () => {
          const img = document.querySelector('.surface img');
          return img instanceof HTMLImageElement && img.complete;
        },
        { timeout: 4000 },
      )
      .catch(() => {});

    await page.waitForTimeout(500);
    await page.screenshot({ path: outputPath, type: 'png' });
    await stampAvatarOnPopupScreenshot({
      playwright,
      popupPath: outputPath,
      mockAvatarDataUrl,
    });
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
};

const isServiceWorkerTimeout = (error) => {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  return name === 'TimeoutError' && /serviceworker/i.test(message);
};

const capturePopupScreenshotWithRetry = async (params) => {
  try {
    await capturePopupScreenshot({ ...params, runtimeHeadless: headless });
  } catch (error) {
    if (headless && headedFallback && isServiceWorkerTimeout(error)) {
      console.warn(
        '[store-image] service worker timeout in headless mode. retrying once with headed mode...',
      );
      await capturePopupScreenshot({ ...params, runtimeHeadless: false });
      return;
    }
    throw error;
  }
};

const renderStoreImage = async ({
  playwright,
  locale,
  popupPath,
  outputPath,
  isDark,
}) => {
  const localeData = LOCALE_CONFIG[locale];
  const popupImageDataUrl = await readAsDataUrl(popupPath, 'image/png');
  const html = makeStoreImageHtml({ localeData, popupImageDataUrl, isDark });

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(120);
    await page.screenshot({
      path: outputPath,
      type: imageFormat,
      quality: imageFormat === 'jpeg' ? 92 : undefined,
    });
  } finally {
    await browser.close();
  }
};

const main = async () => {
  await ensurePort5173IsSafe();
  await ensureDist();
  const playwright = await ensurePlaywright();

  await mkdir(outputRoot, { recursive: true });
  const popupDir = path.join(outputRoot, 'popup-screenshots');
  const listingDir = path.join(outputRoot, 'listing-images');
  await Promise.all([
    mkdir(popupDir, { recursive: true }),
    mkdir(listingDir, { recursive: true }),
  ]);

  const manifestMessages = await readFile(
    path.resolve(process.cwd(), 'public/_locales/en/messages.json'),
    'utf-8',
  );
  if (!manifestMessages.includes('app_name')) {
    throw new Error('messages.json appears invalid.');
  }
  const mockAvatarDataUrl = await readAsDataUrl(MOCK_AVATAR_FILE, 'image/png');

  for (const locale of locales) {
    if (!LOCALE_CONFIG[locale]) {
      console.warn(`[store-image] skip unsupported locale: ${locale}`);
      continue;
    }

    const lightPopupPath = path.join(popupDir, `popup-${locale}.png`);
    const lightStorePath = path.join(
      listingDir,
      `store-${locale}.${imageFormat === 'jpeg' ? 'jpg' : 'png'}`,
    );

    console.log(`[store-image] capturing light popup for ${locale}...`);
    await capturePopupScreenshotWithRetry({
      playwright,
      locale,
      outputPath: lightPopupPath,
      colorScheme: 'light',
      mockAvatarDataUrl,
    });

    console.log(`[store-image] rendering light listing image for ${locale}...`);
    await renderStoreImage({
      playwright,
      locale,
      popupPath: lightPopupPath,
      outputPath: lightStorePath,
      isDark: false,
    });

    console.log(
      `[store-image] done light ${locale}: ${pathToFileURL(lightStorePath).href}`,
    );

    if (withDarkVariant) {
      const darkPopupPath = path.join(popupDir, `popup-${locale}-dark.png`);
      const darkStorePath = path.join(
        listingDir,
        `store-${locale}-dark.${imageFormat === 'jpeg' ? 'jpg' : 'png'}`,
      );

      console.log(`[store-image] capturing dark popup for ${locale}...`);
      await capturePopupScreenshotWithRetry({
        playwright,
        locale,
        outputPath: darkPopupPath,
        colorScheme: 'dark',
        mockAvatarDataUrl,
      });

      console.log(
        `[store-image] rendering dark listing image for ${locale}...`,
      );
      await renderStoreImage({
        playwright,
        locale,
        popupPath: darkPopupPath,
        outputPath: darkStorePath,
        isDark: true,
      });

      console.log(
        `[store-image] done dark ${locale}: ${pathToFileURL(darkStorePath).href}`,
      );
    }
  }

  console.log('[store-image] completed.');
};

void main().catch((error) => {
  console.error('[store-image] failed:', error);
  process.exit(1);
});
