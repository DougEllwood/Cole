// Human Connection Engine (Layer 2) — the person's bonds with OTHER humans,
// and routing toward them. Makes Promise One real and running.
// docs/architecture/engines/03-human-connection-engine.md

import type { HumanConnectionEngine } from '../../shared/contracts';
import type { ExchangeContext } from '../../shared/types';

// Cue -> the real person this is usually a conversation for.
const ROUTES: { cues: string[]; who: string }[] = [
  { cues: ['advisor', 'registration', 'which courses', 'drop a course', 'switch programs'], who: 'academic advisor' },
  { cues: ['roommate', 'my room', 'dorm', 'residence conflict'], who: 'residence advisor or your roommate directly' },
  { cues: ['mum', 'mom', 'dad', 'parents', 'my family', 'homesick'], who: 'family' },
  { cues: ['professor', 'my prof', 'the assignment', 'extension on'], who: 'professor' },
  { cues: ['friend', 'people here', 'making friends', 'belong'], who: 'someone you’ve been getting to know here' },
];

export class HumanConnectionEngineImpl implements HumanConnectionEngine {
  assess(ctx: ExchangeContext): { routeToHuman: boolean; suggestion?: string } {
    const m = ctx.message.toLowerCase();
    for (const route of ROUTES) {
      if (route.cues.some((c) => m.includes(c))) {
        return {
          routeToHuman: true,
          suggestion: `This sounds like a conversation to have with your ${route.who} — not just with me. Want to plan what you'd say?`,
        };
      }
    }
    return { routeToHuman: false };
  }
}
