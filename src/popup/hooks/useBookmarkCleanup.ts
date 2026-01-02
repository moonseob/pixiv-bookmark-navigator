import { useEffect, useState } from 'react';
import { parseArtworkIdFromUrl } from '@/pixiv/urls';
import { queryActiveTab } from '@/pixiv/chrome';
import { fetchBookmarkInfoForArtwork, removeBookmark } from '@/pixiv/api';
import { getRecentWorkIds, setRecentWorkIds } from '@/storage/recentHistory';
import type { SetStatus } from '@/popup/types';

export const useBookmarkCleanup = (
  setStatus: SetStatus,
  isLoggedIn: boolean,
) => {
  const [currentWorkId, setCurrentWorkId] = useState<string | null>(null);
  const [isOnArtworkPage, setIsOnArtworkPage] = useState(false);
  const [isRemovingBookmark, setIsRemovingBookmark] = useState(false);
  const [isRemovalBlocked, setIsRemovalBlocked] = useState(false);

  const handleRemoveBookmark = async () => {
    if (isRemovingBookmark) return;
    if (!isLoggedIn) {
      setStatus('Please log in to Pixiv first.', 'error');
      return;
    }
    const trimmed = currentWorkId?.trim() ?? '';
    if (!trimmed) {
      setStatus('Open an artwork page first.', 'error');
      return;
    }
    setIsRemovingBookmark(true);
    try {
      const info = await fetchBookmarkInfoForArtwork(trimmed);
      if (!info.bookmarkId) {
        setStatus('This artwork is not in your bookmarks.', 'error');
        setIsRemovalBlocked(true);
        return;
      }
      await removeBookmark(trimmed, info);
      const tab = await queryActiveTab();
      if (tab?.id) {
        chrome.tabs.reload(tab.id);
      }
      const recentWorkIds = await getRecentWorkIds();
      const nextRecent = recentWorkIds.filter((id) => id !== trimmed);
      await setRecentWorkIds(nextRecent);
      setStatus('Removed bookmark.', 'ready');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to remove bookmark.';
      setStatus(message, 'error');
    } finally {
      setIsRemovingBookmark(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const applyTab = (tab?: chrome.tabs.Tab) => {
      if (!isMounted) return;
      const workId = parseArtworkIdFromUrl(tab?.url);
      setCurrentWorkId(workId);
      setIsOnArtworkPage(Boolean(workId));
      setIsRemovalBlocked(false);
    };
    queryActiveTab()
      .then((tab) => applyTab(tab))
      .catch(() => {
        // ignore storage errors on load
      });
    const handleUpdated = (
      _tabId: number,
      changeInfo: { url?: string },
      tab: chrome.tabs.Tab,
    ) => {
      if (!tab.active || !changeInfo.url) return;
      applyTab(tab);
    };
    chrome.tabs.onUpdated.addListener(handleUpdated);
    return () => {
      isMounted = false;
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, []);

  return {
    currentWorkId,
    isOnArtworkPage,
    isRemovingBookmark,
    isRemovalBlocked,
    handleRemoveBookmark,
  };
};
