const axios = require('axios');

const api = axios.create({
  baseURL: process.env.BACKEND_URL || process.env.BACKEND_ORIGIN || 'http://localhost:3000',
  withCredentials: true,
  timeout: 15000,
});

module.exports = api;
