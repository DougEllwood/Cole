// Navigator OS — shared types (Layer 0: universal, depends on nothing).
// These are contracts. The Blueprint core schema and the Moment schema mirror
// shared/blueprint/*.schema.md. See docs/architecture/10-memory-architecture.md.

export type PersonId = string;
export type NavigatorId = string; // scope: 'campus' | 'appraiser' | ...

// ---------------------------------------------------------------------------
// The Memory Covenant (Constitution, Article III): every Moment must serve at
// least one of these. A Moment with none is not a Moment and is rejected.
// ---------------------------------------------------------------------------
export type CovenantBasis = 'growth' | 'reflection' | 'gratitude' | 'connection';

export type MomentOrigin = 'one_moment_rule' | 'person_initiated' | 'revisit';

// A Chapter is the ONLY organizing unit of the Story of Me. No galleries/albums/folders.
export type Journey =
  | 'University' | 'Career' | 'Family' | 'Business' | 'Health' | 'PersonalGrowth' | 'Other';

export interface Chapter {
  chapterId: string;
  personId: PersonId;
  title: string;              // human title: "Leaving Home", "Finding My People"
  journey: Journey;
  openedOn: string;           // ISO date
}

export interface PersonLink {
  who: string;                // consented display name
  role?: string;              // "advisor", "roommate", "mum"
}

// The atomic unit of the Story of Me. Mirrors shared/blueprint/moment.schema.md.
export interface Moment {
  momentId: string;
  personId: PersonId;
  navigatorId: NavigatorId;   // scope
  chapterId: string;          // REQUIRED — every Moment belongs to exactly one Chapter
  reflection?: string;        // the person's words
  whatILearned?: string;
  whyItMattered: string;      // REQUIRED — answers "why did this matter?"
  covenantBasis: CovenantBasis[]; // REQUIRED — at least one
  whoWasInvolved: PersonLink[];
  photoRef?: string;          // encrypted-blob ref (mocked here)
  voiceNoteRef?: string;      // the person's own voice (mocked here)
  voiceNoteText?: string;     // transcript, for the skeleton's revisit demo
  occurredOn: string;         // ISO date
  location?: string;
  origin: MomentOrigin;
  privacy: 'private';         // default and only default
}

// A candidate a person offers; the Memory Engine validates it against the Covenant.
export type MomentCandidate = Omit<Moment, 'momentId' | 'privacy'>;

// ---------------------------------------------------------------------------
// The append-only event log — the SOURCE OF TRUTH. Everything else is a
// rebuildable projection. (ADR-0002)
// ---------------------------------------------------------------------------
export type EventType =
  | 'interaction.summary'
  | 'fact.learned'
  | 'blueprint.edited'
  | 'chapter.opened'
  | 'moment.preserved'
  | 'moment.deemphasized'
  | 'moment.deleted'
  | 'milestone.reached'
  | 'bond.note'
  | 'consent.granted'
  | 'consent.revoked'
  | 'ethics.decision';

export interface NavigatorEvent {
  eventId: string;
  personId: PersonId;
  navigatorId: NavigatorId;   // the scope this event belongs to
  type: EventType;
  payload: Record<string, unknown>;
  occurredOn: string;         // ISO — when it mattered
  recordedAt: string;         // ISO — when it was written (monotonic seq also kept)
  seq: number;                // monotonic order in the log
}

// ---------------------------------------------------------------------------
// Personal Blueprint (portrait derived from the log). Mirrors blueprint-core.schema.md.
// ---------------------------------------------------------------------------
export interface Blueprint {
  personId: PersonId;
  identity: { preferredName: string; pronouns?: string; language: string };
  goals: { text: string; horizon: 'short' | 'long' }[];
  values: string[];
  strengths: string[];
  growthEdges: string[];
  relationships: { who: string; kind: string; consented: boolean }[];
  preferences: { challengeLevel?: 'gentle' | 'balanced' | 'direct' };
  journeyChapters: Chapter[];
  extensions: Record<string, Record<string, unknown>>; // per-Navigator
}

// ---------------------------------------------------------------------------
// Conversation flow types
// ---------------------------------------------------------------------------
export interface Persona {
  navigatorId: NavigatorId;
  name: string;               // the companion's name
  warmth: 'high' | 'medium' | 'calm';
  style: string;              // short description of tone
  // Non-negotiable, from the shared Personality Core — cannot be tuned away.
  guardrails: string[];
}

export interface ExchangeContext {
  personId: PersonId;
  navigatorId: NavigatorId;
  message: string;
  persona: Persona;
  blueprint: Blueprint;
  recalled: NavigatorEvent[];     // relevant memory (scoped)
  lastInteractionSummary?: string;
  scopeGrantsCrossContext: boolean;
}

// A drafted response as it moves through the governors.
export interface Draft {
  text: string;
  intent: 'answer' | 'reflect' | 'teach' | 'encourage' | 'care';
  notes: string[];            // provenance: which engines shaped it
}

export type Verdict =
  | { kind: 'Allow' }
  | { kind: 'AddFriction'; why: string }
  | { kind: 'Modify'; text: string; why: string }
  | { kind: 'Block'; why: string }
  | { kind: 'Escalate'; text: string; why: string }; // crisis → care response

export interface CompanionReply {
  text: string;
  notes: string[];            // human-readable trace of how the reply was shaped
  offeredMomentPrompt?: string; // the One Moment Rule prompt, if end-of-day
  care?: boolean;             // true when this was routed to care
}

// A per-Navigator scope boundary — what this companion must decline.
export interface ScopeRule {
  cues: string[];
  boundary: string;
}

// What a surface passes to capture a Moment (the Navigator fills in scope).
export interface MomentInput {
  personId: PersonId;
  chapterId: string;
  whyItMattered: string;
  covenantBasis: CovenantBasis[];
  occurredOn: string;
  reflection?: string;
  whatILearned?: string;
  voiceNoteText?: string;
  voiceNoteRef?: string;   // ref to the encrypted audio blob (the person's real voice)
  photoRef?: string;
  location?: string;
  whoWasInvolved?: PersonLink[];
  origin?: MomentOrigin;
}
