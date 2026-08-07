// Appraiser Navigator — a thin facade over NavigatorOS with Appraiser registered.

import { NavigatorOS } from '../navigatorOS';
import { APPRAISER_CONFIG } from './config';
import { APPRAISER_PERSONA } from './persona';
import type { Chapter, CompanionReply, Journey, Moment, MomentInput, PersonId } from '../../shared/types';

const NAV = 'appraiser';

export class AppraiserNavigator {
  readonly persona = APPRAISER_PERSONA;
  private os: NavigatorOS;

  constructor(clock?: () => string) {
    this.os = new NavigatorOS(clock);
    this.os.registerVertical(APPRAISER_CONFIG);
  }

  model(): string { return this.os.model(); }
  logSize(): number { return this.os.logSize(); }

  onboard(personId: PersonId, name: string, designationPath: string, focus: string): void {
    this.os.onboard(personId, NAV, { name, designationPath, focus });
  }
  say(personId: PersonId, message: string): Promise<CompanionReply> {
    return this.os.say(personId, NAV, message);
  }
  openChapter(personId: PersonId, title: string, journey: Journey = 'Career'): string {
    return this.os.openChapter(personId, NAV, title, journey);
  }
  captureMoment(input: MomentInput) {
    return this.os.captureMoment(NAV, input);
  }
  revisit(personId: PersonId, chapterTitleOrId: string): Moment | undefined {
    return this.os.revisit(personId, chapterTitleOrId);
  }
  story(personId: PersonId): { chapter: Chapter; moments: Moment[] }[] {
    return this.os.story(personId);
  }
  oneMomentPrompt(): string { return this.os.oneMomentPrompt(); }
}
