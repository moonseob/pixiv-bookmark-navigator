import {
  fetchBookmarkPage,
  fetchTotalBookmarks,
  pickRandomWork,
} from '@/pixiv/api';
import { queryActiveTab } from '@/pixiv/chrome';
import { DEFAULT_BOOKMARKS_PER_PAGE } from '@/pixiv/constants';
import { buildArtworkUrl } from '@/pixiv/urls';
import { ExtensionMessageType } from '@/shared/messages';
import { getBookmarkStats, setBookmarkStats } from '@/storage/bookmarkStats';
import { getRecentWorkIds, setRecentWorkIds } from '@/storage/recentHistory';
import { getSessionUser, setSessionUser } from '@/storage/sessionUser';

const LOG_PREFIX = '[pixiv Bookmark Helper]';
const RECENT_HISTORY_LIMIT = 10;
const BADGE_TIMEOUT_MS = 1500;

interface ResolveUserIdResponse {
  ok: boolean;
  userId?: string;
  error?: string;
}

const updateTabUrl = (tabId: number, url: string) =>
  new Promise<void>((resolve, reject) => {
    chrome.tabs.update(tabId, { url }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });

const createTab = (url: string) =>
  new Promise<void>((resolve, reject) => {
    chrome.tabs.create({ url }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });

const navigateToWork = async (tabId: number | undefined, workId: string) => {
  const url = buildArtworkUrl(workId);
  if (tabId) {
    await updateTabUrl(tabId, url);
    return;
  }
  await createTab(url);
};

const showBadge = (text: string, bgColor?: string) =>
  new Promise<void>((resolve, reject) => {
    chrome.action.setBadgeText({ text }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (!bgColor) {
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, BADGE_TIMEOUT_MS);
        resolve();
        return;
      }
      chrome.action.setBadgeBackgroundColor({ color: bgColor }, () => {
        const err2 = chrome.runtime.lastError;
        if (err2) {
          reject(new Error(err2.message));
          return;
        }
        setTimeout(() => {
          chrome.action.setBadgeText({ text: '' });
        }, BADGE_TIMEOUT_MS);
        resolve();
      });
    });
  });

const extractUserId = (url?: string) =>
  url?.match(/pixiv\.net\/users\/(\d+)/)?.[1] ?? null;

const resolveUserIdFromRedirect = async () => {
  let response: Response;
  try {
    response = await fetch('https://www.pixiv.net/bookmark.php', {
      credentials: 'include',
    });
  } catch (error) {
    console.warn(LOG_PREFIX, 'UserId redirect request failed.', {
      message: error instanceof Error ? error.message : error,
    });
    throw new Error('Please log in to pixiv first.');
  }

  const redirectUrl = response.url;
  if (redirectUrl.includes('accounts.pixiv.net')) {
    throw new Error('Please log in to pixiv first.');
  }
  if (!redirectUrl.includes('/bookmarks')) {
    throw new Error('Please log in to pixiv first.');
  }
  const userId = extractUserId(redirectUrl);
  if (!userId) {
    throw new Error('Please log in to pixiv first.');
  }
  return userId;
};

const buildStats = async (userId: string, tagName = '') => {
  const total = await fetchTotalBookmarks(userId, tagName);
  return {
    userId,
    total,
    perPage: DEFAULT_BOOKMARKS_PER_PAGE,
    tagName,
    updatedAt: Date.now(),
  };
};

const ensureBookmarkStats = async () => {
  const stored = await getBookmarkStats();
  const cachedUser = await getSessionUser();
  const cachedUserId = cachedUser?.userId ?? null;
  const resolvedUserId = cachedUserId ?? (await resolveUserIdFromRedirect());

  if (stored?.userId === resolvedUserId) {
    return stored;
  }

  const stats = await buildStats(resolvedUserId);
  await setBookmarkStats(stats);
  if (!cachedUserId) {
    await setSessionUser(resolvedUserId);
  }
  return stats;
};

const fetchRandomWorkId = async () => {
  const stats = await ensureBookmarkStats();

  const perPage = Math.max(1, stats.perPage || DEFAULT_BOOKMARKS_PER_PAGE);
  const total =
    stats.total && stats.total > 0
      ? stats.total
      : await fetchTotalBookmarks(stats.userId, stats.tagName);
  const numPages = Math.max(1, Math.ceil(total / perPage));
  const pageIndex = Math.floor(Math.random() * numPages);

  const data = await fetchBookmarkPage(
    stats.userId,
    stats.tagName,
    perPage * pageIndex,
    perPage,
  );
  const works = data.body?.works ?? [];
  const latestTotal = data.body?.total;
  if (typeof latestTotal === 'number' && !Number.isNaN(latestTotal)) {
    if (latestTotal !== stats.total) {
      await setBookmarkStats({
        ...stats,
        total: latestTotal,
        perPage,
        updatedAt: Date.now(),
      });
    }
  }
  const recentWorkIds = await getRecentWorkIds();
  const unseen = works.filter((work) => !recentWorkIds.includes(work.id));
  const candidateWorks = unseen.length > 0 ? unseen : works;
  const randomWork = pickRandomWork(candidateWorks);
  recentWorkIds.push(String(randomWork.id));
  if (recentWorkIds.length > RECENT_HISTORY_LIMIT) {
    recentWorkIds.splice(0, recentWorkIds.length - RECENT_HISTORY_LIMIT);
  }
  await setRecentWorkIds(recentWorkIds);
  return randomWork.id;
};

const handleJumpRequest = async () => {
  const tab = await queryActiveTab();
  if (!tab) {
    throw new Error('No active tab.');
  }

  const workId = await fetchRandomWorkId();
  await navigateToWork(tab.id, workId);
  await showBadge('🚀');
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== ExtensionMessageType.RandomRequest) return;
  handleJumpRequest()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error.';
      console.warn(LOG_PREFIX, messageText);
      sendResponse({ ok: false, error: messageText });
    });
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== ExtensionMessageType.ResolveUser) return;
  resolveUserIdFromRedirect()
    .then(async (userId) => {
      const stats = await buildStats(userId);
      await setBookmarkStats(stats);
      await setSessionUser(userId);
      sendResponse({ ok: true, userId } satisfies ResolveUserIdResponse);
    })
    .catch((error) => {
      const messageText =
        error instanceof Error ? error.message : 'Unknown error.';
      console.warn(LOG_PREFIX, messageText);
      sendResponse({
        ok: false,
        error: messageText,
      } satisfies ResolveUserIdResponse);
    });
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'jump-random-bookmark') return;
  handleJumpRequest().catch((error) => {
    console.warn(LOG_PREFIX, error instanceof Error ? error.message : error);
  });
});
