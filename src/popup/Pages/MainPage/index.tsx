import {
  Button,
  DropdownMenuItem,
  DropdownSelector,
  SegmentedControl,
} from '@charcoal-ui/react';
import { useEffect, useRef, useState } from 'react';
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
import { useBookmarkFilters } from '@/popup/hooks/useBookmarkFilters';
import { useLoginStatus } from '@/popup/hooks/useLoginStatus';
import { useRandomJump } from '@/popup/hooks/useRandomJump';
import { useUserProfile } from '@/popup/hooks/useUserProfile';
import { t } from '@/shared/i18n';

export default function MainPage() {
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

  // const {
  //   currentWorkId,
  //   isOnArtworkPage,
  //   isRemovingBookmark,
  //   isRemovalBlocked,
  //   handleRemoveBookmark,
  // } = useBookmarkCleanup(setStatus, isLoggedIn);

  const { isJumping, handleJump } = useRandomJump(
    () => {},
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
    </>
  );
}

const isBookmarkType = (value: string): value is BookmarkType =>
  value === 'artworks' || value === 'novels' || value === 'collections';

const StyledPrimaryButton = styled(Button)`
  width: auto;
  box-sizing: border-box;
  margin: 8px;
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
