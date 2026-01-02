const RECENT_HISTORY_KEY = 'pixivRecentWorkIds';

export const getRecentWorkIds = () =>
  new Promise<string[]>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve([]);
      return;
    }
    chrome.storage.session.get(RECENT_HISTORY_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const value = result[RECENT_HISTORY_KEY];
      if (!Array.isArray(value)) {
        resolve([]);
        return;
      }
      resolve(value.map((item) => String(item)));
    });
  });

export const setRecentWorkIds = (ids: string[]) =>
  new Promise<void>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    chrome.storage.session.set({ [RECENT_HISTORY_KEY]: ids }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
