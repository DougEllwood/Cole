// Ethics Engine (Layer 2, GOVERNOR) — the final gate with HARD VETO. Crisis
// routing (care-first, no interrogation), per-Navigator scope, dignity, and
// anti-manipulation. Every non-allow verdict is logged for accountability.
// docs/architecture/engines/07-ethics-engine.md

import type { EthicsEngine } from '../../shared/contracts';
import type { Draft, ExchangeContext, NavigatorId, Verdict } from '../../shared/types';
import { EventLog } from '../../kernel/eventLog';
import { ScopeRegistry } from '../../kernel/scopeRegistry';

const CRISIS = [
  'kill myself', 'suicide', 'end my life', 'want to die', 'hurt myself',
  'self-harm', 'self harm', 'no reason to live', "can't go on",
];

// Care-first response: warm, honest about its limits, routes to a real human,
// no safety-assessment interrogation, no diagnosis. (Aligns with the wellbeing
// standard in the Constitution.)
const CARE_TEXT =
  "I'm really glad you told me this, and I don't want you to be alone with it. " +
  "I care about you, and I'm not the right kind of help on my own for something this heavy. " +
  "Please reach out to someone you trust, or a trained person who can be with you right now. " +
  "If you're in immediate danger, contact your local emergency services. " +
  "Would it help if we thought together about one person you could reach out to today?";

export class EthicsEngineImpl implements EthicsEngine {
  // Scope is config-driven: each vertical registers its own boundaries.
  constructor(private log: EventLog, private scope: ScopeRegistry) {}

  outOfScope(message: string, navigatorId: NavigatorId): string | undefined {
    return this.scope.outOfScope(message, navigatorId);
  }

  gate(draft: Draft, ctx: ExchangeContext): Verdict {
    const m = ctx.message.toLowerCase();

    // 1. Crisis — the highest priority. Replace the completion with care.
    if (CRISIS.some((c) => m.includes(c))) {
      this.record(ctx, 'Escalate', 'crisis signal — routed to human help');
      return { kind: 'Escalate', text: CARE_TEXT, why: 'crisis signal — routed to human help' };
    }

    // 2. Scope — decline honestly what this Navigator must not do.
    const boundary = this.outOfScope(ctx.message, ctx.navigatorId);
    if (boundary) {
      this.record(ctx, 'Modify', 'out of scope for this Navigator');
      return { kind: 'Modify', text: boundary, why: 'out of scope for this Navigator' };
    }

    // 3. Dignity / anti-manipulation — never let delivery manipulate.
    if (/\b(hurry|act now|you'll regret)\b/i.test(draft.text)) {
      this.record(ctx, 'Modify', 'removed manipulative pressure');
      return { kind: 'Modify', text: draft.text.replace(/\b(hurry|act now|you'll regret)\b/gi, '').trim(), why: 'removed manipulative pressure' };
    }

    return { kind: 'Allow' };
  }

  private record(ctx: ExchangeContext, verdict: string, why: string): void {
    this.log.append(ctx.personId, ctx.navigatorId, 'ethics.decision', { verdict, why, message: ctx.message });
  }
}
