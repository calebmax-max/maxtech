// src/utils/api.js

const envApiBase = (process.env.REACT_APP_API_BASE_URL || '').trim();
const normalizedEnvApiBase = envApiBase.replace(/\/+$/, '');

export const API_BASE =
  normalizedEnvApiBase ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:5000');

export const buildApiUrl = (path) => {
  if (!path) {
    return API_BASE;
  }

  return API_BASE ? `${API_BASE}${path}` : path;
};
