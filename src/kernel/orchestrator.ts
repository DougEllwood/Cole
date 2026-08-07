// The Orchestrator (kernel) — routes one exchange through the engines and the
// two governors. It depends ONLY on engine *interfaces* (injected), never on
// engine implementations, so the kernel never imports upward. This dependency
// inversion is what lets the modular monolith keep its clean boundaries.
// Flow mirrors docs/architecture/00-navigator-os-architecture.md §4.

import type { EngineSet } from '../shared/contracts';
import type {
  CompanionReply, Draft, ExchangeContext, NavigatorId, Persona, PersonId,
} from '../shared/types';
import type { PrivacyLayer } from './privacy';

export class Orchestrator {
  constructor(private engines: EngineSet, private privacy: PrivacyLayer) {}

  async handle(
    personId: PersonId,
    navigatorId: NavigatorId,
    message: string,
    persona: Persona,
  ): Promise<CompanionReply> {
    const E = this.engines;
    const notes: string[] = [];

    // 1. Relationship: continuity of the bond.
    const rel = E.relationship.contextFor(personId, navigatorId);
    if (rel.lastInteractionSummary) notes.push(`relationship: recalled the bond`);

    // 2. Growth governor notes the request (a dependence signal).
    E.growth.noteRequest(personId, navigatorId);

    // 3. Privacy establishes scope; 4. recall within it; 5. project the Blueprint.
    const crossContext = this.privacy.allowsCrossContext(personId, navigatorId);
    const recalled = E.memory.recall(personId, navigatorId, message, crossContext);
    const blueprint = E.memory.projectBlueprint(personId, navigatorId);
    if (recalled.length) notes.push(`memory: recalled ${recalled.length} relevant item(s)${crossContext ? ' (cross-context consented)' : ''}`);

    const ctx: ExchangeContext = {
      personId, navigatorId, message, persona, blueprint,
      recalled, lastInteractionSummary: rel.lastInteractionSummary,
      scopeGrantsCrossContext: crossContext,
    };

    // 6. Draft via the model-neutral gateway.
    const question = message.includes('?');
    const task = question ? 'draft.answer' : 'draft.reflect';
    const prompt = this.buildPrompt(ctx, task);
    const base = await E.gateway.generate(prompt, task);
    let draft: Draft = {
      text: base,
      intent: question ? 'answer' : 'reflect',
      notes: [`model:${E.gateway.activeModel()}`],
    };

    // 7. Teaching shapes HOW we respond (may turn an answer into a question first).
    draft = E.teaching.shape(draft, ctx);
    if (draft.notes.includes('teaching:socratic')) notes.push('teaching: led with a question, not an answer');

    // 8. Human Connection: should a real person be involved?
    const hc = E.humanConnection.assess(ctx);
    if (hc.routeToHuman && hc.suggestion) {
      draft.text += ` ${hc.suggestion}`;
      notes.push('human-connection: routed toward a real person');
    }

    // 9. Voice & Personality: apply delivery (never content).
    draft.text = E.voice.render(draft.text, persona);

    // 10. Growth governor reshapes toward confidence over dependence.
    draft = E.growth.reshape(draft, ctx);
    for (const n of draft.notes) {
      if (n.startsWith('growth:')) notes.push(`growth: ${n.slice(7)}`);
    }

    // 11. Ethics governor gets the last word. Hard veto.
    const verdict = E.ethics.gate(draft, ctx);
    let finalText = draft.text;
    let care = false;
    switch (verdict.kind) {
      case 'Allow':
        break;
      case 'AddFriction':
        notes.push(`ethics: added friction — ${verdict.why}`);
        break;
      case 'Modify':
        finalText = verdict.text;
        notes.push(`ethics: modified — ${verdict.why}`);
        break;
      case 'Block':
        finalText = `I don't think I should answer that here — ${verdict.why}`;
        notes.push(`ethics: BLOCKED — ${verdict.why}`);
        break;
      case 'Escalate':
        finalText = verdict.text;
        care = true;
        notes.push(`ethics: ESCALATED to care — ${verdict.why}`);
        break;
    }

    // 12. Remember the exchange (a curated summary, never a raw transcript).
    E.memory.remember(
      personId, navigatorId,
      `Person said: "${message}". Companion ${care ? 'offered care' : 'responded'}.`,
      'interaction.summary',
    );

    return { text: finalText, notes, care };
  }

  // A rich, model-neutral context block. The mock reads NAME/MESSAGE/task; a real
  // model uses the whole thing to produce a genuine, guardrailed reply in persona.
  private buildPrompt(ctx: ExchangeContext, task: string): string {
    const bp = ctx.blueprint;
    const mem = ctx.recalled.map((e) => `- ${eventText(e)}`).join('\n') || '- (nothing relevant yet)';
    const lines = [
      `TASK: ${task}`,
      `PERSONA: ${ctx.persona.name} — ${ctx.persona.style}`,
      `GUARDRAILS: ${ctx.persona.guardrails.join('; ')}`,
      `NAME: ${bp.identity.preferredName}`,
      `ABOUT: goals=${bp.goals.map((g) => g.text).join(', ') || '—'}; values=${bp.values.join(', ') || '—'}; strengths=${bp.strengths.join(', ') || '—'}`,
      `MEMORY:\n${mem}`,
    ];
    if (ctx.lastInteractionSummary) lines.push(`LAST: ${ctx.lastInteractionSummary}`);
    lines.push(`MESSAGE: ${ctx.message}`);
    return lines.join('\n');
  }
}

function eventText(e: import('../shared/types').NavigatorEvent): string {
  const p = e.payload as Record<string, any>;
  return String(p.summary ?? p.title ?? p.moment?.whyItMattered ?? e.type);
}
