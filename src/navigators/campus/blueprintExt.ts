// Campus Navigator — Personal Blueprint extension. Attaches domain fields to
// the shared core WITHOUT altering it. (blueprint-core.schema.md §extensions)

import type { Blueprint, PersonId } from '../../shared/types';

export function campusSeed(
  personId: PersonId,
  name: string,
  program: string,
  year: number,
): Blueprint {
  return {
    personId,
    identity: { preferredName: name, language: 'en' },
    goals: [
      { text: 'Find where I belong here', horizon: 'short' },
      { text: 'Become someone I’m proud of by graduation', horizon: 'long' },
    ],
    values: ['honesty', 'kindness', 'perseverance'],
    strengths: ['curious', 'shows up even when nervous'],
    growthEdges: ['reaching out first', 'trusting my own judgment'],
    relationships: [
      { who: 'family back home', kind: 'family', consented: true },
      { who: 'academic advisor', kind: 'professional', consented: true },
    ],
    preferences: { challengeLevel: 'balanced' },
    journeyChapters: [],
    extensions: {
      campus: { program, year },
    },
  };
}
