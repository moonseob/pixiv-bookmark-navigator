import { useEffect, useState } from 'react';
import { sendMessage } from '@/pixiv/chrome';
import { ExtensionMessageType } from '@/shared/messages';
import { getLoginStatus, setLoginStatus } from '@/storage/loginStatus';

type AuthStatus = 'checking' | 'ready' | 'needs_login' | 'error';

interface ResolveUserIdResponse {
  ok: boolean;
  userId?: string;
  error?: string;
}

export const useLoginStatus = (enabled = true) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [message, setMessage] = useState<string | null>(null);

  const checkLogin = () => {
    if (!enabled) {
      return;
    }
    setAuthStatus('checking');
    setMessage(null);
    getLoginStatus()
      .then((status) => {
        if (status) {
          setIsLoggedIn(status.isLoggedIn);
          setAuthStatus(status.isLoggedIn ? 'ready' : 'needs_login');
          setMessage(
            status.isLoggedIn ? null : 'Please log in to Pixiv first.',
          );
          return;
        }
        return sendMessage<ResolveUserIdResponse>({
          type: ExtensionMessageType.ResolveUserId,
        })
          .then((response) => {
            if (response.ok && response.userId) {
              setIsLoggedIn(true);
              setAuthStatus('ready');
              setMessage(null);
              return setLoginStatus({
                isLoggedIn: true,
                checkedAt: Date.now(),
              });
            }
            const errorText = response.error ?? '';
            const needsLogin =
              /log\s*in|login/i.test(errorText) ||
              /resolve user id/i.test(errorText);
            setIsLoggedIn(false);
            setAuthStatus(needsLogin ? 'needs_login' : 'error');
            setMessage(
              needsLogin
                ? 'Please log in to Pixiv first.'
                : 'An unknown error occurred.',
            );
            if (needsLogin) {
              return setLoginStatus({
                isLoggedIn: false,
                checkedAt: Date.now(),
              });
            }
          })
          .catch(() => {
            setIsLoggedIn(false);
            setAuthStatus('needs_login');
            setMessage('Please log in to Pixiv first.');
            return setLoginStatus({ isLoggedIn: false, checkedAt: Date.now() });
          });
      })
      .catch(() => {
        setIsLoggedIn(false);
        setAuthStatus('error');
        setMessage('An unknown error occurred.');
      });
  };

  useEffect(() => {
    checkLogin();
  }, [enabled]);

  return { isLoggedIn, authStatus, message, retry: checkLogin };
};
