export const STORAGE_KEY = 'pixivBookmarkStats';

export interface BookmarkStats {
  userId: string;
  total: number;
  perPage: number;
  tagName: string;
  updatedAt: number;
}

export const setBookmarkStats = (stats: BookmarkStats) =>
  new Promise<void>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    chrome.storage.session.set({ [STORAGE_KEY]: stats }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });

export const getBookmarkStats = () =>
  new Promise<BookmarkStats | null>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve(null);
      return;
    }
    chrome.storage.session.get(STORAGE_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve((result[STORAGE_KEY] as BookmarkStats) ?? null);
    });
  });
