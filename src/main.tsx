import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, applyTheme } from './App';
import { APP_NAME, DB_NAME } from './config';
import { createBilling } from './billing';
import { Repo } from './data/repo';
import { IdbStorage } from './data/storage';
import { initPwa } from './pwa/register';
import { StoreProvider } from './state/store';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles.css';

try {
  applyTheme(localStorage.getItem('theme') ?? 'wildwood');
} catch {
  applyTheme('wildwood');
}

const root = document.getElementById('root')!;

/*
 * Clickjacking guard. A hostile page could load this app in an invisible frame
 * and trick you into tapping things in it. The `frame-ancestors` header stops
 * that, but basic static hosts cannot send headers, so the app also refuses to
 * start when it is not the top-level page. Storage is never opened in that case.
 */
let framed = true;
try {
  framed = window.top !== window.self;
} catch {
  framed = true;
}

if (framed) {
  root.textContent = `${APP_NAME} does not run inside another page. Open it directly.`;
} else {
  const repo = new Repo(new IdbStorage(DB_NAME));
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <StoreProvider repo={repo} billing={createBilling()}>
          <App />
        </StoreProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
  initPwa();
}
