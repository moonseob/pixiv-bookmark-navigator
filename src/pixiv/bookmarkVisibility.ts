export type BookmarkVisibility = 'show' | 'hide';

export const normalizeBookmarkVisibility = (
  value?: string | null,
): BookmarkVisibility => (value === 'hide' ? 'hide' : 'show');
