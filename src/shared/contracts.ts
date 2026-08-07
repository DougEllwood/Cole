// Navigator OS — engine contracts (Layer 0: universal interfaces).
// The kernel orchestrator depends on THESE interfaces, never on engine
// implementations. Concrete engines are injected at the composition root
// (dependency inversion) — this is what keeps the kernel from importing
// upward and lets any engine be swapped without touching the others.
// See docs/architecture/engines/*.md.

import type {
  Blueprint, CompanionReply, Draft, ExchangeContext, Moment, MomentCandidate,
  NavigatorEvent, PersonId, NavigatorId, Persona, ScopeRule, Verdict,
} from './types';

// A Navigator (vertical) is thin: a persona overlay, a domain pack, scope
// rules, and a Blueprint seed — all composed over the shared platform.
export interface VerticalConfig {
  navigatorId: NavigatorId;
  domainName: string;
  chapterOfLife: string;
  focus: string;
  suggestedChapters: string[];
  persona: Persona;
  scopeRules: ScopeRule[];
  seed: (personId: PersonId, data: any) => Blueprint;
}

// The Intelligence Gateway interface lives here so engines/kernel depend on the
// abstraction, never on a model vendor. (ADR-0003)
export interface IntelligenceGateway {
  generate(prompt: string, task: string): Promise<string>;
  activeModel(): string;
}

export interface MemoryEngine {
  remember(personId: PersonId, navigatorId: NavigatorId, summary: string, kind: 'interaction.summary' | 'fact.learned'): void;
  recall(personId: PersonId, navigatorId: NavigatorId, query: string, crossContext: boolean): NavigatorEvent[];
  projectBlueprint(personId: PersonId, navigatorId: NavigatorId): Blueprint;
  // The Story of Me
  openChapter(personId: PersonId, navigatorId: NavigatorId, title: string, journey: import('./types').Journey): string;
  preserveMoment(candidate: MomentCandidate): { ok: true; moment: Moment } | { ok: false; reason: string };
  revisit(personId: PersonId, navigatorId: NavigatorId, chapterTitleOrId: string): Moment | undefined;
  forget(momentId: string, mode: 'deemphasize' | 'delete'): void;
  // The Story of Me is person-level (it spans a person's whole life across
  // Navigators). Pass navigatorId only to narrow to one scope.
  story(personId: PersonId, navigatorId?: NavigatorId): { chapter: import('./types').Chapter; moments: Moment[] }[];
  momentsPreservedOn(personId: PersonId, isoDate: string): number; // One Moment Rule support
}

export interface RelationshipEngine {
  // The bond between the person and THEIR companion — continuity + healthy limits.
  contextFor(personId: PersonId, navigatorId: NavigatorId): { lastInteractionSummary?: string };
  // Detect when the companion should NOT be the centre and should defer.
  shouldDefer(message: string): boolean;
}

export interface HumanConnectionEngine {
  // The person's bonds with OTHER humans, and routing toward them.
  assess(ctx: ExchangeContext): { routeToHuman: boolean; suggestion?: string };
}

export interface VoicePersonalityEngine {
  // HOW the companion expresses itself. Delivery only — never content.
  render(text: string, persona: Persona): string;
}

export interface TeachingEngine {
  // Pedagogy: teach how to think. May turn an answer into a question-first reply.
  shape(draft: Draft, ctx: ExchangeContext): Draft;
}

// Governors — sit in the response path and can reshape/veto. (Constitution, Article II)
export interface GrowthEngine {
  // Steer toward confidence over dependence. Success = the person needing us LESS.
  reshape(draft: Draft, ctx: ExchangeContext): Draft;
  noteRequest(personId: PersonId, navigatorId: NavigatorId): void; // dependence signal
  connectMoments(moments: Moment[]): string | undefined; // reflection, never engagement
}

export interface EthicsEngine {
  // The final gate. Hard veto. Crisis routing. Scope. Dignity. Anti-manipulation.
  gate(draft: Draft, ctx: ExchangeContext): Verdict;
  // Scope of the active Navigator — what it must decline.
  outOfScope(message: string, navigatorId: NavigatorId): string | undefined;
}

// The bundle the composition root injects into the orchestrator.
export interface EngineSet {
  memory: MemoryEngine;
  relationship: RelationshipEngine;
  humanConnection: HumanConnectionEngine;
  voice: VoicePersonalityEngine;
  teaching: TeachingEngine;
  growth: GrowthEngine;
  ethics: EthicsEngine;
  gateway: IntelligenceGateway;
}

// Minimal shared reply shape re-export for convenience.
export type { CompanionReply };
