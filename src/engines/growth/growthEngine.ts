// Growth Engine (Layer 2, GOVERNOR) — steers toward confidence over dependence.
// Its success metric is the person needing the companion LESS. It never
// optimises engagement. docs/architecture/engines/05-growth-engine.md

import type { GrowthEngine } from '../../shared/contracts';
import type { Draft, ExchangeContext, Moment, NavigatorId, PersonId } from '../../shared/types';

const STOP = new Set(['the', 'and', 'was', 'were', 'that', 'this', 'with', 'like', 'feel', 'felt', 'here', 'have', 'about', 'when', 'first', 'really', 'just', 'from', 'they', 'them', 'your', 'mine']);

export class GrowthEngineImpl implements GrowthEngine {
  private requests = new Map<string, number>();
  private nudged = new Set<string>();
  private readonly RELIANCE_THRESHOLD = 4;

  private key(p: PersonId, n: NavigatorId) { return `${p}|${n}`; }

  noteRequest(personId: PersonId, navigatorId: NavigatorId): void {
    const k = this.key(personId, navigatorId);
    this.requests.set(k, (this.requests.get(k) ?? 0) + 1);
  }

  reshape(draft: Draft, ctx: ExchangeContext): Draft {
    const notes = [...draft.notes];
    let text = draft.text;

    // Hand the thinking back: invite the person's own attempt before ours.
    if (draft.intent === 'answer' && !notes.includes('teaching:socratic')) {
      text += ` Though let's be real, you already know what you wanna do.`;
      notes.push('growth:invited the person to try first');
    }

    // If reliance is running high, widen the circle beyond the companion — but
    // say it ONCE, and keep it in character (a mate telling him to go live it).
    const rk = this.key(ctx.personId, ctx.navigatorId);
    const count = this.requests.get(rk) ?? 0;
    if (count >= this.RELIANCE_THRESHOLD && !this.nudged.has(rk)) {
      this.nudged.add(rk);
      text += ` (Also — go talk to a real human out there, man. I'm flattered but c'mon.)`;
      notes.push('growth:noticed heavy reliance — encouraged real-world support');
    }

    return { ...draft, text, notes };
  }

  // Connect-the-Moments — reflection in service of growth/gratitude, NEVER a metric.
  connectMoments(moments: Moment[]): string | undefined {
    const counts = new Map<string, number>();
    for (const m of moments) {
      const text = `${m.reflection ?? ''} ${m.whyItMattered} ${m.whatILearned ?? ''}`.toLowerCase();
      const uniq = new Set(text.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
      for (const w of uniq) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestN = 1;
    for (const [w, n] of counts) if (n > bestN) { best = w; bestN = n; }
    if (!best) return undefined;
    return `I've noticed something — several of your Moments keep coming back to "${best}". Would you like to make a little more room for that?`;
  }
}
