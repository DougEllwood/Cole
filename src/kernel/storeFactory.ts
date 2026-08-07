// Store factory (kernel) — chooses the durable backend by environment, behind
// the EventStore / BlobStore ports. Flat files are the default (zero setup);
// set NAVIGATOR_DB=<path> to use the built-in SQLite database instead. Nothing
// above the kernel knows or cares which is in use. (ADR-0004)

import { join } from 'node:path';
import { FileEventStore, type EventStore } from './eventStore';
import { FileBlobStore, loadOrCreateKey, type BlobStore } from './blobStore';

export interface Stores { events: EventStore; blobs: BlobStore; backend: string; }

export async function buildStores(dataDir: string): Promise<Stores> {
  const key = loadOrCreateKey(join(dataDir, '.blobkey'));
  const dbPath = process.env.NAVIGATOR_DB;

  if (dbPath) {
    // Loaded only when SQLite is actually selected, so the file default never
    // pulls in the SQLite module.
    const { openDatabase, SqliteEventStore, SqliteBlobStore } = await import('./sqliteStore');
    const db = openDatabase(dbPath);
    return {
      events: new SqliteEventStore(db),
      blobs: new SqliteBlobStore(db, key),
      backend: `sqlite (${dbPath})`,
    };
  }

  return {
    events: new FileEventStore(join(dataDir, 'kane.jsonl')),
    blobs: new FileBlobStore(join(dataDir, 'blobs'), key),
    backend: 'files (JSONL + encrypted blobs)',
  };
}
