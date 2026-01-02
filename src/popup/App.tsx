import { Button, LoadingSpinner } from '@charcoal-ui/react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import Header from '@/components/Header';
import NavigationButton from '@/components/NavigateNextButton';
import { queryActiveTab } from '@/pixiv/chrome';
import { isPixivBookmarksUrl } from '@/pixiv/urls';
import { useBookmarkCleanup } from '@/popup/hooks/useBookmarkCleanup';
import { useLoginStatus } from '@/popup/hooks/useLoginStatus';
import { useRandomJump } from '@/popup/hooks/useRandomJump';
import type { StatusState } from '@/popup/types';

const DEFAULT_STATUS = 'Open a Pixiv bookmarks page.';

export default function App() {
  const [statusText, setStatusText] = useState(DEFAULT_STATUS);
  const [statusState, setStatusState] = useState<StatusState>('idle');
  const [pixivContext, setPixivContext] = useState<
    'checking' | 'allowed' | 'blocked'
  >('checking');
  const { isLoggedIn, authStatus, message, retry } = useLoginStatus(
    pixivContext === 'allowed',
  );

  const setStatus = (message: string, state: StatusState = 'idle') => {
    setStatusText(message);
    setStatusState(state);
  };

  const {
    currentWorkId,
    isOnArtworkPage,
    isRemovingBookmark,
    isRemovalBlocked,
    handleRemoveBookmark,
  } = useBookmarkCleanup(setStatus, Boolean(isLoggedIn));
  const { isJumping, handleJump } = useRandomJump(
    setStatus,
    DEFAULT_STATUS,
    Boolean(isLoggedIn),
  );

  useEffect(() => {
    queryActiveTab()
      .then((tab) => {
        const url = tab?.url;
        if (!url) {
          setPixivContext('blocked');
          return;
        }
        try {
          const host = new URL(url).hostname;
          if (host !== 'www.pixiv.net') {
            setPixivContext('blocked');
            return;
          }
        } catch {
          setPixivContext('blocked');
          return;
        }
        setPixivContext('allowed');
        if (isPixivBookmarksUrl(tab?.url)) {
          setStatus('Ready on Pixiv bookmarks page.', 'ready');
          return;
        }
        setStatus(DEFAULT_STATUS, 'idle');
      })
      .catch(() => {
        setStatus('Could not check bookmarks page state.', 'error');
        setPixivContext('blocked');
      });
  }, []);

  useEffect(() => {
    if (authStatus === 'needs_login') {
      setStatus('Please log in to Pixiv first.', 'error');
    } else if (authStatus === 'error') {
      setStatus('An unknown error occurred.', 'error');
    }
  }, [authStatus]);

  if (pixivContext === 'checking') {
    return (
      <>
        <Header />
        <StyledContainer>
          <SpinnerWrap>
            <LoadingSpinner size={40} padding={12} />
            <SpinnerText>사이트 확인중입니다.</SpinnerText>
          </SpinnerWrap>
        </StyledContainer>
      </>
    );
  }

  if (pixivContext === 'blocked') {
    return (
      <>
        <Header />
        <StyledContainer>
          <Status data-state='error'>
            Pixiv 페이지에서만 사용할 수 있습니다.
          </Status>
        </StyledContainer>
      </>
    );
  }

  if (authStatus === 'checking') {
    return (
      <>
        <Header />
        <StyledContainer>
          <SpinnerWrap>
            <LoadingSpinner size={40} padding={12} />
            <SpinnerText>로그인 상태를 확인중입니다.</SpinnerText>
          </SpinnerWrap>
        </StyledContainer>
      </>
    );
  }

  if (authStatus === 'needs_login' || authStatus === 'error') {
    return (
      <>
        <Header />
        <StyledContainer>
          <Status data-state='error'>
            {message ?? 'Please log in to Pixiv first.'}
          </Status>
          <Button variant='Default' fullWidth onClick={retry}>
            다시 확인하기
          </Button>
        </StyledContainer>
      </>
    );
  }

  return (
    <>
      <Header />
      <StyledContainer>
        {/* TODO: 내비게이션을 사용해서 메인 화면과 서브 화면을 분리 */}
        <Status data-state={statusState}>{statusText}</Status>

        <NavigationButton
          onClick={handleJump}
          disabled={isJumping || isLoggedIn !== true}
          label={isJumping ? 'Please wait...' : 'Random Bookmark'}
        />
        {isOnArtworkPage && (
          <>
            <StyledHr />
            <IconButton
              variant='Danger'
              onClick={handleRemoveBookmark}
              disabled={
                isRemovingBookmark ||
                isRemovalBlocked ||
                !currentWorkId ||
                isLoggedIn !== true
              }
              aria-label='Remove bookmark'
              title='Remove bookmark'
              fullWidth
            >
              <span>Remove bookmark</span>
            </IconButton>
            {isRemovalBlocked && (
              <MutedText>This artwork is not in your bookmarks.</MutedText>
            )}
          </>
        )}
      </StyledContainer>
    </>
  );
}

const StyledContainer = styled.main`
  margin: 1em;
  display: grid;
  grid-auto-flow: row;
  gap: 1em;
`;

const StyledHr = styled.hr`
  align-self: stretch;
  height: 1px;
  background-color: var(--charcoal-text4);
  outline: 0;
  border: 0;
  margin: 0;
`;

const Status = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--charcoal-text2);

  &[data-state='error'] {
    color: var(--charcoal-danger);
  }

  &[data-state='ready'] {
    color: var(--charcoal-success);
  }
`;

const IconButton = styled(Button)`
  padding: 4px 8px;
  min-width: auto;
  color: var(--charcoal-text2);
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &[data-variant='remove'] {
    color: var(--charcoal-danger);
    border-color: var(--charcoal-danger);
  }

`;

const MutedText = styled.p`
  margin: 0;
  font-size: 11px;
  color: var(--charcoal-text3);
`;

const SpinnerWrap = styled.div`
  display: grid;
  place-items: center;
  padding: 12px 0;
  gap: 8px;
`;

const SpinnerText = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--charcoal-text3);
`;
