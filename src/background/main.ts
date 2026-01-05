import {
  fetchBookmarkPage,
  fetchTotalBookmarks,
  pickRandomWork,
} from '@/pixiv/api';
import { queryActiveTab } from '@/pixiv/chrome';
import { DEFAULT_BOOKMARKS_PER_PAGE } from '@/pixiv/constants';
import { buildArtworkUrl, parseBookmarkTagFromUrl } from '@/pixiv/urls';
import { ExtensionMessageType } from '@/shared/messages';
import { getBookmarkStats, setBookmarkStats } from '@/storage/bookmarkStats';
import {
  getBookmarkTagFilter,
  setBookmarkTagFilter,
} from '@/storage/bookmarkTagFilter';
import { getRecentWorkIds, setRecentWorkIds } from '@/storage/recentHistory';
import { getSessionUser, setSessionUser } from '@/storage/sessionUser';

const LOG_PREFIX = '[pixiv-bookmark-navigator]';
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

const getTabById = (tabId: number) =>
  new Promise<chrome.tabs.Tab>((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(tab);
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

const syncTagFromTab = (tab?: chrome.tabs.Tab) => {
  const tagName = parseBookmarkTagFromUrl(tab?.url);
  if (tagName === null) return;
  void setBookmarkTagFilter(tagName);
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

const extractUserId = (url?: string) => {
  if (!url) return null;
  return url.match(/pixiv\.net\/(?:[a-z]{2}\/)?users\/(\d+)/)?.[1] ?? null;
};

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

const ensureBookmarkStats = async (tagName: string) => {
  const cachedUser = await getSessionUser();
  const cachedUserId = cachedUser?.userId ?? null;
  const resolvedUserId = cachedUserId ?? (await resolveUserIdFromRedirect());

  const stored = await getBookmarkStats(resolvedUserId, tagName);
  if (stored?.userId === resolvedUserId) {
    return stored;
  }

  const stats = await buildStats(resolvedUserId, tagName);
  await setBookmarkStats(stats);
  if (!cachedUserId) {
    await setSessionUser(resolvedUserId);
  }
  return stats;
};

const fetchRandomWorkId = async (tagName: string) => {
  const stats = await ensureBookmarkStats(tagName);

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

const isPixivUrl = (url?: string) => {
  if (!url) return false;
  try {
    return new URL(url).hostname === 'www.pixiv.net';
  } catch {
    return false;
  }
};

const handleJumpRequest = async (tagName: string) => {
  const tab = await queryActiveTab();
  if (!tab) {
    throw new Error('No active tab.');
  }
  if (!isPixivUrl(tab.url)) {
    throw new Error('Open a Pixiv tab first.');
  }

  const workId = await fetchRandomWorkId(tagName);
  await navigateToWork(tab.id, workId);
  await showBadge('🚀');
};

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  syncTagFromTab(tab);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  getTabById(tabId)
    .then((tab) => {
      syncTagFromTab(tab);
    })
    .catch(() => {
      // ignore tab access errors
    });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== ExtensionMessageType.RandomRequest) return;
  handleJumpRequest(message.tagName ?? '')
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
  (async () => {
    try {
      const tagFilter = await getBookmarkTagFilter();
      await handleJumpRequest(tagFilter.tagName ?? '');
    } catch (error) {
      await handleJumpRequest('').catch((innerError) => {
        console.warn(
          LOG_PREFIX,
          innerError instanceof Error ? innerError.message : innerError,
        );
      });
      console.warn(LOG_PREFIX, error instanceof Error ? error.message : error);
    }
  })();
});
