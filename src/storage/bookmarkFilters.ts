import { type BookmarkType, normalizeBookmarkType } from '@/pixiv/bookmarkType';
import {
  type BookmarkVisibility,
  normalizeBookmarkVisibility,
} from '@/pixiv/bookmarkVisibility';

const STORAGE_KEY = 'pixivBookmarkFilters';

export type BookmarkFiltersState = {
  tagName: string;
  visibility: BookmarkVisibility;
  bookmarkType: BookmarkType;
  updatedAt: number;
};

const defaultState: BookmarkFiltersState = {
  tagName: '',
  visibility: 'show',
  bookmarkType: 'artworks',
  updatedAt: 0,
};

const normalizeFiltersState = (
  value?: Partial<BookmarkFiltersState> | null,
): BookmarkFiltersState => ({
  tagName: typeof value?.tagName === 'string' ? value.tagName : '',
  visibility: normalizeBookmarkVisibility(value?.visibility),
  bookmarkType: normalizeBookmarkType(value?.bookmarkType),
  updatedAt: typeof value?.updatedAt === 'number' ? value.updatedAt : 0,
});

export const getBookmarkFilters = () =>
  new Promise<BookmarkFiltersState>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve(defaultState);
      return;
    }
    chrome.storage.session.get(STORAGE_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const value = result[STORAGE_KEY];
      if (value && typeof value === 'object') {
        const normalized = normalizeFiltersState(value as BookmarkFiltersState);
        const normalizedValue = value as Partial<BookmarkFiltersState>;
        if (
          normalized.tagName !== normalizedValue.tagName ||
          normalized.visibility !== normalizedValue.visibility ||
          normalized.bookmarkType !== normalizedValue.bookmarkType ||
          normalized.updatedAt !== normalizedValue.updatedAt
        ) {
          chrome.storage.session.set({ [STORAGE_KEY]: normalized });
        }
        resolve(normalized);
        return;
      }
      const initialState: BookmarkFiltersState = {
        tagName: '',
        visibility: 'show',
        bookmarkType: 'artworks',
        updatedAt: Date.now(),
      };
      chrome.storage.session.set({ [STORAGE_KEY]: initialState }, () => {
        const setErr = chrome.runtime.lastError;
        if (setErr) {
          reject(new Error(setErr.message));
          return;
        }
        resolve(initialState);
      });
    });
  });

export const setBookmarkFilters = (filters: BookmarkFiltersState) =>
  new Promise<void>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    const normalized = normalizeFiltersState(filters);
    chrome.storage.session.set({ [STORAGE_KEY]: normalized }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });

export const updateBookmarkFilters = async (
  updates: Partial<BookmarkFiltersState>,
) => {
  const current = await getBookmarkFilters();
  const nextState: BookmarkFiltersState = {
    ...current,
    ...updates,
    updatedAt: Date.now(),
  };
  await setBookmarkFilters(nextState);
};
