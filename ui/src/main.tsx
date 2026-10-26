import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/source-code-pro/400.css';
import '@fontsource/source-code-pro/700.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
