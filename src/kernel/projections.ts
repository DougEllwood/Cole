// Projections — DERIVED views folded from the event log. None of these is a
// source of truth; each can be dropped and rebuilt from the log at any time.
// The semantic index in particular is derived, never canonical. (ADR-0002)

import type {
  Blueprint, Chapter, Moment, NavigatorEvent, NavigatorId, PersonId,
} from '../shared/types';

// ---- Story of Me projection ------------------------------------------------
// The Story is person-level: it spans every chapter of a life across Navigators.
// Pass navigatorId only to narrow to one scope.
export function buildStory(
  events: NavigatorEvent[],
  personId: PersonId,
  navigatorId?: NavigatorId,
): { chapter: Chapter; moments: Moment[] }[] {
  const chapters = new Map<string, Chapter>();
  const moments = new Map<string, Moment>();
  const suppressed = new Set<string>(); // deleted
  const deemphasized = new Set<string>();

  for (const e of events) {
    if (e.personId !== personId) continue;
    if (navigatorId && e.navigatorId !== navigatorId) continue;
    if (e.type === 'chapter.opened') {
      const c = e.payload.chapter as Chapter;
      chapters.set(c.chapterId, c);
    } else if (e.type === 'moment.preserved') {
      const m = e.payload.moment as Moment;
      moments.set(m.momentId, m);
    } else if (e.type === 'moment.deleted') {
      suppressed.add(e.payload.momentId as string);
    } else if (e.type === 'moment.deemphasized') {
      deemphasized.add(e.payload.momentId as string);
    }
  }

  const out: { chapter: Chapter; moments: Moment[] }[] = [];
  for (const chapter of chapters.values()) {
    const ms = [...moments.values()]
      .filter((m) => m.chapterId === chapter.chapterId && !suppressed.has(m.momentId))
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
    // de-emphasized moments remain but are marked quietly at the end
    ms.sort((a, b) => Number(deemphasized.has(a.momentId)) - Number(deemphasized.has(b.momentId)));
    out.push({ chapter, moments: ms });
  }
  return out;
}

// ---- Blueprint projection --------------------------------------------------
// Folds fact.learned / blueprint.edited events on top of a seed portrait.
export function buildBlueprint(
  seed: Blueprint,
  events: NavigatorEvent[],
): Blueprint {
  const bp: Blueprint = structuredClone(seed);
  for (const e of events) {
    if (e.personId !== bp.personId) continue;
    if (e.type === 'fact.learned') {
      const fact = String(e.payload.summary ?? '');
      if (fact && !bp.strengths.includes(fact)) {
        // In the skeleton, learned facts accrue as lightweight notes on the portrait.
        (bp.extensions.__notes ??= { items: [] });
        (bp.extensions.__notes.items as string[]).push(fact);
      }
    } else if (e.type === 'chapter.opened') {
      const c = e.payload.chapter as Chapter;
      if (!bp.journeyChapters.find((x) => x.chapterId === c.chapterId)) bp.journeyChapters.push(c);
    }
  }
  return bp;
}

// ---- Semantic index (DERIVED, never canonical) -----------------------------
// A deliberately simple keyword recall. Rebuilt from the log on every call to
// prove the point: the index is a projection, not the source of truth.
export function recallByRelevance(
  events: NavigatorEvent[],
  query: string,
  limit = 5,
): NavigatorEvent[] {
  const terms = tokens(query);
  const scored = events
    .map((e) => ({ e, score: overlap(terms, tokens(textOf(e))) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.e.seq - a.e.seq);
  return scored.slice(0, limit).map((s) => s.e);
}

function textOf(e: NavigatorEvent): string {
  const p = e.payload as Record<string, unknown>;
  return [p.summary, p.title, (p.moment as Moment | undefined)?.whyItMattered]
    .filter(Boolean)
    .join(' ');
}
function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
}
function overlap(a: string[], b: string[]): number {
  const set = new Set(b);
  return a.reduce((n, t) => n + (set.has(t) ? 1 : 0), 0);
}
