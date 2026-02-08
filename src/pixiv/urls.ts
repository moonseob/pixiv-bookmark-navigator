export const isPixivBookmarksUrl = (url?: string) => {
  if (!url) return false;
  return /https:\/\/www\.pixiv\.net\/users\/\d+\/bookmarks/.test(url);
};

export const parseUserIdFromUrl = (url?: string) =>
  url?.match(/pixiv\.net\/users\/(\d+)/)?.[1] ?? null;

export const parseArtworkIdFromUrl = (url?: string) =>
  url?.match(/pixiv\.net\/artworks\/(\d+)/)?.[1] ?? null;

export const parseBookmarkTagFromUrl = (url?: string) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(
      /\/users\/\d+\/bookmarks\/artworks(?:\/([^/?#]+))?/,
    );
    if (!match) return null;
    const rawTag = match[1];
    if (!rawTag) return '';
    return decodeURIComponent(rawTag);
  } catch {
    return null;
  }
};
