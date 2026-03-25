// src/utils/api.js

export const API_BASE = "https://calebtonny.alwaysdata.net";

export const buildApiUrl = (path) => {
  return `${API_BASE}${path}`;
};