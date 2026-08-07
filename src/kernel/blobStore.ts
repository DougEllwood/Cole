// Blob Store (kernel) — durable storage for Story media (voice notes, and later
// photos). The architecture says media is kept as ENCRYPTED blobs, referenced
// from the log, never inline (docs/architecture/12-the-story-of-me.md §8;
// 20-privacy-architecture.md §4). This realizes that: content is encrypted at
// rest with AES-256-GCM, and the log holds only a small reference.
//
// The encryption helpers are shared so every backend (file, SQLite, …) protects
// bytes identically — the store only decides where the ciphertext lives.

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface Blob { bytes: Buffer; contentType: string; }

export interface BlobStore {
  put(bytes: Uint8Array, contentType: string): string; // returns an opaque ref
  get(ref: string): Blob | undefined;
  delete(ref: string): void;
}

// ---- shared AES-256-GCM helpers (used by every backend) ----
export interface EncryptedBlob { contentType: string; iv: Buffer; tag: Buffer; data: Buffer; }

export function newBlobRef(): string { return `vn_${randomUUID()}`; }

export function encryptBlob(key: Buffer, bytes: Uint8Array, contentType: string): EncryptedBlob {
  if (key.length !== 32) throw new Error('BlobStore key must be 32 bytes (AES-256).');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(Buffer.from(bytes)), cipher.final()]);
  return { contentType, iv, tag: cipher.getAuthTag(), data };
}

export function decryptBlob(key: Buffer, rec: { iv: Buffer; tag: Buffer; data: Buffer }): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, rec.iv);
  decipher.setAuthTag(rec.tag);
  return Buffer.concat([decipher.update(rec.data), decipher.final()]);
}

// ---- default: in-memory (tests, and when no durable store is supplied) ----
export class InMemoryBlobStore implements BlobStore {
  private map = new Map<string, Blob>();
  put(bytes: Uint8Array, contentType: string): string {
    const ref = newBlobRef();
    this.map.set(ref, { bytes: Buffer.from(bytes), contentType });
    return ref;
  }
  get(ref: string): Blob | undefined { return this.map.get(ref); }
  delete(ref: string): void { this.map.delete(ref); }
}

// ---- durable: one encrypted file per blob. Never plaintext on disk. ----
export class FileBlobStore implements BlobStore {
  constructor(private dir: string, private key: Buffer) {
    if (key.length !== 32) throw new Error('BlobStore key must be 32 bytes (AES-256).');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  private path(ref: string) { return join(this.dir, ref.replace(/[^a-z0-9_-]/gi, '') + '.blob'); }

  put(bytes: Uint8Array, contentType: string): string {
    const ref = newBlobRef();
    const enc = encryptBlob(this.key, bytes, contentType);
    writeFileSync(this.path(ref), JSON.stringify({
      contentType, iv: enc.iv.toString('base64'), tag: enc.tag.toString('base64'), data: enc.data.toString('base64'),
    }));
    return ref;
  }

  get(ref: string): Blob | undefined {
    const p = this.path(ref);
    if (!existsSync(p)) return undefined;
    const rec = JSON.parse(readFileSync(p, 'utf8'));
    const bytes = decryptBlob(this.key, {
      iv: Buffer.from(rec.iv, 'base64'), tag: Buffer.from(rec.tag, 'base64'), data: Buffer.from(rec.data, 'base64'),
    });
    return { bytes, contentType: rec.contentType };
  }

  delete(ref: string): void {
    const p = this.path(ref);
    if (existsSync(p)) rmSync(p);
  }
}

// Load a persistent encryption key, or create one on first run. In production
// this is where a per-person envelope / KMS-managed key belongs; here it is a
// single durable dev key so encryption is real and survives restarts.
export function loadOrCreateKey(path: string): Buffer {
  const fromEnv = process.env.NAVIGATOR_BLOB_KEY;
  if (fromEnv && fromEnv.length === 64) return Buffer.from(fromEnv, 'hex');
  if (existsSync(path)) return Buffer.from(readFileSync(path, 'utf8').trim(), 'hex');
  const key = randomBytes(32);
  const dir = dirname(path);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, key.toString('hex'));
  return key;
}
