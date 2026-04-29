/**
 * Type declaration override for @stricahq/bip32ed25519
 * The library's TypeScript definitions are incorrect - derivePath returns Bip32PrivateKey, not string
 */

declare module '@stricahq/bip32ed25519' {
  import { Buffer } from 'buffer';

  class Bip32PublicKey {
    toBytes(): Buffer;
  }

  class PrivateKey {
    toBytes(): Buffer;
    sign(message: Buffer): Buffer;
  }

  class PublicKey {
    pubKey: Buffer;
    constructor(pubKey: Buffer);
    toBytes(): Buffer;
    hash(): Buffer;
    verify(signature: Buffer, data: Buffer): any;
  }

  class Bip32PrivateKey {
    constructor(xprv: Buffer);
    static fromEntropy(entropy: Buffer): Promise<Bip32PrivateKey>;
    derive(index: number): Bip32PrivateKey;
    deriveHardened(index: number): Bip32PrivateKey;
    derivePath(path: string): Bip32PrivateKey; // ✅ CORRECTED: Returns Bip32PrivateKey, not string
    toBip32PublicKey(): Bip32PublicKey;
    toBytes(): Buffer;
    toPrivateKey(): PrivateKey;
  }

  export default Bip32PrivateKey;
  export { Bip32PublicKey, PrivateKey, PublicKey };
}