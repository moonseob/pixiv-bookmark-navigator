const SESSION_USER_ID_KEY = 'pixivSessionUserId';

export const getSessionUserId = () =>
  new Promise<string | null>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve(null);
      return;
    }
    chrome.storage.session.get(SESSION_USER_ID_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve((result[SESSION_USER_ID_KEY] as string) ?? null);
    });
  });

export const setSessionUserId = (userId: string) =>
  new Promise<void>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    chrome.storage.session.set({ [SESSION_USER_ID_KEY]: userId }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
