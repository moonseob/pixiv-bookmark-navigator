import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Providers from '@/components/Providers.tsx';
import App from './App.tsx';

import './index.css';

// biome-ignore lint/style/noNonNullAssertion: react default
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
