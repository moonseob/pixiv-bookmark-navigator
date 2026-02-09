import { type BookmarkType, normalizeBookmarkType } from './bookmarkType';

export const isPixivBookmarksUrl = (url?: string) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return /^\/(?:[a-z]{2}\/)?users\/\d+\/bookmarks(?:\/|$)/.test(
      parsed.pathname,
    );
  } catch {
    return false;
  }
};

export const parseUserIdFromUrl = (url?: string) =>
  url?.match(/pixiv\.net\/users\/(\d+)/)?.[1] ?? null;

export const parseArtworkIdFromUrl = (url?: string) =>
  url?.match(/pixiv\.net\/artworks\/(\d+)/)?.[1] ?? null;

export const parseBookmarkTagFromUrl = (url?: string) => {
  const parsed = parseBookmarkFiltersFromUrl(url);
  if (!parsed) return null;
  return parsed.tagName;
};

export const parseBookmarkTypeFromUrl = (url?: string) => {
  const parsed = parseBookmarkFiltersFromUrl(url);
  if (!parsed) return null;
  return parsed.bookmarkType;
};

export const parseBookmarkFiltersFromUrl = (
  url?: string,
): { tagName: string; bookmarkType: BookmarkType } | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(
      /^\/(?:[a-z]{2}\/)?users\/\d+\/bookmarks(?:\/(artworks|novels|collections)(?:\/([^/?#]+))?)?/,
    );
    if (!match) return null;
    const bookmarkType = normalizeBookmarkType(match[1]);
    const rawTag = match[2];
    const tagName = rawTag ? decodeURIComponent(rawTag) : '';
    return {
      tagName,
      bookmarkType,
    };
  } catch {
    return null;
  }
};
