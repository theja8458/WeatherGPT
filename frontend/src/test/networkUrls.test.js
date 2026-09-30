import { describe, it, expect } from 'vitest';
import { API_BASE_URL } from '../services/api';
import { getWebSocketUrl } from '../services/alertSocket';

describe('Production & Local Network URL Configuration', () => {
  it('correctly exports a valid API base URL without trailing slash', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(API_BASE_URL.endsWith('/')).toBe(false);
  });

  it('converts HTTP localhost to WS localhost for local development', () => {
    const wsLocal = getWebSocketUrl('http://localhost:8000');
    expect(wsLocal).toBe('ws://localhost:8000/ws/alerts');

    const wsLocalSlash = getWebSocketUrl('http://localhost:8000/');
    expect(wsLocalSlash).toBe('ws://localhost:8000/ws/alerts');
  });

  it('converts HTTPS Render backend to WSS Render backend for production', () => {
    const wsProd = getWebSocketUrl('https://weathergpt-backend-tm6r.onrender.com');
    expect(wsProd).toBe('wss://weathergpt-backend-tm6r.onrender.com/ws/alerts');

    const wsProdSlash = getWebSocketUrl('https://weathergpt-backend-tm6r.onrender.com/');
    expect(wsProdSlash).toBe('wss://weathergpt-backend-tm6r.onrender.com/ws/alerts');
  });

  it('never uses Vercel frontend host or port 8000 on Vercel domain', () => {
    const wsUrl = getWebSocketUrl('https://weathergpt-backend-tm6r.onrender.com');
    expect(wsUrl).not.toContain('vercel.app');
    expect(wsUrl).not.toContain(':8000');
    expect(wsUrl.startsWith('wss://')).toBe(true);
  });
});
