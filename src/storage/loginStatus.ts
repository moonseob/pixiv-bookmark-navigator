const LOGIN_STATUS_KEY = 'pixivLoginStatus';

type LoginStatus = {
  isLoggedIn: boolean;
  checkedAt: number;
};

export const getLoginStatus = () =>
  new Promise<LoginStatus | null>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve(null);
      return;
    }
    chrome.storage.session.get(LOGIN_STATUS_KEY, (result) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const value = result[LOGIN_STATUS_KEY];
      if (!value || typeof value !== 'object') {
        resolve(null);
        return;
      }
      resolve(value as LoginStatus);
    });
  });

export const setLoginStatus = (status: LoginStatus) =>
  new Promise<void>((resolve, reject) => {
    if (!chrome.storage.session) {
      resolve();
      return;
    }
    chrome.storage.session.set({ [LOGIN_STATUS_KEY]: status }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
