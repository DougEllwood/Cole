// Event Store (kernel) — the durable backing for the append-only log. The log
// is the source of truth (ADR-0002); this is where that truth actually lives
// between runs. The port is small on purpose so the log stays storage-neutral:
// a file today, a real database later, without touching the log or any engine.

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { NavigatorEvent, PersonId } from '../shared/types';

export interface EventStore {
  load(): NavigatorEvent[];
  append(event: NavigatorEvent): void;
  erase(personId: PersonId): void; // the person's right to truly delete
}

// Default: no durability (in-memory only). Used when no store is supplied.
export class NullEventStore implements EventStore {
  load(): NavigatorEvent[] { return []; }
  append(): void { /* no-op */ }
  erase(): void { /* no-op */ }
}

// Durable: one JSON object per line (JSONL). append() is a real on-disk append,
// which is exactly the shape of an append-only log — the storage mirrors the
// architecture. Reads rebuild the in-memory log; projections rebuild from there.
export class FileEventStore implements EventStore {
  constructor(private path: string) {
    const dir = dirname(path);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  load(): NavigatorEvent[] {
    if (!existsSync(this.path)) return [];
    const text = readFileSync(this.path, 'utf8');
    return text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as NavigatorEvent)
      .sort((a, b) => a.seq - b.seq);
  }

  append(event: NavigatorEvent): void {
    appendFileSync(this.path, JSON.stringify(event) + '\n');
  }

  // True erasure — the person exercising ownership. Distinct from "forgetting" a
  // Moment inside the Story (which is an appended tombstone). Here the person's
  // events are physically removed and the file rewritten without them.
  erase(personId: PersonId): void {
    if (!existsSync(this.path)) return;
    const kept = this.load().filter((e) => e.personId !== personId);
    writeFileSync(this.path, kept.map((e) => JSON.stringify(e)).join('\n') + (kept.length ? '\n' : ''));
  }
}
