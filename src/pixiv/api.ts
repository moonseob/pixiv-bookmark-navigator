import { fetchArtworkPageData, fetchWithCsrfToken } from '@/pixiv/auth';
import type { PixivResponse, PixivWork } from './types';

export const buildBookmarksApiUrl = (
  userId: string,
  tagName: string,
  offset: number,
  limit: number,
) => {
  const url = new URL(
    `https://www.pixiv.net/ajax/user/${userId}/illusts/bookmarks`,
  );
  url.searchParams.set('tag', tagName ?? '');
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('rest', 'show');
  url.searchParams.set('lang', 'en');
  return url.toString();
};

const fetchPixiv = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Pixiv API error: ${response.status}`);
  }
  return (await response.json()) as PixivResponse;
};

export const fetchBookmarkPage = async (
  userId: string,
  tagName: string,
  offset: number,
  limit: number,
) => {
  const url = buildBookmarksApiUrl(userId, tagName, offset, limit);
  return fetchPixiv(url);
};

export const fetchTotalBookmarks = async (userId: string, tagName: string) => {
  const data = await fetchBookmarkPage(userId, tagName, 0, 1);
  const total = data.body?.total;
  if (typeof total !== 'number' || Number.isNaN(total)) {
    throw new Error('Missing total count from Pixiv API.');
  }
  return total;
};

export const pickRandomWork = (works: PixivWork[]) => {
  if (works.length === 0) {
    throw new Error('No bookmarks found.');
  }
  return works[Math.floor(Math.random() * works.length)];
};

type BookmarkInfo = {
  csrfToken: string | null;
  bookmarkId: string | null;
};

export const fetchBookmarkInfoForArtwork = async (
  workId: string,
): Promise<BookmarkInfo> => fetchArtworkPageData(workId);

export const removeBookmark = async (
  workId: string,
  info?: BookmarkInfo,
) => {
  console.log('[bookmark-remove] start', { workId });
  const { csrfToken, bookmarkId } =
    info ?? (await fetchArtworkPageData(workId));
  console.log('[bookmark-remove] page data', {
    hasToken: Boolean(csrfToken),
    bookmarkId,
  });
  if (!csrfToken) {
    throw new Error('Failed to read Pixiv token.');
  }
  if (!bookmarkId) {
    throw new Error('Failed to resolve bookmark ID.');
  }
  const response = await fetch(
    'https://www.pixiv.net/ajax/illusts/bookmarks/delete',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'X-CSRF-TOKEN': csrfToken,
      },
      body: new URLSearchParams({ bookmark_id: bookmarkId }).toString(),
    },
  );
  console.log('[bookmark-remove] response', response.status);
  if (!response.ok) {
    throw new Error(`Failed to remove bookmark: ${response.status}`);
  }
  const data = (await response.json()) as { error?: boolean; message?: string };
  if (data.error) {
    throw new Error(data.message ?? 'Failed to remove bookmark.');
  }
};

export const addBookmark = async (workId: string) => {
  const response = await fetchWithCsrfToken({
    url: 'https://www.pixiv.net/ajax/illusts/bookmarks/add',
    csrfFromUrl: `https://www.pixiv.net/artworks/${workId}`,
    body: JSON.stringify({
      illust_id: Number(workId),
      restrict: 0,
      comment: '',
      tags: [],
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to add bookmark: ${response.status}`);
  }
  const data = (await response.json()) as { error?: boolean; message?: string };
  if (data.error) {
    throw new Error(data.message ?? 'Failed to add bookmark.');
  }
};
