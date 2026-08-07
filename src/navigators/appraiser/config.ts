// Appraiser Navigator — the VerticalConfig. Note the scope rules: this is where
// professional integrity is enforced. The companion will NOT put a value on a
// property in a chat — a proper appraisal needs evidence and analysis. That is
// the Ethics governor protecting the person and the profession.

import type { VerticalConfig } from '../../shared/contracts';
import { APPRAISER_PERSONA } from './persona';
import { APPRAISER_DOMAIN } from './domainPack';
import { appraiserSeed } from './blueprintExt';

export const APPRAISER_CONFIG: VerticalConfig = {
  navigatorId: 'appraiser',
  domainName: APPRAISER_DOMAIN.name,
  chapterOfLife: APPRAISER_DOMAIN.chapterOfLife,
  focus: APPRAISER_DOMAIN.focus,
  suggestedChapters: APPRAISER_DOMAIN.suggestedChapters,
  persona: APPRAISER_PERSONA,
  scopeRules: [
    {
      cues: ['just give me a number', 'what should the value be', 'what number', 'value it for me', 'make the value', 'what is it worth', 'tell me the value'],
      boundary: "I can't put a value on a property in a chat — a credible opinion of value needs the evidence and the analysis behind it. What I can do is help you reason toward it: the comparables, the adjustments, the story the data tells.",
    },
    { cues: ['tax advice', 'legal advice', 'is this legal', 'how do i avoid tax'], boundary: "That's outside my lane — a tax or legal professional is the right person for that. I can stick to the appraisal side with you." },
  ],
  seed: (personId, data: { name: string; designationPath: string; focus: string }) =>
    appraiserSeed(personId, data.name, data.designationPath, data.focus),
};
