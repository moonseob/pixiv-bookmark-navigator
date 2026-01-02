import {
  fetchBookmarkPage,
  fetchTotalBookmarks,
  pickRandomWork,
} from '@/pixiv/api';
import { DEFAULT_BOOKMARKS_PER_PAGE } from '@/pixiv/constants';
import { buildArtworkUrl } from '@/pixiv/urls';
import { queryActiveTab } from '@/pixiv/chrome';
import { ExtensionMessageType } from '@/shared/messages';
import { getBookmarkStats, setBookmarkStats } from '@/storage/bookmarkStats';
import { getRecentWorkIds, setRecentWorkIds } from '@/storage/recentHistory';
import { getSessionUserId, setSessionUserId } from '@/storage/sessionUserId';

const LOG_PREFIX = '[pixiv Bookmark Helper]';
const RECENT_HISTORY_LIMIT = 10;

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

const extractUserId = (url?: string) =>
  url?.match(/pixiv\.net\/users\/(\d+)/)?.[1] ?? null;

const resolveUserIdFromRedirect = async () => {
  const response = await fetch('https://www.pixiv.net/bookmark.php', {
    credentials: 'include',
  });
  if (!response.ok) {
    let responseText = '';
    try {
      responseText = await response.text();
    } catch {
      responseText = '(failed to read response body)';
    }
    console.warn(LOG_PREFIX, 'UserId redirect request failed.', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      body: responseText,
    });
    throw new Error(`UserId redirect failed: ${response.status}`);
  }
  const userId = extractUserId(response.url);
  if (!userId) {
    throw new Error('Failed to resolve user id. Are you logged in?');
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
  const cachedUserId = await getSessionUserId();
  const resolvedUserId = cachedUserId ?? (await resolveUserIdFromRedirect());

  if (stored?.userId === resolvedUserId) {
    return stored;
  }

  const stats = await buildStats(resolvedUserId);
  await setBookmarkStats(stats);
  if (!cachedUserId) {
    await setSessionUserId(resolvedUserId);
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
  if (message?.type !== ExtensionMessageType.ResolveUserId) return;
  resolveUserIdFromRedirect()
    .then(async (userId) => {
      const stats = await buildStats(userId);
      await setBookmarkStats(stats);
      await setSessionUserId(userId);
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
