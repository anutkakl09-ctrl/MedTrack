import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const telegram = window.Telegram?.WebApp;
telegram?.ready();
telegram?.expand();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
