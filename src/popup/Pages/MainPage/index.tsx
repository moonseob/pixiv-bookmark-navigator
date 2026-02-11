import {
  Button,
  DropdownMenuItem,
  DropdownSelector,
  SegmentedControl,
} from '@charcoal-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import BookmarkTagFilterStatus from '@/components/BookmarkTagFilterStatus';
import {
  Card,
  CardBody,
  CardHeader,
  CardText,
  CardTitle,
} from '@/components/Card';
import ProfileCard from '@/components/ProfileCard';
import type { BookmarkType } from '@/pixiv/bookmarkType';
import { trackPopupAnalytics } from '@/popup/analytics';
import { useBookmarkCleanup } from '@/popup/hooks/useBookmarkCleanup';
import { useBookmarkFilters } from '@/popup/hooks/useBookmarkFilters';
import { useLoginStatus } from '@/popup/hooks/useLoginStatus';
import { useRandomJump } from '@/popup/hooks/useRandomJump';
import { useUserProfile } from '@/popup/hooks/useUserProfile';
import { t } from '@/shared/i18n';

export default function MainPage({ onOpenHelp }: { onOpenHelp: () => void }) {
  const {
    authStatus,
    refresh: refreshLoginStatus,
    userId,
  } = useLoginStatus(true);
  const hasTrackedPopupOpen = useRef(false);
  const isLoggedIn = authStatus === 'ready';

  useEffect(() => {
    if (hasTrackedPopupOpen.current) return;
    if (authStatus === 'checking') return;
    hasTrackedPopupOpen.current = true;
    trackPopupAnalytics('popup_opened', { auth_status: authStatus });
  }, [authStatus]);

  const { profile, refresh: refreshProfile } = useUserProfile(
    userId,
    isLoggedIn,
  );

  const {
    tagName,
    visibility,
    bookmarkType,
    setVisibility,
    setBookmarkType,
    clearTag,
  } = useBookmarkFilters(userId);
  const [isTagHelpOpen, setIsTagHelpOpen] = useState(false);
  const noopSetStatus = useCallback(() => {}, []);

  const {
    isOnArtworkPage,
    isRemovingBookmark,
    isRemovalBlocked,
    hasCachedBookmarkId,
    isRemoved,
    handleRemoveBookmark,
  } = useBookmarkCleanup(isLoggedIn, userId);

  const { isJumping, handleJump } = useRandomJump(
    noopSetStatus,
    '',
    isLoggedIn,
    tagName,
    visibility,
    bookmarkType,
  );

  return (
    <>
      <StyledSurface className='surface'>
        <Card>
          <CardHeader>
            <CardTitle>{t('main_current_user')}</CardTitle>
          </CardHeader>
          <CardBody>
            <ProfileCard
              authStatus={authStatus}
              profile={profile}
              onRecheck={() => {
                refreshLoginStatus();
                refreshProfile();
              }}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('main_bookmark_type')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BookmarkTypeSelector
              value={bookmarkType}
              disabled={!isLoggedIn}
              label={t('main_bookmark_type')}
              onChange={(value) => {
                if (isBookmarkType(value)) {
                  void setBookmarkType(value);
                }
              }}
            >
              <DropdownMenuItem value='artworks'>
                {t('main_bookmark_type_artworks')}
              </DropdownMenuItem>
              <DropdownMenuItem value='novels'>
                {t('main_bookmark_type_novels')}
              </DropdownMenuItem>
              <DropdownMenuItem value='collections'>
                {t('main_bookmark_type_collections')}
              </DropdownMenuItem>
            </BookmarkTypeSelector>
          </CardBody>
        </Card>
        {bookmarkType !== 'collections' && (
          <Card>
            <CardHeader>
              <CardTitle>{t('main_tag_filter')}</CardTitle>
              <HelpToggleButton
                variant='Default'
                isActive={isTagHelpOpen}
                aria-label={
                  isTagHelpOpen
                    ? t('main_tag_help_hide')
                    : t('main_tag_help_show')
                }
                title={
                  isTagHelpOpen
                    ? t('main_tag_help_hide')
                    : t('main_tag_help_show')
                }
                onClick={() => setIsTagHelpOpen((prev) => !prev)}
              >
                <pixiv-icon name={isTagHelpOpen ? '24/Close' : '24/Info'} />
              </HelpToggleButton>
            </CardHeader>
            <CardBody>
              {isTagHelpOpen ? (
                <CardText>{t('help_tag_body')}</CardText>
              ) : (
                <BookmarkTagFilterStatus
                  tagName={tagName}
                  disabled={!isLoggedIn}
                  onClear={clearTag}
                />
              )}
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{t('main_visibility')}</CardTitle>
          </CardHeader>
          <CardBody style={{ display: 'inline-block' }}>
            <SegmentedControl
              name={t('main_visibility')}
              value={visibility}
              disabled={!isLoggedIn}
              onChange={(value) => {
                if (value === 'show' || value === 'hide') {
                  void setVisibility(value);
                }
              }}
              data={[
                { label: t('main_visibility_public'), value: 'show' },
                { label: t('main_visibility_private'), value: 'hide' },
              ]}
            />
          </CardBody>
        </Card>
      </StyledSurface>
      <StyledPrimaryButton
        variant='Primary'
        disabled={isJumping || isLoggedIn !== true}
        onClick={handleJump}
      >
        {isJumping ? t('main_please_wait') : t('main_random_bookmark')}
      </StyledPrimaryButton>
      <ActionDivider />
      <SecondaryActionRow>
        <StyledRemoveButton
          variant='Default'
          data-removed={isRemoved}
          disabled={
            isRemovingBookmark ||
            !isLoggedIn ||
            !isOnArtworkPage ||
            isRemovalBlocked ||
            !hasCachedBookmarkId
          }
          onClick={() => {
            void handleRemoveBookmark();
          }}
        >
          <pixiv-icon name={isRemoved ? '24/Check' : '24/Trash'} />
          {isRemoved ? t('main_remove_bookmark_done') : t('main_remove_bookmark')}
        </StyledRemoveButton>
        <StyledHelpButton variant='Default' onClick={onOpenHelp}>
          <pixiv-icon name='24/Info' />
          {t('app_bar_title_help')}
        </StyledHelpButton>
      </SecondaryActionRow>
    </>
  );
}

const isBookmarkType = (value: string): value is BookmarkType =>
  value === 'artworks' || value === 'novels' || value === 'collections';

const StyledPrimaryButton = styled(Button)`
  width: auto;
  box-sizing: border-box;
  margin: 8px 8px 4px;
`;

const ActionDivider = styled.div`
  margin: 0 8px 8px;
  border-top: 1px solid var(--charcoal-surface3);
  opacity: 0.8;
`;

const SecondaryActionRow = styled.div`
  display: flex;
  gap: 6px;
  margin: 0 8px 8px;
`;

const StyledRemoveButton = styled(Button)`
  flex: 1.25 1 0%;
  min-width: 0;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  && {
    background-color: rgba(195, 47, 47, 0.14);
    border-color: rgba(195, 47, 47, 0.3);
    color: rgb(150, 31, 31);
  }
  &[data-removed='true'] {
    background-color: var(--charcoal-surface3);
    border-color: var(--charcoal-surface3);
    color: var(--charcoal-text3);
  }

  &&:hover:not(:disabled) {
    background-color: rgba(195, 47, 47, 0.22);
    border-color: rgba(195, 47, 47, 0.45);
  }
  &[data-removed='true']:hover:not(:disabled) {
    background-color: var(--charcoal-surface3);
    border-color: var(--charcoal-surface3);
  }

  &&:disabled {
    opacity: 0.7;
  }
  pixiv-icon {
    --size: 14px;
  }
`;

const StyledHelpButton = styled(Button)`
  flex: 0.95 1 0%;
  min-width: 0;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pixiv-icon {
    --size: 14px;
  }
`;

const StyledSurface = styled.div`
  flex: 1 1 0%;
  margin: 8px;
  padding: 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const BookmarkTypeSelector = styled(DropdownSelector)`
  width: 100%;
`;

const HelpToggleButton = styled(Button)`
  height: 24px;
  padding: 0 4px;
  min-height: 24px;
  font-size: 12px;
  pixiv-icon {
    --size: 16px;
  }
`;
