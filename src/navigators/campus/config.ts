// Campus Navigator — the VerticalConfig. A vertical is just this: persona +
// domain + scope + Blueprint seed, composed over NavigatorOS.

import type { VerticalConfig } from '../../shared/contracts';
import { CAMPUS_PERSONA } from './persona';
import { CAMPUS_DOMAIN } from './domainPack';
import { campusSeed } from './blueprintExt';

export const CAMPUS_CONFIG: VerticalConfig = {
  navigatorId: 'campus',
  domainName: CAMPUS_DOMAIN.name,
  chapterOfLife: CAMPUS_DOMAIN.chapterOfLife,
  focus: CAMPUS_DOMAIN.focus,
  suggestedChapters: CAMPUS_DOMAIN.suggestedChapters,
  persona: CAMPUS_PERSONA,
  scopeRules: [
    { cues: ['diagnose', 'prescription', 'medication', 'medical advice'], boundary: "I can't give medical advice — a campus health professional is the right person for that. I can help you figure out how to reach them." },
    { cues: ['is this legal', 'sue', 'lawsuit', 'legal advice', 'my rights'], boundary: "I'm not able to give legal advice, but I can help you find the right person on campus who can." },
    { cues: ['what is my house worth', 'appraised value', 'appraise'], boundary: "That's outside what I do here — a qualified professional would need to help with that." },
  ],
  seed: (personId, data: { name: string; program: string; year: number }) =>
    campusSeed(personId, data.name, data.program, data.year),
};
