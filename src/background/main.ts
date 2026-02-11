import { sendAnalyticsEvent } from '@/analytics/ga4';
import {
  fetchBookmarkPage,
  fetchTotalBookmarks,
  pickRandomItem,
} from '@/pixiv/api';
import { type BookmarkType, normalizeBookmarkType } from '@/pixiv/bookmarkType';
import {
  type BookmarkVisibility,
  normalizeBookmarkVisibility,
} from '@/pixiv/bookmarkVisibility';
import { queryActiveTab } from '@/pixiv/chrome';
import { DEFAULT_BOOKMARKS_PER_PAGE } from '@/pixiv/constants';
import { parseBookmarkFiltersFromUrl } from '@/pixiv/urls';
import {
  ExtensionMessageType,
  type PopupAnalyticsEventName,
} from '@/shared/messages';
import {
  getBookmarkFilters,
  updateBookmarkFilters,
} from '@/storage/bookmarkFilters';
import { setCachedBookmarkId } from '@/storage/bookmarkRemovalCache';
import { getBookmarkStats, setBookmarkStats } from '@/storage/bookmarkStats';
import { getRecentWorkIds, setRecentWorkIds } from '@/storage/recentHistory';
import { getSessionUser, setSessionUser } from '@/storage/sessionUser';

const LOG_PREFIX = '[pixiv-bookmark-navigator]';
const RECENT_HISTORY_LIMIT = 10;
const BADGE_TIMEOUT_MS = 1500;

const normalizeTagForType = (
  tagName: string,
  bookmarkType: BookmarkType,
) => (bookmarkType === 'collections' ? '' : tagName);

interface ResolveUserIdResponse {
  ok: boolean;
  userId?: string;
  error?: string;
}

type JumpTrigger = 'popup_button' | 'keyboard_shortcut';

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

const buildBookmarkUrl = (workId: string, bookmarkType: BookmarkType) => {
  if (bookmarkType === 'novels') {
    return `https://www.pixiv.net/novel/show.php?id=${workId}`;
  }
  if (bookmarkType === 'collections') {
    return `https://www.pixiv.net/collections/${workId}`;
  }
  return `https://www.pixiv.net/artworks/${workId}`;
};

const navigateToWork = async (
  tabId: number | undefined,
  workId: string,
  bookmarkType: BookmarkType,
) => {
  const url = buildBookmarkUrl(workId, bookmarkType);
  if (tabId) {
    await updateTabUrl(tabId, url);
    return;
  }
  await createTab(url);
};

