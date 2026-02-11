import { useEffect, useRef, useState } from 'react';
import { removeBookmark } from '@/pixiv/api';
import { queryActiveTab } from '@/pixiv/chrome';
import { parseArtworkIdFromUrl } from '@/pixiv/urls';
import {
  getCachedBookmarkId,
  removeCachedBookmarkId,
} from '@/storage/bookmarkRemovalCache';
import { getRecentWorkIds, setRecentWorkIds } from '@/storage/recentHistory';

export const useBookmarkCleanup = (
  isLoggedIn: boolean,
  userId: string | null,
) => {
  const [currentWorkId, setCurrentWorkId] = useState<string | null>(null);
  const [isOnArtworkPage, setIsOnArtworkPage] = useState(false);
  const [isRemovingBookmark, setIsRemovingBookmark] = useState(false);
  const [isRemovalBlocked, setIsRemovalBlocked] = useState(false);
  const [hasCachedBookmarkId, setHasCachedBookmarkId] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const requestVersionRef = useRef(0);

  const handleRemoveBookmark = async () => {
    if (isRemovingBookmark) return;
    if (!isLoggedIn) return;
    const trimmed = currentWorkId?.trim() ?? '';
    if (!trimmed || !userId) return;
    setIsRemovingBookmark(true);
    try {
      const cachedBookmarkId = await getCachedBookmarkId(userId, trimmed);
      if (!cachedBookmarkId) {
        setHasCachedBookmarkId(false);
        setIsRemovalBlocked(true);
        return;
      }
      try {
        await removeBookmark(trimmed, {
          csrfToken: null,
          bookmarkId: cachedBookmarkId,
        });
      } catch {
        await removeBookmark(trimmed);
      }
      const recentWorkIds = await getRecentWorkIds();
      const nextRecent = recentWorkIds.filter((id) => id !== trimmed);
      await setRecentWorkIds(nextRecent);
      await removeCachedBookmarkId(userId, trimmed);
      try {
        const activeTab = await queryActiveTab();
        if (activeTab?.id) {
          chrome.tabs.reload(activeTab.id);
        }
      } catch {
        // ignore tab reload errors
      }
      setHasCachedBookmarkId(false);
      setIsRemovalBlocked(true);
      setIsRemoved(true);
    } catch {
      setHasCachedBookmarkId(false);
      setIsRemovalBlocked(true);
      // keep silent by design
    } finally {
      setIsRemovingBookmark(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const applyTab = async (tab?: chrome.tabs.Tab) => {
      if (!isMounted) return;
      const requestVersion = ++requestVersionRef.current;
      const workId = parseArtworkIdFromUrl(tab?.url);
      setCurrentWorkId(workId);
      setIsOnArtworkPage(Boolean(workId));
      setIsRemovalBlocked(false);
      setIsRemoved(false);
      if (!workId || !userId) {
        setHasCachedBookmarkId(false);
        return;
      }
      try {
        const cachedBookmarkId = await getCachedBookmarkId(userId, workId);
        if (!isMounted || requestVersion !== requestVersionRef.current) return;
        setHasCachedBookmarkId(Boolean(cachedBookmarkId));
      } catch {
        if (!isMounted || requestVersion !== requestVersionRef.current) return;
        setHasCachedBookmarkId(false);
      }
    };
    const loadTab = async () => {
      try {
        const tab = await queryActiveTab();
        await applyTab(tab);
      } catch {
        // ignore storage errors on load
      }
    };
    void loadTab();
    const handleUpdated = (
      _tabId: number,
      changeInfo: { url?: string },
      tab: chrome.tabs.Tab,
    ) => {
      if (!tab.active || !changeInfo.url) return;
      void applyTab(tab);
    };
    chrome.tabs.onUpdated.addListener(handleUpdated);
    return () => {
      isMounted = false;
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, [userId]);

  return {
    currentWorkId,
    isOnArtworkPage,
    isRemovingBookmark,
    isRemovalBlocked,
    hasCachedBookmarkId,
    isRemoved,
    handleRemoveBookmark,
  };
};
