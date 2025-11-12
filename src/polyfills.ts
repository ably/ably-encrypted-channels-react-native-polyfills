/**
 * Polyfills for React Native crypto functionality
 *
 * Provides Web Crypto API polyfills using react-native-aes-crypto:
 * - crypto.subtle.importKey
 * - crypto.subtle.encrypt (AES-CBC)
 * - crypto.subtle.decrypt (AES-CBC)
 * - Text encoding/decoding
 */
import { TextDecoder } from '@bacons/text-decoder';
import * as Aes from 'react-native-aes-crypto';

// Type definitions for Web Crypto API compatibility
type BufferSource = ArrayBuffer | ArrayBufferView;
type KeyUsage = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'deriveKey' | 'deriveBits' | 'wrapKey' | 'unwrapKey';
type AlgorithmIdentifier = string | { name: string; iv?: BufferSource };
interface CryptoKey {}

/**
 * Helper: Convert ArrayBuffer or Uint8Array to hex string
 */
function bufferToHex(buffer: BufferSource): string {
  const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer);
  return Array.from(uint8Array)
    .map((byte: number) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Helper: Convert hex string to ArrayBuffer
 */
export function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Helper: Convert base64 string to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Helper: Convert ArrayBuffer to base64 string
 */
function bufferToBase64(buffer: BufferSource): string {
  const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * CryptoKey implementation that wraps the key data
 */
class PolyfillCryptoKey implements CryptoKey {
  readonly type = 'secret';
  readonly extractable: boolean;
  readonly usages: KeyUsage[];
  readonly algorithm: { name: string };
  readonly keyData: ArrayBuffer;

  constructor(keyData: ArrayBuffer, algorithm: string, extractable: boolean, usages: KeyUsage[]) {
    this.keyData = keyData;
    this.algorithm = { name: algorithm.toLowerCase() };
    this.extractable = extractable;
    this.usages = usages;
  }
}

/**
 * Polyfilled crypto.subtle.importKey implementation
 */
async function importKey(
  format: string,
  keyData: BufferSource,
  algorithm: AlgorithmIdentifier,
  extractable: boolean,
  keyUsages: KeyUsage[],
): Promise<CryptoKey> {
  if (format !== 'raw') {
    throw new Error(`Unsupported key format: ${format}. Only 'raw' is supported.`);
  }

  const algorithmName =
    typeof algorithm === 'string' ? algorithm.toLowerCase() : algorithm.name.toLowerCase();

  if (!algorithmName.includes('aes')) {
    throw new Error(`Unsupported algorithm: ${algorithmName}. Only AES algorithms are supported.`);
  }

  const keyBuffer =
    keyData instanceof ArrayBuffer ? keyData : ArrayBuffer.isView(keyData) ? keyData.buffer : keyData;

  return new PolyfillCryptoKey(keyBuffer as ArrayBuffer, algorithmName, extractable, keyUsages);
}

/**
 * Polyfilled crypto.subtle.encrypt implementation
 */
async function encrypt(
  algorithm: AlgorithmIdentifier,
  key: CryptoKey,
  data: BufferSource,
): Promise<ArrayBuffer> {
  if (typeof algorithm === 'string') {
    throw new Error('Algorithm must be an object with name and iv properties');
  }

  const algorithmName = algorithm.name.toLowerCase();

  if (!algorithmName.includes('aes-cbc')) {
    throw new Error(`Unsupported algorithm: ${algorithmName}. Only AES-CBC is supported.`);
  }

  if (!(key instanceof PolyfillCryptoKey)) {
    throw new Error('Invalid CryptoKey');
  }

  if (!algorithm.iv) {
    throw new Error('IV is required for AES-CBC encryption');
  }

  const keyHex = bufferToHex(key.keyData);
  const ivHex = bufferToHex(algorithm.iv);
  const dataBase64 = bufferToBase64(data);

  // Determine AES mode based on key length
  const keyLength = new Uint8Array(key.keyData).length * 8;
  const aesMode = `aes-${keyLength}-cbc` as Aes.Algorithms;

  const cipherBase64 = await Aes.encrypt(dataBase64, keyHex, ivHex, aesMode);

  return base64ToBuffer(cipherBase64);
}

/**
 * Polyfilled crypto.subtle.decrypt implementation
 */
async function decrypt(
  algorithm: AlgorithmIdentifier,
  key: CryptoKey,
  data: BufferSource,
): Promise<ArrayBuffer> {
  if (typeof algorithm === 'string') {
    throw new Error('Algorithm must be an object with name and iv properties');
  }

  const algorithmName = algorithm.name.toLowerCase();

  if (!algorithmName.includes('aes-cbc')) {
    throw new Error(`Unsupported algorithm: ${algorithmName}. Only AES-CBC is supported.`);
  }

  if (!(key instanceof PolyfillCryptoKey)) {
    throw new Error('Invalid CryptoKey');
  }

  if (!algorithm.iv) {
    throw new Error('IV is required for AES-CBC decryption');
  }

  const keyHex = bufferToHex(key.keyData);
  const ivHex = bufferToHex(algorithm.iv);
  const dataBase64 = bufferToBase64(data);

  // Determine AES mode based on key length
  const keyLength = new Uint8Array(key.keyData).length * 8;
  const aesMode = `aes-${keyLength}-cbc` as Aes.Algorithms;

  const decryptedBase64 = await Aes.decrypt(dataBase64, keyHex, ivHex, aesMode);

  return base64ToBuffer(decryptedBase64);
}

/**
 * Initialize all necessary polyfills
 * Call this function at the entry point of your React Native application
 */
export function install(): void {
  if (typeof global === 'undefined') {
    throw new Error('global is not defined. This polyfill must be run in a React Native environment.');
  }

  const globalAny = global as any;

  // Initialize crypto object (handle cases where crypto is read-only)
  try {
    if (!globalAny.crypto) {
      globalAny.crypto = {};
    }
  } catch (e) {
    // crypto might be read-only in some environments (like Node.js)
    // In this case, we can still modify its properties
  }

  // Initialize subtle crypto
  if (!globalAny.crypto.subtle) {
    globalAny.crypto.subtle = {};
  }

  // Install the polyfilled methods
  globalAny.TextDecoder = globalAny.TextDecoder || TextDecoder;
  globalAny.crypto.subtle.importKey = importKey;
  globalAny.crypto.subtle.encrypt = encrypt;
  globalAny.crypto.subtle.decrypt = decrypt;
}
