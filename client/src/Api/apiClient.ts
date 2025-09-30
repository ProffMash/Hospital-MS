import axios from 'axios';

// const API_BASE = 'https://hospital-ms-9mt5.onrender.com/api/';
const API_BASE = 'http://localhost:8000/api/';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// If a token was persisted by the auth store, attach it
try {
  const raw = localStorage.getItem('auth-storage');
  if (raw) {
    const parsed = JSON.parse(raw);
    const token = parsed?.state?.token || parsed?.token || null;
    if (token) {
      api.defaults.headers.common['Authorization'] = `Token ${token}`; // DRF TokenAuthentication uses 'Token <key>'
    }
  }
} catch (e) {
  // ignore JSON parse errors
}

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Token ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export default api;
