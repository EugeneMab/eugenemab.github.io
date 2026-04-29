import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App';
import { createAppStore, AppData } from './store/useStore';

export function render(
  url: string,
  initialData?: AppData,
  initialPath?: string,
  initialClientId?: string
) {
  const store = createAppStore(initialData, initialPath, initialClientId);

  const html = ReactDOMServer.renderToString(
    <React.StrictMode>
      <StaticRouter location={url}>
        <App store={store} />
      </StaticRouter>
    </React.StrictMode>
  );
  return { html };
}