const syncTagFromTab = (tab?: chrome.tabs.Tab) => {
  const filters = parseBookmarkFiltersFromUrl(tab?.url);
  if (filters === null) return;
  const normalizedTag = normalizeTagForType(
    filters.tagName,
    filters.bookmarkType,
  );
  void updateBookmarkFilters({
    tagName: normalizedTag,
    bookmarkType: filters.bookmarkType,
  });
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

const buildStats = async (
  userId: string,
  tagName: string,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
) => {
  const total = await fetchTotalBookmarks(
    userId,
    tagName,
    visibility,
    bookmarkType,
  );
  return {
    userId,
    total,
    perPage: DEFAULT_BOOKMARKS_PER_PAGE,
    tagName,
    visibility,
    bookmarkType,
    updatedAt: Date.now(),
  };
};

const ensureBookmarkStats = async (
  tagName: string,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
) => {
  const cachedUser = await getSessionUser();
  const cachedUserId = cachedUser?.userId ?? null;
  const resolvedUserId = cachedUserId ?? (await resolveUserIdFromRedirect());

  const stored = await getBookmarkStats(
    resolvedUserId,
    tagName,
    visibility,
    bookmarkType,
  );
  if (stored?.userId === resolvedUserId) {
    return stored;
  }

  const stats = await buildStats(
    resolvedUserId,
    tagName,
    visibility,
    bookmarkType,
  );
  await setBookmarkStats(stats);
  if (!cachedUserId) {
    await setSessionUser(resolvedUserId);
  }
  return stats;
};

const fetchRandomWorkId = async (
  tagName: string,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
) => {
  const stats = await ensureBookmarkStats(tagName, visibility, bookmarkType);

  const perPage = Math.max(1, stats.perPage || DEFAULT_BOOKMARKS_PER_PAGE);
  const total =
    stats.total && stats.total > 0
      ? stats.total
      : await fetchTotalBookmarks(
          stats.userId,
          stats.tagName,
          visibility,
          bookmarkType,
        );
  const numPages = Math.max(1, Math.ceil(total / perPage));
  const pageIndex = Math.floor(Math.random() * numPages);

  const data = await fetchBookmarkPage(
    stats.userId,
    stats.tagName,
    perPage * pageIndex,
    perPage,
    visibility,
    bookmarkType,
  );

  const bookmarkItems = extractBookmarkItems(data.body);
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
  const unseen = bookmarkItems.filter(
    (work) => !recentWorkIds.includes(`${bookmarkType}:${work.id}`),
  );
  const candidateWorks = unseen.length > 0 ? unseen : bookmarkItems;
  const randomWork = pickRandomItem(candidateWorks);
  recentWorkIds.push(`${bookmarkType}:${String(randomWork.id)}`);
  if (recentWorkIds.length > RECENT_HISTORY_LIMIT) {
    recentWorkIds.splice(0, recentWorkIds.length - RECENT_HISTORY_LIMIT);
  }
  await setRecentWorkIds(recentWorkIds);
  if (bookmarkType === 'artworks' && randomWork.bookmarkId) {
    await setCachedBookmarkId(
      stats.userId,
      String(randomWork.id),
      randomWork.bookmarkId,
    );
  }
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

const classifyJumpError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/log\s*in|login|redirect|user id/i.test(message)) {
    return 'login_required';
  }
  if (message.includes('Open a Pixiv tab first.')) {
    return 'non_pixiv_tab';
  }
  if (message.includes('No active tab.')) {
    return 'no_active_tab';
  }
  if (message.includes('No saved bookmark stats')) {
    return 'missing_stats';
  }
  if (message.includes('No bookmarks found')) {
    return 'no_bookmarks';
  }
  return 'unknown';
};

const trackRandomJumpAttempt = (
  trigger: JumpTrigger,
  visibility: BookmarkVisibility,
  tagName: string,
) => {
  void sendAnalyticsEvent('random_jump_attempt', {
    trigger,
    visibility,
    has_tag_filter: tagName.length > 0,
  });
};

const trackRandomJumpResult = (
  trigger: JumpTrigger,
  visibility: BookmarkVisibility,
  tagName: string,
  result: 'success' | 'failure',
  errorType?: string,
) => {
  void sendAnalyticsEvent('random_jump_result', {
    trigger,
    visibility,
    has_tag_filter: tagName.length > 0,
    result,
    error_type: errorType,
  });
};

const handleJumpRequestWithTracking = async (
  tagName: string,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
  trigger: JumpTrigger,
) => {
  const normalizedTag = normalizeTagForType(tagName, bookmarkType);
  trackRandomJumpAttempt(trigger, visibility, normalizedTag);
  try {
    await handleJumpRequest(normalizedTag, visibility, bookmarkType);
    trackRandomJumpResult(trigger, visibility, normalizedTag, 'success');
  } catch (error) {
    trackRandomJumpResult(
      trigger,
      visibility,
      normalizedTag,
      'failure',
      classifyJumpError(error),
    );
    throw error;
  }
};

