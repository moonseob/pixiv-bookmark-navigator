import { useCallback, useEffect, useState } from 'react';
import { fetchUserProfile } from '@/pixiv/api';
import { clearSessionUser } from '@/storage/sessionUser';
import type { UserProfile } from '@/storage/userProfile';
import {
  clearUserProfile,
  getUserProfile,
  setUserProfile,
} from '@/storage/userProfile';

export type ProfileStatus = 'checking' | 'ready' | 'empty' | 'error';

export const useUserProfile = (userId: string | null, enabled: boolean) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('checking');

  const loadProfile = useCallback(
    async (force: boolean) => {
      if (!enabled) {
        setProfile(null);
        setProfileStatus('checking');
        return;
      }
      setProfileStatus('checking');

      if (!userId) {
        setProfile(null);
        await clearSessionUser();
        await clearUserProfile();
        setProfileStatus('empty');
        return;
      }

      if (!force) {
        const cached = await getUserProfile();
        if (cached?.userId === userId) {
          setProfile(cached);
          setProfileStatus('ready');
          return;
        }
        if (cached?.userId && cached.userId !== userId) {
          setProfile(null);
          await clearUserProfile();
        }
      }

      let shouldClearUser = false;
      try {
        const nextProfile = await fetchUserProfile(userId);
        if (!nextProfile?.userId) {
          shouldClearUser = true;
          throw new Error('Missing user id.');
        }
        setProfile(nextProfile);
        await setUserProfile(nextProfile);
        setProfileStatus('ready');
      } catch {
        setProfile(null);
        if (shouldClearUser) {
          await clearSessionUser();
        }
        await clearUserProfile();
        setProfileStatus('error');
      }
    },
    [enabled, userId],
  );

  useEffect(() => {
    void loadProfile(false);
  }, [loadProfile]);

  return {
    profile,
    isLoading: profileStatus === 'checking',
    profileStatus,
    refresh: () => loadProfile(true),
  };
};
