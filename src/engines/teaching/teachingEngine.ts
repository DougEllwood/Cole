// Teaching Engine (Layer 2) — pedagogy: teach how to think. It may turn an
// answer into a question-first reply — but it knows when to just help.
// docs/architecture/engines/06-teaching-engine.md

import type { TeachingEngine } from '../../shared/contracts';
import type { Draft, ExchangeContext } from '../../shared/types';

// Openings that invite the person's own reasoning rather than a lookup.
const INVITES_THINKING = ['should i', 'what do you think', 'how do i', 'do you think i', 'what would you do'];
// Moments to simply help — urgency or plain facts. Teaching does not obstruct.
const JUST_HELP = ['quick', 'deadline', 'right now', 'when is', 'where is', 'what time', 'how many'];

export class TeachingEngineImpl implements TeachingEngine {
  shape(draft: Draft, ctx: ExchangeContext): Draft {
    const m = ctx.message.toLowerCase();
    const justHelp = JUST_HELP.some((k) => m.includes(k));
    const invites = INVITES_THINKING.some((k) => m.includes(k));

    if (draft.intent === 'answer' && invites && !justHelp) {
      // Lead with a question so the person builds the reasoning themselves.
      return {
        ...draft,
        text: `Wait — what's your gut say first? ${draft.text}`,
        notes: [...draft.notes, 'teaching:socratic'],
      };
    }
    return draft;
  }
}
