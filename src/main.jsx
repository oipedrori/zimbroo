import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Atualiza o service worker automaticamente
registerSW({ immediate: true })

window.onerror = function (message, source, lineno, colno, error) {
  document.body.innerHTML = `
    <div style="padding: 20px; color: white; background: #c00; font-family: sans-serif;">
      <h1>Erro Crítico</h1>
      <p>${message}</p>
      <pre>${error?.stack || ''}</pre>
    </div>
  `;
};

// Zimbroo v1.5.1 - Staging Build
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
