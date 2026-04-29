import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { createAppStore } from './store/useStore';

const store = createAppStore();

ReactDOM.hydrateRoot(
  document.getElementById('root')!,
  <React.StrictMode>
    <BrowserRouter>
      <App store={store} />
    </BrowserRouter>
  </React.StrictMode>
);
