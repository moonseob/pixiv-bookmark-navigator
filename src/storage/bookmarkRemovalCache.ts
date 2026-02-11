const BOOKMARK_REMOVAL_CACHE_KEY = 'pixivBookmarkRemovalCache';
const MAX_CACHE_SIZE = 300;

type BookmarkRemovalCache = {
  userId: string;
  byWorkId: Record<string, string>;
  updatedAt: number;
};

const normalizeCache = (value: unknown): BookmarkRemovalCache | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.userId !== 'string') return null;
  const rawMap = record.byWorkId;
  if (!rawMap || typeof rawMap !== 'object') return null;
  const normalizedMap: Record<string, string> = {};
  for (const [workId, bookmarkId] of Object.entries(rawMap)) {
    if (typeof bookmarkId === 'string' && bookmarkId) {
      normalizedMap[String(workId)] = bookmarkId;
    }
  }
  return {
    userId: record.userId,
    byWorkId: normalizedMap,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
  };
};

const trimCacheMap = (map: Record<string, string>) => {
  const entries = Object.entries(map);
  if (entries.length <= MAX_CACHE_SIZE) return map;
  const sliced = entries.slice(entries.length - MAX_CACHE_SIZE);
  return Object.fromEntries(sliced);
};

export const getCachedBookmarkId = (userId: string, workId: string) =>
  new Promise<string | null>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve(null);
      return;
    }
    chrome.storage.session.get(BOOKMARK_REMOVAL_CACHE_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const cache = normalizeCache(result[BOOKMARK_REMOVAL_CACHE_KEY]);
      if (!cache || cache.userId !== userId) {
        resolve(null);
        return;
      }
      const bookmarkId = cache.byWorkId[workId];
      resolve(typeof bookmarkId === 'string' && bookmarkId ? bookmarkId : null);
    });
  });

export const setCachedBookmarkId = (
  userId: string,
  workId: string,
  bookmarkId: string,
) =>
  new Promise<void>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    chrome.storage.session.get(BOOKMARK_REMOVAL_CACHE_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const current = normalizeCache(result[BOOKMARK_REMOVAL_CACHE_KEY]);
      const nextMap =
        current?.userId === userId ? { ...current.byWorkId } : {};
      nextMap[workId] = bookmarkId;
      const nextCache: BookmarkRemovalCache = {
        userId,
        byWorkId: trimCacheMap(nextMap),
        updatedAt: Date.now(),
      };
      chrome.storage.session.set(
        { [BOOKMARK_REMOVAL_CACHE_KEY]: nextCache },
        () => {
          const setErr = chrome.runtime.lastError;
          if (setErr) {
            reject(new Error(setErr.message));
            return;
          }
          resolve();
        },
      );
    });
  });

export const removeCachedBookmarkId = (userId: string, workId: string) =>
  new Promise<void>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    chrome.storage.session.get(BOOKMARK_REMOVAL_CACHE_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const current = normalizeCache(result[BOOKMARK_REMOVAL_CACHE_KEY]);
      if (!current || current.userId !== userId) {
        resolve();
        return;
      }
      const nextMap = { ...current.byWorkId };
      delete nextMap[workId];
      const nextCache: BookmarkRemovalCache = {
        userId,
        byWorkId: nextMap,
        updatedAt: Date.now(),
      };
      chrome.storage.session.set(
        { [BOOKMARK_REMOVAL_CACHE_KEY]: nextCache },
        () => {
          const setErr = chrome.runtime.lastError;
          if (setErr) {
            reject(new Error(setErr.message));
            return;
          }
          resolve();
        },
      );
    });
  });
