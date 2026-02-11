import { useState } from 'react';
import AppBar from '@/components/AppBar';
import { t } from '@/shared/i18n';
import PixivBlocked from '@/views/PixivBlocked';
import PixivChecking from '@/views/PixivChecking';
import usePixivContext from './hooks/usePixivContext';
import HelpPage from './Pages/HelpPage';
import MainPage from './Pages/MainPage';

type PopupView = 'main' | 'help';

export default function App() {
  const { pixivContext } = usePixivContext();
  const [view, setView] = useState<PopupView>('main');
  const isHelpView = view === 'help';

  return (
    <div className='flex-column'>
      <AppBar
        title={isHelpView ? t('app_bar_title_help') : t('app_bar_title_main')}
        onBack={isHelpView ? () => setView('main') : undefined}
      />
      {isHelpView ? (
        <HelpPage />
      ) : (
        <>
          {pixivContext === 'blocked' && <PixivBlocked />}
          {pixivContext === 'checking' && <PixivChecking />}
          {pixivContext === 'allowed' && (
            <MainPage onOpenHelp={() => setView('help')} />
          )}
        </>
      )}
    </div>
  );
}
