import { fetchArtworkPageData, fetchWithCsrfToken } from '@/pixiv/auth';
import type { BookmarkType } from '@/pixiv/bookmarkType';
import type { BookmarkVisibility } from '@/pixiv/bookmarkVisibility';
import type { UserProfile } from '@/storage/userProfile';
import type { PixivResponse, PixivUserResponse } from './types';

const getBookmarksApiPath = (userId: string, bookmarkType: BookmarkType) => {
  if (bookmarkType === 'novels') {
    return `https://www.pixiv.net/ajax/user/${userId}/novels/bookmarks`;
  }
  if (bookmarkType === 'collections') {
    return `https://www.pixiv.net/ajax/user/${userId}/collections/bookmarks`;
  }
  return `https://www.pixiv.net/ajax/user/${userId}/illusts/bookmarks`;
};

export const buildBookmarksApiUrl = (
  userId: string,
  tagName: string,
  offset: number,
  limit: number,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
) => {
  const url = new URL(getBookmarksApiPath(userId, bookmarkType));
  if (bookmarkType !== 'collections') {
    url.searchParams.set('tag', tagName ?? '');
  }
  url.searchParams.set('offset', offset.toString());
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('rest', visibility);
  url.searchParams.set('lang', 'en');
  return url.toString();
};

const fetchPixiv = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`pixiv API error: ${response.status}`);
  }
  return (await response.json()) as PixivResponse;
};

export const fetchBookmarkPage = async (
  userId: string,
  tagName: string,
  offset: number,
  limit: number,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
) => {
  const url = buildBookmarksApiUrl(
    userId,
    tagName,
    offset,
    limit,
    visibility,
    bookmarkType,
  );
  return fetchPixiv(url);
};

export const fetchTotalBookmarks = async (
  userId: string,
  tagName: string,
  visibility: BookmarkVisibility,
  bookmarkType: BookmarkType,
) => {
  const data = await fetchBookmarkPage(
    userId,
    tagName,
    0,
    1,
    visibility,
    bookmarkType,
  );
  const total = data.body?.total;
  if (typeof total !== 'number' || Number.isNaN(total)) {
    throw new Error('Missing total count from pixiv API.');
  }
  return total;
};

export const pickRandomItem = <T>(items: T[]) => {
  if (items.length === 0) {
    throw new Error('No bookmarks found.');
  }
  return items[Math.floor(Math.random() * items.length)];
};

type BookmarkInfo = {
  csrfToken: string | null;
  bookmarkId: string | null;
};

export const fetchBookmarkInfoForArtwork = async (
  workId: string,
): Promise<BookmarkInfo> => fetchArtworkPageData(workId);

export const removeBookmark = async (workId: string, info?: BookmarkInfo) => {
  console.log('[bookmark-remove] start', { workId });
  const { csrfToken, bookmarkId } =
    info ?? (await fetchArtworkPageData(workId));
  console.log('[bookmark-remove] page data', {
    hasToken: Boolean(csrfToken),
    bookmarkId,
  });
  if (!csrfToken) {
    throw new Error('Failed to read pixiv token.');
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

export const fetchUserProfile = async (
  userId: string,
): Promise<UserProfile> => {
  const response = await fetch(`https://www.pixiv.net/ajax/user/${userId}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.status}`);
  }
  const data = (await response.json()) as PixivUserResponse;
  const body: PixivUserResponse['body'] = data.body;
  return {
    userId: body.userId,
    name: body.name,
    image: body.imageBig ?? body.image,
  };
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
