export const queryActiveTab = () =>
  new Promise<chrome.tabs.Tab | undefined>((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(tabs[0]);
    });
  });

export const sendMessage = <TResponse,>(message: unknown) =>
  new Promise<TResponse>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (!response) {
        reject(new Error('No response from background.'));
        return;
      }
      resolve(response as TResponse);
    });
  });
