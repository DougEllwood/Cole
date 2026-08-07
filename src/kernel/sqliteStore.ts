// SQLite backends (kernel) — a REAL embedded database behind the same ports the
// flat-file stores implement, using Node's built-in `node:sqlite` (no external
// dependency). This is the proof the port abstraction pays off: swapping durable
// storage touches nothing above the kernel — not a single engine, orchestrator,
// or Navigator. (ADR-0004)
//
// Both stores can share one database handle/file: events in one table, encrypted
// blobs in another.

import { DatabaseSync } from 'node:sqlite';
import type { NavigatorEvent, PersonId } from '../shared/types';
import type { EventStore } from './eventStore';
import { type Blob, type BlobStore, encryptBlob, decryptBlob, newBlobRef } from './blobStore';

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export class SqliteEventStore implements EventStore {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY,
      eventId TEXT NOT NULL,
      personId TEXT NOT NULL,
      navigatorId TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      occurredOn TEXT NOT NULL,
      recordedAt TEXT NOT NULL
    );`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_events_person ON events(personId, seq);');
  }

  load(): NavigatorEvent[] {
    const rows = this.db.prepare('SELECT * FROM events ORDER BY seq ASC').all() as any[];
    return rows.map((r) => ({
      eventId: r.eventId, personId: r.personId, navigatorId: r.navigatorId,
      type: r.type, payload: JSON.parse(r.payload), occurredOn: r.occurredOn,
      recordedAt: r.recordedAt, seq: r.seq,
    }));
  }

  append(e: NavigatorEvent): void {
    this.db.prepare(
      'INSERT INTO events (seq, eventId, personId, navigatorId, type, payload, occurredOn, recordedAt) VALUES (?,?,?,?,?,?,?,?)',
    ).run(e.seq, e.eventId, e.personId, e.navigatorId, e.type, JSON.stringify(e.payload), e.occurredOn, e.recordedAt);
  }

  erase(personId: PersonId): void {
    this.db.prepare('DELETE FROM events WHERE personId = ?').run(personId);
  }
}

export class SqliteBlobStore implements BlobStore {
  constructor(private db: DatabaseSync, private key: Buffer) {
    db.exec(`CREATE TABLE IF NOT EXISTS blobs (
      ref TEXT PRIMARY KEY,
      contentType TEXT NOT NULL,
      iv BLOB NOT NULL,
      tag BLOB NOT NULL,
      data BLOB NOT NULL
    );`);
  }

  put(bytes: Uint8Array, contentType: string): string {
    const ref = newBlobRef();
    const enc = encryptBlob(this.key, bytes, contentType);
    this.db.prepare('INSERT INTO blobs (ref, contentType, iv, tag, data) VALUES (?,?,?,?,?)')
      .run(ref, contentType, enc.iv, enc.tag, enc.data);
    return ref;
  }

  get(ref: string): Blob | undefined {
    const r = this.db.prepare('SELECT * FROM blobs WHERE ref = ?').get(ref) as any;
    if (!r) return undefined;
    const bytes = decryptBlob(this.key, {
      iv: Buffer.from(r.iv), tag: Buffer.from(r.tag), data: Buffer.from(r.data),
    });
    return { bytes, contentType: r.contentType };
  }

  delete(ref: string): void {
    this.db.prepare('DELETE FROM blobs WHERE ref = ?').run(ref);
  }
}
