import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Липсва #root в index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
