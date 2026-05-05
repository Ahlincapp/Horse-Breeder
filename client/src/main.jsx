import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Global error logger for debugging
window.addEventListener('error', (e) => {
  console.error('🚨 Global error:', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('🚨 Unhandled promise rejection:', e.reason);
});
console.log('🚀 main.jsx loaded');
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)