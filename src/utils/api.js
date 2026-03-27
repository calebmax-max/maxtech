// src/utils/api.js

const rawEnvApiBase = (
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  ''
).trim();
const envApiBase = rawEnvApiBase && !/^https?:\/\//i.test(rawEnvApiBase)
  ? `https://${rawEnvApiBase}`
  : rawEnvApiBase;
const normalizedEnvApiBase = envApiBase.replace(/\/+$/, '');

const isLocalHostname = (hostname = '') =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '0.0.0.0';

const shouldIgnoreEnvApiBase = () => {
  if (!normalizedEnvApiBase || process.env.NODE_ENV !== 'production') {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedEnvApiBase);
    const currentHostname =
      typeof window !== 'undefined' ? window.location.hostname : '';

    return isLocalHostname(parsedUrl.hostname) && !isLocalHostname(currentHostname);
  } catch (error) {
    return false;
  }
};

const safeEnvApiBase = shouldIgnoreEnvApiBase() ? '' : normalizedEnvApiBase;

export const API_BASE =
  safeEnvApiBase ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:5000');

export const buildApiUrl = (path) => {
  if (!path) {
    return API_BASE;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!API_BASE) {
    return normalizedPath;
  }

  if (API_BASE.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${API_BASE}${normalizedPath.slice(4)}`;
  }

  return `${API_BASE}${normalizedPath}`;
};
