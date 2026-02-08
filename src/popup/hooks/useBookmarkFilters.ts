import { useCallback, useEffect, useState } from 'react';
import type { BookmarkVisibility } from '@/pixiv/bookmarkVisibility';
import { queryActiveTab } from '@/pixiv/chrome';
import { parseBookmarkTagFromUrl } from '@/pixiv/urls';
import {
  getBookmarkFilters,
  updateBookmarkFilters,
} from '@/storage/bookmarkFilters';

type UseBookmarkFiltersResult = {
  tagName: string;
  visibility: BookmarkVisibility;
  setVisibility: (visibility: BookmarkVisibility) => Promise<void>;
  clearTag: () => Promise<void>;
};

export const useBookmarkFilters = (
  userId: string | null,
): UseBookmarkFiltersResult => {
  const [tagName, setTagName] = useState('');
  const [visibility, setVisibilityState] = useState<BookmarkVisibility>('show');

  useEffect(() => {
    let isMounted = true;
    const loadStoredFilters = async () => {
      try {
        const stored = await getBookmarkFilters();
        if (!isMounted) return;
        setTagName(stored.tagName);
        setVisibilityState(stored.visibility);
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
      const nextTagName = parseBookmarkTagFromUrl(tab?.url);
      if (nextTagName === null) return;
      setTagName(nextTagName);
      void updateBookmarkFilters({ tagName: nextTagName });
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
    try {
      await updateBookmarkFilters({ visibility: next });
    } catch {
      // ignore storage errors
    }
  }, []);

  const clearTag = async () => {
    if (!userId) return;
    try {
      const tab = await queryActiveTab();
      const url = new URL(
        `https://www.pixiv.net/users/${userId}/bookmarks/artworks`,
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

  return { tagName, visibility, setVisibility, clearTag };
};
