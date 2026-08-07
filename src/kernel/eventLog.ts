// The append-only event log — the SOURCE OF TRUTH for all Memory. (ADR-0002)
// It has no update or delete: the only write is append. "Forgetting" is itself
// an appended event that projections honour. Everything else in Memory is a
// rebuildable projection of this log.

import type { EventType, NavigatorEvent, NavigatorId, PersonId } from '../shared/types';
import { NullEventStore, type EventStore } from './eventStore';

export type Clock = () => string; // returns ISO timestamp

export class EventLog {
  private events: NavigatorEvent[] = [];
  private nextSeq = 1;
  private clock: Clock;
  private store: EventStore;

  constructor(clock?: Clock, store?: EventStore) {
    this.clock = clock ?? (() => new Date().toISOString());
    this.store = store ?? new NullEventStore();
    // Rebuild the in-memory log from durable storage — the log is the source of
    // truth, and it survives restarts. (ADR-0002)
    const loaded = this.store.load();
    if (loaded.length) {
      this.events = loaded.map((e) => Object.freeze({ ...e, payload: { ...e.payload } }));
      this.nextSeq = loaded.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
    }
  }

  append(
    personId: PersonId,
    navigatorId: NavigatorId,
    type: EventType,
    payload: Record<string, unknown>,
    occurredOn?: string,
  ): NavigatorEvent {
    const seq = this.nextSeq++;
    const now = this.clock();
    const event: NavigatorEvent = {
      eventId: `evt_${seq}`,
      personId,
      navigatorId,
      type,
      payload,
      occurredOn: occurredOn ?? now.slice(0, 10),
      recordedAt: now,
      seq,
    };
    // Store a frozen copy so callers can never mutate the source of truth.
    const stored = Object.freeze({ ...event, payload: { ...payload } });
    this.events.push(stored);
    this.store.append(stored); // durably persist the append
    return event;
  }

  // The person exercising true ownership: erase their entire record. This is a
  // genuine deletion (unlike forgetting a Moment, which appends a tombstone).
  erasePerson(personId: PersonId): void {
    this.events = this.events.filter((e) => e.personId !== personId);
    this.store.erase(personId);
  }

  // Read APIs return deep-enough COPIES — the log is immutable to the outside world.
  all(personId: PersonId): NavigatorEvent[] {
    return this.events.filter((e) => e.personId === personId).map(copy);
  }

  scoped(personId: PersonId, navigatorId: NavigatorId): NavigatorEvent[] {
    return this.events
      .filter((e) => e.personId === personId && e.navigatorId === navigatorId)
      .map(copy);
  }

  size(): number {
    return this.events.length;
  }

  // Admin-scoped iterator (copies only). Used by log-wide operations such as
  // resolving a Moment's owner when forgetting. Not a person-facing read path.
  everything(): NavigatorEvent[] {
    return this.events.map(copy);
  }
}

// Returns a copy whose payload is a fresh object, so a caller mutating a read
// result can never reach back into the source of truth.
function copy(e: NavigatorEvent): NavigatorEvent {
  return { ...e, payload: { ...e.payload } };
}
