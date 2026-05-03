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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App store={store} />
    </BrowserRouter>
  </React.StrictMode>
);
