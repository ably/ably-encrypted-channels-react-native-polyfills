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
import { NativeModules } from 'react-native';

// Type definitions for Web Crypto API compatibility
type BufferSource = ArrayBuffer | ArrayBufferView;
interface CryptoKey {}

export type Algorithm = { name: string; iv: BufferSource };
export type EncryptionFunction = (algorithm: Algorithm, data: BufferSource, key: CryptoKey) => Promise<ArrayBuffer>;
export type DecryptionFunction = (algorithm: Algorithm, data: BufferSource, key: CryptoKey) => Promise<ArrayBuffer>;
export interface InstallOptions {
    encryptionFunction?: EncryptionFunction,
    decryptionFunction?: DecryptionFunction
}

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
  readonly keyData: ArrayBuffer;

  constructor(keyData: ArrayBuffer) {
    this.keyData = keyData;
  }
}

/**
 * Polyfilled crypto.subtle.importKey implementation
 */
async function importKey(
  format: string,
  keyData: BufferSource,
  algorithm: Algorithm | string,
  // extractable: boolean,
  // keyUsages: KeyUsage[],
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

  return new PolyfillCryptoKey(keyBuffer as ArrayBuffer);
}

/**
 * Polyfilled crypto.subtle.encrypt implementation
 */
async function encrypt(
  algorithm: Algorithm | string,
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
  const aesMode = `aes-${keyLength}-cbc`;

  const cipherBase64 = await NativeModules.Aes.encrypt(dataBase64, keyHex, ivHex, aesMode);

  return base64ToBuffer(cipherBase64);
}

/**
 * Polyfilled crypto.subtle.decrypt implementation
 */
async function decrypt(
  algorithm: Algorithm | string,
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

  const aesMode = `aes-${keyLength}-cbc`;

  const decryptedBase64 = await NativeModules.Aes.decrypt(dataBase64, keyHex, ivHex, aesMode);

  return base64ToBuffer(decryptedBase64);
}

async function buildCustomEncryption(encryptionFunction: EncryptionFunction) {
    return (
        algorithm: Algorithm,
        key: CryptoKey,
        data: BufferSource,
    ): Promise<ArrayBuffer> => {
        if (!(key instanceof PolyfillCryptoKey)) {
            throw new Error('Invalid CryptoKey');
        }
        return encryptionFunction(algorithm, key.keyData, data);
    }
}

async function buildCustomDecryption(decryptionFunction: DecryptionFunction) {
    return (
        algorithm: Algorithm,
        key: CryptoKey,
        data: BufferSource,
    ): Promise<ArrayBuffer> => {
        if (!(key instanceof PolyfillCryptoKey)) {
            throw new Error('Invalid CryptoKey');
        }
        return decryptionFunction(algorithm, key.keyData, data);
    }
}

/**
 * Initialize all necessary polyfills
 * Call this function at the entry point of your React Native application
 */
export function install(options: InstallOptions = {}): void {
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

    if (options.encryptionFunction && options.decryptionFunction) {
        globalAny.crypto.subtle.encrypt = buildCustomEncryption(options.encryptionFunction);
        globalAny.crypto.subtle.decrypt = buildCustomDecryption(options.decryptionFunction);
    } else if (options.encryptionFunction || options.decryptionFunction) {
        throw new Error('Both encryptionFunction and decryptionFunction must be provided to use custom Aes implementation');
    } else if (NativeModules.Aes) {
        globalAny.crypto.subtle.encrypt = encrypt;
        globalAny.crypto.subtle.decrypt = decrypt;
    } else {
        throw new Error('No Aes module found. Please ensure @ably/react-native-aes is installed and linked correctly or custom encryption/decryption functions are provided.');
    }
}

