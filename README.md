# Ably Encrypted Channels React Native Polyfills

A lightweight set of polyfills that enable Ably encrypted channels to work seamlessly in React Native environments.

## Prerequisites

### Option 1: Using the default AES implementation

If you want to use the default AES encryption/decryption implementation, install:

- `@ably/react-native-aes` - For AES encryption/decryption

```bash
npm install @ably/react-native-aes
```

or

```bash
yarn add @ably/react-native-aes
```

For React Native 0.60+, this dependency should auto-link. For older versions, you may need to link it manually.

### Option 2: Using a custom implementation

Alternatively, you can provide your own encryption/decryption functions. In this case, no additional dependencies are required. See the [Custom Encryption/Decryption](#custom-encryptiondecryption) section below for details.

## Installation

After installing the prerequisites, install this package:

```bash
npm install @ably/encrypted-channels-react-native-polyfills
```

or

```bash
yarn add @ably/encrypted-channels-react-native-polyfills
```

## Usage

Import and initialize the polyfills at the entry point of your React Native application:

```typescript
import { install } from '@ably/encrypted-channels-react-native-polyfills';

// Initialize polyfills before using Ably
install();
```

This will polyfill the following Web Crypto API methods:

- `crypto.subtle.importKey()` - Import raw AES keys
- `crypto.subtle.encrypt()` - Encrypt data using AES-CBC
- `crypto.subtle.decrypt()` - Decrypt data using AES-CBC

### Example with Ably

```typescript
import { install } from '@ably/encrypted-channels-react-native-polyfills';

// Install polyfills first
install();

function App() {
    const [encrypted, setEncrypted] = useState<string>("");
    const [key, setKey] = useState<Ably.CipherKey | null>(null);

    useEffect(() => {
        if (key) return;
        Ably.Realtime.Crypto.generateRandomKey().then(generatedKey => setKey(generatedKey))
    }, [key]);

    useEffect(() => {
        if (!key) return;
        const channel = client.channels.get('encrypted-channel', {
            cipher: { key }
        });
        channel.subscribe(message => {
            setEncrypted(message.data.toString())
        });
        channel.publish('test', "Hello World");
    }, [key]);
}
```

### Custom Encryption/Decryption

If you don't want to use `@ably/react-native-aes`, you can provide your own encryption and decryption implementations:

```typescript
import { install, type EncryptionFunction, type DecryptionFunction } from '@ably/encrypted-channels-react-native-polyfills';

const customEncrypt: EncryptionFunction = async (algorithm, key, data) => {
    // Your custom encryption implementation
    // algorithm: { name: string, iv: BufferSource }
    // key: BufferSource - the raw key data
    // data: BufferSource - the data to encrypt
    // Returns: Promise<ArrayBuffer> - the encrypted data

    // Example using a hypothetical crypto library
    const encrypted = await MyCryptoLib.encrypt({
        key: keyData,
        iv: algorithm.iv,
        data: data,
        algorithm: algorithm.name
    });

    return encrypted;
};

const customDecrypt: DecryptionFunction = async (algorithm, key, data) => {
    // Your custom decryption implementation
    // algorithm: { name: string, iv: BufferSource }
    // key: BufferSource - the raw key data
    // data: BufferSource - the encrypted data to decrypt
    // Returns: Promise<ArrayBuffer> - the decrypted data

    // Example using a hypothetical crypto library
    const decrypted = await MyCryptoLib.decrypt({
        key: keyData,
        iv: algorithm.iv,
        data: data,
        algorithm: algorithm.name
    });

    return decrypted;
};

// Install with custom functions
install({
    encryptionFunction: customEncrypt,
    decryptionFunction: customDecrypt
});
```

**Note:** Both `encryptionFunction` and `decryptionFunction` must be provided together. If you provide only one, an error will be thrown.