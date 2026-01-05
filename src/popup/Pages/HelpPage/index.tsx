import { Button } from '@charcoal-ui/react';
import styled from 'styled-components';
import { Card, CardBody, CardText, CardTitle } from '@/components/Card';
import { t } from '@/shared/i18n';

const SHORTCUTS_URL = 'chrome://extensions/shortcuts';
const GITHUB_URL = 'https://github.com/moonseob/pixiv-bookmark-navigator';

const openUrl = (url: string) => {
  try {
    chrome.tabs.create({ url });
  } catch {
    window.open(url, '_blank');
  }
};

export default function HelpPage() {
  return (
    <Container className='surface'>
      <Card>
        <CardTitle>{t('help_keyboard_shortcuts_title')}</CardTitle>
        <CardBody>
          <CardText>{t('help_keyboard_shortcuts_body')}</CardText>
          <CardText>{t('help_keyboard_shortcuts_recommend')}</CardText>
        </CardBody>
        <Button variant='Navigation' onClick={() => openUrl(SHORTCUTS_URL)}>
          {t('help_open_shortcuts')}
        </Button>
      </Card>
      <Card>
        <CardTitle>{t('help_github_title')}</CardTitle>
        <CardBody>
          <CardText>{t('help_github_body')}</CardText>
        </CardBody>
        <Button variant='Default' onClick={() => openUrl(GITHUB_URL)}>
          {t('help_open_github')}
        </Button>
      </Card>
      <Card>
        <CardBody>
          <CardText>{t('help_disclaimer')}</CardText>
        </CardBody>
      </Card>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px;
  margin: 8px;
  overflow: auto;
`;
