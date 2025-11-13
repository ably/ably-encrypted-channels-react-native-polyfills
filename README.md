# Ably Encrypted Channels React Native Polyfills

A lightweight set of polyfills that enable Ably encrypted channels to work seamlessly in React Native environments.

## Prerequisites

This library requires the following peer dependencies to be installed in your React Native project:

- `@ably/react-native-aes` - For AES encryption/decryption

Install them first:

```bash
npm install @ably/react-native-aes
```

or

```bash
yarn add @ably/react-native-aes
```

For React Native 0.60+, these dependencies should auto-link. For older versions, you may need to link them manually.

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

### Example

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