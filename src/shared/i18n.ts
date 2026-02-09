export const t = (key: string, substitutions?: string | string[]) => {
  const overrideMessages = (globalThis as Record<string, unknown>)
    .__PBN_I18N_MESSAGES__ as Record<string, string> | undefined;
  if (overrideMessages) {
    const template = overrideMessages[key];
    if (typeof template === 'string' && template.length > 0) {
      const values = Array.isArray(substitutions)
        ? substitutions
        : substitutions != null
          ? [substitutions]
          : [];
      return template.replace(/\$([1-9]\d*)/g, (_match, index) => {
        const at = Number(index) - 1;
        return values[at] ?? '';
      });
    }
  }

  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const message = chrome.i18n.getMessage(key, substitutions);
    return message || key;
  }
  return key;
};
