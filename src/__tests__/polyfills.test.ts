import { describe, it, expect, beforeAll, vi } from 'vitest';
import { install, hexToBuffer } from '../polyfills';

// Mock the react-native-aes-crypto module
vi.mock('react-native-aes-crypto', () => ({
  encrypt: vi.fn((data: string, key: string, iv: string, _algorithm: string) => {
    // Simple mock: return base64 of the input for testing
    return Promise.resolve(btoa(`encrypted:${data}:${key}:${iv}`));
  }),
  decrypt: vi.fn((data: string, key: string, iv: string, _algorithm: string) => {
    // Simple mock: extract the original data from our mock format
    const decoded = atob(data);
    const match = decoded.match(/^encrypted:(.+?):/);
    return Promise.resolve(match ? match[1] : data);
  }),
}));

describe('Crypto Polyfills', () => {
  beforeAll(() => {
    // Install the polyfills
    install();
  });

  describe('install', () => {
    it('should install crypto.subtle.importKey', () => {
      expect(typeof global.crypto.subtle.importKey).toBe('function');
    });

    it('should install crypto.subtle.encrypt', () => {
      expect(typeof global.crypto.subtle.encrypt).toBe('function');
    });

    it('should install crypto.subtle.decrypt', () => {
      expect(typeof global.crypto.subtle.decrypt).toBe('function');
    });
  });

  describe('crypto.subtle.importKey', () => {
    it('should import a raw AES key', async () => {
      const keyData = new Uint8Array(32); // 256-bit key
      for (let i = 0; i < keyData.length; i++) {
        keyData[i] = i;
      }

      const key = await crypto.subtle.importKey('raw', keyData, 'AES-CBC', false, ['encrypt', 'decrypt']);

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.extractable).toBe(false);
      expect(key.usages).toEqual(['encrypt', 'decrypt']);
    });

    it('should throw error for unsupported key format', async () => {
      const keyData = new Uint8Array(32);

      await expect(crypto.subtle.importKey('pkcs8', keyData, 'AES-CBC', false, ['encrypt'])).rejects.toThrow(
        'Unsupported key format',
      );
    });

    it('should throw error for non-AES algorithm', async () => {
      const keyData = new Uint8Array(32);

      await expect(crypto.subtle.importKey('raw', keyData, 'RSA', false, ['encrypt'])).rejects.toThrow(
        'Only AES algorithms are supported',
      );
    });
  });

  describe('crypto.subtle.encrypt', () => {
    it('should encrypt data using AES-CBC', async () => {
      const keyData = new Uint8Array(32);
      const iv = new Uint8Array(16);
      const plaintext = new TextEncoder().encode('Hello, World!');

      const key = await crypto.subtle.importKey('raw', keyData, 'AES-CBC', false, ['encrypt']);
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plaintext);

      expect(ciphertext).toBeInstanceOf(ArrayBuffer);
      expect(ciphertext.byteLength).toBeGreaterThan(0);
    });

    it('should throw error if IV is missing', async () => {
      const keyData = new Uint8Array(32);
      const plaintext = new Uint8Array(16);

      const key = await crypto.subtle.importKey('raw', keyData, 'AES-CBC', false, ['encrypt']);

      await expect(crypto.subtle.encrypt({ name: 'AES-CBC' } as any, key, plaintext)).rejects.toThrow('IV is required');
    });
  });

  describe('crypto.subtle.decrypt', () => {
    it('should decrypt data using AES-CBC', async () => {
      const keyData = new Uint8Array(32);
      const iv = new Uint8Array(16);
      const plaintext = new TextEncoder().encode('Hello, World!');

      const key = await crypto.subtle.importKey('raw', keyData, 'AES-CBC', false, ['encrypt', 'decrypt']);

      // Encrypt first
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, plaintext);

      // Then decrypt
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);

      expect(decrypted).toBeInstanceOf(ArrayBuffer);
      expect(decrypted.byteLength).toBeGreaterThan(0);
    });

    it('should throw error if IV is missing', async () => {
      const keyData = new Uint8Array(32);
      const ciphertext = new Uint8Array(16);

      const key = await crypto.subtle.importKey('raw', keyData, 'AES-CBC', false, ['decrypt']);

      await expect(crypto.subtle.decrypt({ name: 'AES-CBC' } as any, key, ciphertext)).rejects.toThrow(
        'IV is required',
      );
    });
  });

  describe('hexToBuffer helper', () => {
    it('should convert hex string to ArrayBuffer', () => {
      const hex = '48656c6c6f'; // "Hello" in hex
      const buffer = hexToBuffer(hex);
      const view = new Uint8Array(buffer);

      expect(view[0]).toBe(0x48); // 'H'
      expect(view[1]).toBe(0x65); // 'e'
      expect(view[2]).toBe(0x6c); // 'l'
      expect(view[3]).toBe(0x6c); // 'l'
      expect(view[4]).toBe(0x6f); // 'o'
    });
  });
});
