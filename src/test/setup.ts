import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const authResponse = () => Response.json({ authenticated: true, userName: 'test-user' });

Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: vi.fn(async () => authResponse()),
});

