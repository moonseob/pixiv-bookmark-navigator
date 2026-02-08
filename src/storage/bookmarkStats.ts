import {
  type BookmarkVisibility,
  normalizeBookmarkVisibility,
} from '@/pixiv/bookmarkVisibility';

export const STORAGE_KEY = 'pixivBookmarkStats';

export interface BookmarkStats {
  userId: string;
  total: number;
  perPage: number;
  tagName: string;
  updatedAt: number;
  visibility: BookmarkVisibility;
}

type BookmarkStatsMap = Record<string, BookmarkStats>;

const buildKey = (
  userId: string,
  tagName: string,
  visibility: BookmarkVisibility,
) => `${userId}::${tagName}::${visibility}`;

const buildLegacyKey = (userId: string, tagName: string) =>
  `${userId}::${tagName}`;

const isBookmarkStats = (value: unknown): value is BookmarkStats => {
  if (!value || typeof value !== 'object') return false;
  return (
    'userId' in value &&
    'total' in value &&
    'perPage' in value &&
    'tagName' in value &&
    'updatedAt' in value
  );
};

const normalizeStats = (stats: BookmarkStats): BookmarkStats => ({
  ...stats,
  visibility: normalizeBookmarkVisibility(stats.visibility),
});

export const setBookmarkStats = (stats: BookmarkStats) =>
  new Promise<void>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    const normalized = normalizeStats(stats);
    chrome.storage.session.get(STORAGE_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const existing = result[STORAGE_KEY];
      const nextMap: BookmarkStatsMap = isBookmarkStats(existing)
        ? {
            [buildKey(
              existing.userId,
              existing.tagName,
              normalizeBookmarkVisibility(existing.visibility),
            )]: normalizeStats(existing),
          }
        : ((existing as BookmarkStatsMap) ?? {});
      nextMap[
        buildKey(normalized.userId, normalized.tagName, normalized.visibility)
      ] = normalized;
      chrome.storage.session.set({ [STORAGE_KEY]: nextMap }, () => {
        const err2 = chrome.runtime.lastError;
        if (err2) {
          reject(new Error(err2.message));
          return;
        }
        resolve();
      });
    });
  });

export const getBookmarkStats = (
  userId: string,
  tagName: string,
  visibility: BookmarkVisibility,
) =>
  new Promise<BookmarkStats | null>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve(null);
      return;
    }
    const normalizedVisibility = normalizeBookmarkVisibility(visibility);
    chrome.storage.session.get(STORAGE_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const existing = result[STORAGE_KEY];
      if (!existing || typeof existing !== 'object') {
        resolve(null);
        return;
      }
      if (isBookmarkStats(existing)) {
        const legacy = normalizeStats(existing);
        resolve(
          legacy.userId === userId &&
            legacy.tagName === tagName &&
            legacy.visibility === normalizedVisibility
            ? legacy
            : null,
        );
        return;
      }
      const map = existing as BookmarkStatsMap;
      const match = map[buildKey(userId, tagName, normalizedVisibility)];
      if (match) {
        resolve(normalizeStats(match));
        return;
      }
      const legacy = map[buildLegacyKey(userId, tagName)];
      if (legacy) {
        const normalized = normalizeStats(legacy);
        resolve(
          normalized.visibility === normalizedVisibility ? normalized : null,
        );
        return;
      }
      resolve(null);
    });
  });
