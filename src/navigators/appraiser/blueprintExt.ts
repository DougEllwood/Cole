// Appraiser Navigator — Blueprint extension. Attaches to the shared core
// without altering it. When a person carries a core Blueprint from an earlier
// Navigator (e.g. Campus), this extension merges in beside it.

import type { Blueprint, PersonId } from '../../shared/types';

export function appraiserSeed(
  personId: PersonId,
  name: string,
  designationPath: string,
  focus: string,
): Blueprint {
  return {
    personId,
    identity: { preferredName: name, language: 'en' },
    goals: [
      { text: 'Trust my own professional judgment', horizon: 'short' },
      { text: 'Earn my designation and do work I’m proud of', horizon: 'long' },
    ],
    values: ['integrity', 'independence', 'diligence'],
    strengths: ['careful', 'takes the work seriously'],
    growthEdges: ['trusting my judgment under pressure', 'asking for help sooner'],
    relationships: [
      { who: 'supervising appraiser', kind: 'mentor', consented: true },
    ],
    preferences: { challengeLevel: 'direct' },
    journeyChapters: [],
    extensions: {
      appraiser: { designationPath, focus },
    },
  };
}
