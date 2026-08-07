// Relationship Engine (Layer 2) — the bond between the person and THEIR
// companion: continuity, and healthy limits. It never simulates romance and
// never makes itself indispensable. docs/architecture/engines/02-relationship-engine.md

import type { RelationshipEngine } from '../../shared/contracts';
import type { NavigatorId, PersonId } from '../../shared/types';
import { EventLog } from '../../kernel/eventLog';

const SUBSTITUTE_SIGNALS = [
  "you're my only", 'only friend', "don't need anyone", 'no one else', 'nobody else',
  'rather talk to you than',
];

export class RelationshipEngineImpl implements RelationshipEngine {
  constructor(private log: EventLog) {}

  contextFor(personId: PersonId, navigatorId: NavigatorId): { lastInteractionSummary?: string } {
    const interactions = this.log
      .scoped(personId, navigatorId)
      .filter((e) => e.type === 'interaction.summary');
    const last = interactions[interactions.length - 1];
    return { lastInteractionSummary: last ? String(last.payload.summary) : undefined };
  }

  // Healthy limits: recognise when the companion is being leaned on as a
  // replacement for real people, so the orchestrator can defer to Human Connection.
  shouldDefer(message: string): boolean {
    const m = message.toLowerCase();
    return SUBSTITUTE_SIGNALS.some((s) => m.includes(s));
  }
}
