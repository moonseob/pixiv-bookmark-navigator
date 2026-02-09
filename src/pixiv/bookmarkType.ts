export type BookmarkType = 'artworks' | 'novels' | 'collections';

export const normalizeBookmarkType = (value?: string | null): BookmarkType => {
  if (value === 'novels' || value === 'collections') {
    return value;
  }
  return 'artworks';
};
