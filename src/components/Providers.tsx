import { CharcoalProvider, useTheme } from '@charcoal-ui/react';
import '@charcoal-ui/react/dist/index.css';
import {
  prefersColorScheme,
  TokenInjector,
  themeSelector,
} from '@charcoal-ui/styled';
import { dark, light } from '@charcoal-ui/theme';
import type { FC, ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';

const brandColor = '#1b95f5';
const lightTheme = {
  ...light,
  color: {
    ...light.color,
    brand: brandColor,
  },
};
const darkTheme = {
  ...dark,
  color: {
    ...dark.color,
    brand: brandColor,
  },
};

const Providers: FC<{ children: ReactNode }> = ({ children }) => {
  const [theme] = useTheme();
  return (
    <ThemeProvider theme={theme === 'dark' ? darkTheme : lightTheme}>
      <TokenInjector
        theme={{
          ':root': lightTheme,
          [themeSelector('light')]: lightTheme,
          [themeSelector('dark')]: darkTheme,
          [prefersColorScheme('dark')]: darkTheme,
        }}
        background='background1'
      />
      <CharcoalProvider>{children}</CharcoalProvider>
    </ThemeProvider>
  );
};

export default Providers;
