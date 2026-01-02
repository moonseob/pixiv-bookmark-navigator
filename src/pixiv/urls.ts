export const isPixivBookmarksUrl = (url?: string) => {
  if (!url) return false;
  return /https:\/\/www\.pixiv\.net\/users\/\d+\/bookmarks/.test(url);
};

export const parseUserIdFromUrl = (url?: string) =>
  url?.match(/pixiv\.net\/users\/(\d+)/)?.[1] ?? null;

export const parseArtworkIdFromUrl = (url?: string) =>
  url?.match(/pixiv\.net\/artworks\/(\d+)/)?.[1] ?? null;

export const buildBookmarksPageUrl = (userId: string) =>
  `https://www.pixiv.net/users/${userId}/bookmarks/artworks`;

export const buildArtworkUrl = (workId: string) =>
  `https://www.pixiv.net/artworks/${workId}`;
