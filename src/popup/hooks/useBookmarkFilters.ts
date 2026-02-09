import { useCallback, useEffect, useState } from 'react';
import type { BookmarkType } from '@/pixiv/bookmarkType';
import type { BookmarkVisibility } from '@/pixiv/bookmarkVisibility';
import { queryActiveTab } from '@/pixiv/chrome';
import { parseBookmarkFiltersFromUrl } from '@/pixiv/urls';
import { trackPopupAnalytics } from '@/popup/analytics';
import {
  getBookmarkFilters,
  updateBookmarkFilters,
} from '@/storage/bookmarkFilters';

type UseBookmarkFiltersResult = {
  tagName: string;
  visibility: BookmarkVisibility;
  bookmarkType: BookmarkType;
  setVisibility: (visibility: BookmarkVisibility) => Promise<void>;
  setBookmarkType: (bookmarkType: BookmarkType) => Promise<void>;
  clearTag: () => Promise<void>;
};

const normalizeTagForType = (tagName: string, bookmarkType: BookmarkType) =>
  bookmarkType === 'collections' ? '' : tagName;

export const useBookmarkFilters = (
  userId: string | null,
): UseBookmarkFiltersResult => {
  const [tagName, setTagName] = useState('');
  const [visibility, setVisibilityState] = useState<BookmarkVisibility>('show');
  const [bookmarkType, setBookmarkTypeState] =
    useState<BookmarkType>('artworks');

  useEffect(() => {
    let isMounted = true;
    const loadStoredFilters = async () => {
      try {
        const stored = await getBookmarkFilters();
        if (!isMounted) return;
        setTagName(normalizeTagForType(stored.tagName, stored.bookmarkType));
        setVisibilityState(stored.visibility);
        setBookmarkTypeState(stored.bookmarkType);
      } catch {
        // ignore storage errors
      }
    };
    void loadStoredFilters();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const applyTagFromTab = (tab?: chrome.tabs.Tab) => {
      if (!isMounted) return;
      const nextFilters = parseBookmarkFiltersFromUrl(tab?.url);
      if (nextFilters === null) return;
      const nextTagName = normalizeTagForType(
        nextFilters.tagName,
        nextFilters.bookmarkType,
      );
      setTagName(nextTagName);
      setBookmarkTypeState(nextFilters.bookmarkType);
      void updateBookmarkFilters({
        tagName: nextTagName,
        bookmarkType: nextFilters.bookmarkType,
      });
    };
    const loadTab = async () => {
      try {
        const tab = await queryActiveTab();
        applyTagFromTab(tab);
      } catch {
        // ignore tab errors
      }
    };
    void loadTab();
    const handleUpdated = (
      _tabId: number,
      changeInfo: { url?: string },
      tab: chrome.tabs.Tab,
    ) => {
      if (!tab.active || !changeInfo.url) return;
      applyTagFromTab(tab);
    };
    const handleActivated = async () => {
      await loadTab();
    };
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.tabs.onActivated.addListener(handleActivated);
    return () => {
      isMounted = false;
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.tabs.onActivated.removeListener(handleActivated);
    };
  }, []);

  const setVisibility = useCallback(async (next: BookmarkVisibility) => {
    setVisibilityState(next);
    trackPopupAnalytics('bookmark_visibility_changed', {
      visibility: next,
    });
    try {
      await updateBookmarkFilters({ visibility: next });
    } catch {
      // ignore storage errors
    }
  }, []);

  const setBookmarkType = useCallback(async (next: BookmarkType) => {
    setBookmarkTypeState(next);
    setTagName('');
    try {
      await updateBookmarkFilters({
        bookmarkType: next,
        tagName: '',
      });
    } catch {
      // ignore storage errors
    }
  }, []);

  const clearTag = async () => {
    if (!userId) return;
    trackPopupAnalytics('tag_filter_cleared', {
      visibility,
      had_tag_filter: tagName.length > 0,
    });
    try {
      const tab = await queryActiveTab();
      const url = new URL(
        `https://www.pixiv.net/users/${userId}/bookmarks/${bookmarkType}`,
      );
      if (visibility === 'hide') {
        url.searchParams.set('rest', 'hide');
      }
      if (tab?.id) {
        chrome.tabs.update(tab.id, { url: url.toString() });
        return;
      }
      chrome.tabs.create({ url: url.toString() });
    } catch {
      // ignore tab navigation errors
    }
  };

  return {
    tagName,
    visibility,
    bookmarkType,
    setVisibility,
    setBookmarkType,
    clearTag,
  };
};
