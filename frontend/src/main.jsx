
// Tự động gắn JWT Token cho mọi request /api/admin
const _origFetch = window.fetch;
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (url.includes('/api/admin')) {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('admin_token');
    if (token) {
      init.headers = {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return _origFetch(input, init);
};

import React from 'react'
import ReactDOM from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