const handlePopupAnalyticsEvent = (
  eventName: PopupAnalyticsEventName,
  params: Record<string, unknown> | undefined,
) => {
  if (eventName === 'popup_opened') {
    const authStatus = params?.auth_status;
    if (typeof authStatus !== 'string') return;
    void sendAnalyticsEvent(eventName, { auth_status: authStatus });
    return;
  }
  if (eventName === 'bookmark_visibility_changed') {
    const visibility = params?.visibility;
    if (visibility !== 'show' && visibility !== 'hide') return;
    void sendAnalyticsEvent(eventName, { visibility });
    return;
  }
  if (eventName === 'tag_filter_cleared') {
    const visibility = params?.visibility;
    const hadTagFilter = params?.had_tag_filter;
    if (visibility !== 'show' && visibility !== 'hide') return;
    void sendAnalyticsEvent(eventName, {
      visibility,
      had_tag_filter: hadTagFilter === true,
    });
  }
};

const handleJumpRequest = async (
  tagName: string,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
) => {
  const tab = await queryActiveTab();
  if (!tab) {
    throw new Error('No active tab.');
  }
  if (!isPixivUrl(tab.url)) {
    throw new Error('Open a Pixiv tab first.');
  }

  const workId = await fetchRandomWorkId(tagName, visibility, bookmarkType);
  await navigateToWork(tab.id, workId, bookmarkType);
  await showBadge('🚀');
};

const parseItemId = (item: unknown): string | null => {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const idCandidate =
    record.id ??
    record.illustId ??
    record.novelId ??
    record.collectionId ??
    null;
  if (typeof idCandidate === 'number') {
    return String(idCandidate);
  }
  if (typeof idCandidate === 'string') {
    return idCandidate;
  }
  return null;
};

const parseBookmarkId = (item: unknown): string | null => {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const bookmarkData = record.bookmarkData;
  if (bookmarkData && typeof bookmarkData === 'object') {
    const bookmarkRecord = bookmarkData as Record<string, unknown>;
    const bookmarkId = bookmarkRecord.id;
    if (typeof bookmarkId === 'string') {
      return bookmarkId;
    }
    if (typeof bookmarkId === 'number') {
      return String(bookmarkId);
    }
  }
  if (typeof record.bookmarkId === 'string') {
    return record.bookmarkId;
  }
  if (typeof record.bookmarkId === 'number') {
    return String(record.bookmarkId);
  }
  return null;
};

const extractBookmarkItems = (
  body: unknown,
): Array<{ id: string; bookmarkId: string | null }> => {
  if (!body || typeof body !== 'object') {
    return [];
  }
  const raw = body as Record<string, unknown>;
  const works = Array.isArray(raw.works)
    ? raw.works
    : Array.isArray(raw.bookmarks)
      ? raw.bookmarks
      : [];
  return works
    .map((work) => {
      const id = parseItemId(work);
      if (!id) return null;
      return { id, bookmarkId: parseBookmarkId(work) };
    })
    .filter((item): item is { id: string; bookmarkId: string | null } =>
      Boolean(item),
    );
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
  const visibility = normalizeBookmarkVisibility(message.visibility);
  const trigger: JumpTrigger =
    message?.trigger === 'keyboard_shortcut'
      ? 'keyboard_shortcut'
      : 'popup_button';
  const bookmarkType = normalizeBookmarkType(message.bookmarkType);
  handleJumpRequestWithTracking(
    message.tagName ?? '',
    visibility,
    bookmarkType,
    trigger,
  )
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
  if (message?.type !== ExtensionMessageType.TrackAnalytics) return;
  handlePopupAnalyticsEvent(message.eventName, message.params);
  sendResponse({ ok: true });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== ExtensionMessageType.ResolveUser) return;
  resolveUserIdFromRedirect()
    .then(async (userId) => {
      const filters = await getBookmarkFilters();
      const normalizedTag = normalizeTagForType(
        filters.tagName,
        filters.bookmarkType,
      );
      const stats = await buildStats(
        userId,
        normalizedTag,
        filters.visibility,
        filters.bookmarkType,
      );
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
    const filters = await getBookmarkFilters();
    try {
      await handleJumpRequestWithTracking(
        filters.tagName,
        filters.visibility,
        filters.bookmarkType,
        'keyboard_shortcut',
      );
    } catch (error) {
      console.warn(LOG_PREFIX, error instanceof Error ? error.message : error);
    }
  })();
});
