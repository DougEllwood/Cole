// Memory Engine (Layer 2) — owns what the companion knows over time AND the
// operations of the Story of Me. Enforces the Memory Covenant and the One
// Moment Rule. Never fabricates; the log is the source of truth.
// docs/architecture/engines/01-memory-engine.md

import type { MemoryEngine } from '../../shared/contracts';
import type {
  Blueprint, Chapter, Journey, Moment, MomentCandidate, NavigatorEvent, NavigatorId, PersonId,
} from '../../shared/types';
import { EventLog } from '../../kernel/eventLog';
import { buildBlueprint, buildStory, recallByRelevance } from '../../kernel/projections';

const MEMORY_BEARING = new Set(['interaction.summary', 'fact.learned', 'moment.preserved', 'chapter.opened']);

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function emptyBlueprint(personId: PersonId): Blueprint {
  return {
    personId,
    identity: { preferredName: personId, language: 'en' },
    goals: [], values: [], strengths: [], growthEdges: [],
    relationships: [], preferences: {}, journeyChapters: [], extensions: {},
  };
}

export class MemoryEngineImpl implements MemoryEngine {
  private seeds = new Map<PersonId, Blueprint>();
  private momentCounter = 0;

  constructor(private log: EventLog) {}

  // Set by the vertical at onboarding — the base portrait the log folds onto.
  // If the person already has a seed (from another Navigator), the shared CORE
  // is kept and this vertical's EXTENSION and relationships are merged in — the
  // continuity that lets a Blueprint follow a person across chapters of life.
  seedBlueprint(bp: Blueprint): void {
    const existing = this.seeds.get(bp.personId);
    if (!existing) { this.seeds.set(bp.personId, bp); return; }
    existing.extensions = { ...existing.extensions, ...bp.extensions };
    for (const r of bp.relationships) {
      if (!existing.relationships.find((x) => x.who === r.who)) existing.relationships.push(r);
    }
    for (const g of bp.goals) {
      if (!existing.goals.find((x) => x.text === g.text)) existing.goals.push(g);
    }
  }

  remember(personId: PersonId, navigatorId: NavigatorId, summary: string, kind: 'interaction.summary' | 'fact.learned'): void {
    this.log.append(personId, navigatorId, kind, { summary });
  }

  recall(personId: PersonId, navigatorId: NavigatorId, query: string, crossContext: boolean): NavigatorEvent[] {
    // Scoped by default; the log is re-read and the index rebuilt every call.
    const events = (crossContext ? this.log.all(personId) : this.log.scoped(personId, navigatorId))
      .filter((e) => MEMORY_BEARING.has(e.type));
    return recallByRelevance(events, query);
  }

  projectBlueprint(personId: PersonId, navigatorId: NavigatorId): Blueprint {
    return buildBlueprint(this.resolveSeed(personId), this.log.scoped(personId, navigatorId));
  }

  // The person's full portable portrait — person-level, across every Navigator.
  exportBlueprint(personId: PersonId): Blueprint {
    return buildBlueprint(this.resolveSeed(personId), this.log.all(personId));
  }

  // Resolve the base portrait. Prefer the in-memory seed; if it's absent (e.g.
  // after a restart), reconstruct it from the durable 'blueprint.edited' seed
  // events in the log — so identity survives, because the log is the truth.
  private resolveSeed(personId: PersonId): Blueprint {
    const inMem = this.seeds.get(personId);
    if (inMem) return inMem;
    let bp: Blueprint | undefined;
    for (const e of this.log.all(personId)) {
      if (e.type !== 'blueprint.edited' || !e.payload.seed) continue;
      const s = e.payload.seed as Blueprint;
      if (!bp) { bp = structuredClone(s); continue; }
      bp.extensions = { ...bp.extensions, ...s.extensions };
      for (const r of s.relationships) if (!bp.relationships.find((x) => x.who === r.who)) bp.relationships.push(r);
      for (const g of s.goals) if (!bp.goals.find((x) => x.text === g.text)) bp.goals.push(g);
    }
    if (bp) this.seeds.set(personId, bp); // cache the rebuilt seed
    return bp ?? emptyBlueprint(personId);
  }

