import { type BookmarkType, normalizeBookmarkType } from '@/pixiv/bookmarkType';
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
  bookmarkType: BookmarkType;
}

type BookmarkStatsMap = Record<string, BookmarkStats>;

const buildKey = (
  userId: string,
  tagName: string,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
) =>
  `${userId}::${tagName}::${visibility}::${normalizeBookmarkType(
    bookmarkType,
  )}`;

const buildVisibilityLegacyKey = (
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
  bookmarkType: normalizeBookmarkType(stats.bookmarkType),
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
              existing.bookmarkType,
            )]: normalizeStats(existing),
          }
        : ((existing as BookmarkStatsMap) ?? {});
      nextMap[
        buildKey(
          normalized.userId,
          normalized.tagName,
          normalized.visibility,
          normalized.bookmarkType,
        )
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
  bookmarkType: BookmarkType,
) =>
  new Promise<BookmarkStats | null>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve(null);
      return;
    }
    const normalizedVisibility = normalizeBookmarkVisibility(visibility);
    const normalizedBookmarkType = normalizeBookmarkType(bookmarkType);
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
            legacy.visibility === normalizedVisibility &&
            legacy.bookmarkType === normalizedBookmarkType
            ? legacy
            : null,
        );
        return;
      }
      const map = existing as BookmarkStatsMap;
      const match =
        map[
          buildKey(
            userId,
            tagName,
            normalizedVisibility,
            normalizedBookmarkType,
          )
        ];
      if (match) {
        resolve(normalizeStats(match));
        return;
      }
      const visibilityLegacy =
        map[buildVisibilityLegacyKey(userId, tagName, normalizedVisibility)];
      if (visibilityLegacy) {
        const normalized = normalizeStats(visibilityLegacy);
        resolve(
          normalized.bookmarkType === normalizedBookmarkType
            ? normalized
            : null,
        );
        return;
      }
      const legacy = map[buildLegacyKey(userId, tagName)];
      if (legacy) {
        const normalized = normalizeStats(legacy);
        resolve(
          normalized.visibility === normalizedVisibility &&
            normalized.bookmarkType === normalizedBookmarkType
            ? normalized
            : null,
        );
        return;
      }
      resolve(null);
    });
  });
