import { useState } from 'react';
import type { BookmarkVisibility } from '@/pixiv/bookmarkVisibility';
import { queryActiveTab, sendMessage } from '@/pixiv/chrome';
import { isPixivBookmarksUrl } from '@/pixiv/urls';
import type { SetStatus } from '@/popup/types';
import { t } from '@/shared/i18n';
import { ExtensionMessageType } from '@/shared/messages';

interface JumpResponse {
  ok: boolean;
  error?: string;
}

export const useRandomJump = (
  setStatus: SetStatus,
  defaultStatus: string,
  isLoggedIn: boolean,
  tagName: string,
  visibility: BookmarkVisibility,
) => {
  const [isJumping, setIsJumping] = useState(false);

  const handleJump = async () => {
    if (isJumping) return;
    if (!isLoggedIn) {
      setStatus(t('status_login_required'), 'error');
      return;
    }
    setIsJumping(true);
    setStatus(t('status_picking_random'), 'idle');
    try {
      const tab = await queryActiveTab();
      if (!isPixivBookmarksUrl(tab?.url)) {
        setStatus(defaultStatus, 'idle');
      }
      const response = await sendMessage<JumpResponse>({
        type: ExtensionMessageType.RandomRequest,
        tagName,
        visibility,
      });
      if (!response.ok) {
        throw new Error(response.error ?? 'Failed to jump.');
      }
      setStatus(t('status_opening_random'), 'ready');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to jump.';
      if (/log\s*in|login|user id|redirect/i.test(message)) {
        setStatus(t('status_login_required'), 'error');
        return;
      }
      if (message.includes('Could not establish connection')) {
        setStatus(t('status_open_pixiv_bookmarks'), 'error');
      } else if (message.includes('No saved bookmark stats')) {
        setStatus(t('status_visit_bookmarks'), 'error');
      } else {
        setStatus(message, 'error');
      }
    } finally {
      setIsJumping(false);
    }
  };

  return { isJumping, handleJump };
};