  // Clear the in-memory seed cache (used when a person erases their record).
  dropSeed(personId: PersonId): void {
    this.seeds.delete(personId);
  }

  // ---- The Story of Me ----
  openChapter(personId: PersonId, navigatorId: NavigatorId, title: string, journey: Journey): string {
    const chapterId = `chp_${slug(title)}`;
    const chapter: Chapter = {
      chapterId, personId, title, journey,
      openedOn: new Date().toISOString().slice(0, 10),
    };
    this.log.append(personId, navigatorId, 'chapter.opened', { chapter }, chapter.openedOn);
    return chapterId;
  }

  preserveMoment(candidate: MomentCandidate): { ok: true; moment: Moment } | { ok: false; reason: string } {
    // The Memory Covenant (Constitution, Article III): a Moment must carry meaning.
    if (!candidate.whyItMattered || !candidate.whyItMattered.trim()) {
      return { ok: false, reason: 'A Moment must answer "why did this matter?" — memories are earned, not stored.' };
    }
    if (!candidate.covenantBasis || candidate.covenantBasis.length === 0) {
      return { ok: false, reason: 'A Moment must serve growth, reflection, gratitude, or connection.' };
    }
    if (!candidate.chapterId || !candidate.chapterId.trim()) {
      return { ok: false, reason: 'Every Moment belongs to a Chapter — there are no galleries or folders.' };
    }
    // The One Moment Rule (Constitution, Article IV): one per day via the ritual.
    if (candidate.origin === 'one_moment_rule' && this.momentsPreservedOn(candidate.personId, candidate.occurredOn) >= 1) {
      return { ok: false, reason: 'The One Moment Rule keeps one Moment a day — one, not fifty.' };
    }
    const moment: Moment = { ...candidate, momentId: `mom_${++this.momentCounter}`, privacy: 'private' };
    this.log.append(candidate.personId, candidate.navigatorId, 'moment.preserved', { moment }, candidate.occurredOn);
    return { ok: true, moment };
  }

  revisit(personId: PersonId, navigatorId: NavigatorId, chapterTitleOrId: string): Moment | undefined {
    const story = buildStory(this.log.all(personId), personId, navigatorId);
    const needle = chapterTitleOrId.toLowerCase();
    const found = story.find(
      (s) => s.chapter.chapterId.toLowerCase() === needle || s.chapter.title.toLowerCase().includes(needle),
    );
    if (!found || found.moments.length === 0) return undefined;
    // Prefer a Moment with a voice note to replay in the person's own voice.
    return found.moments.find((m) => m.voiceNoteText) ?? found.moments[0];
  }

  forget(momentId: string, mode: 'deemphasize' | 'delete'): void {
    // Find the owning person/scope from the log, then append the forgetting event.
    // Forgetting is itself an appended event — the log is never mutated in place.
    for (const e of this.log.everything()) {
      if (e.type === 'moment.preserved' && (e.payload.moment as Moment).momentId === momentId) {
        const type = mode === 'delete' ? 'moment.deleted' : 'moment.deemphasized';
        this.log.append(e.personId, e.navigatorId, type, { momentId });
        return;
      }
    }
  }

  // Person-level by default (spans the whole life story across Navigators);
  // pass navigatorId to narrow to one scope.
  story(personId: PersonId, navigatorId?: NavigatorId) {
    return buildStory(this.log.all(personId), personId, navigatorId);
  }

  momentsPreservedOn(personId: PersonId, isoDate: string): number {
    return this.log.all(personId).filter(
      (e) => e.type === 'moment.preserved' && (e.payload.moment as Moment).occurredOn === isoDate,
    ).length;
  }
}
