// Campus Navigator — a thin facade over NavigatorOS with Campus registered.
// Kept for ergonomics and isolated use; the real platform is NavigatorOS.

import { NavigatorOS } from '../navigatorOS';
import { CAMPUS_CONFIG } from './config';
import { CAMPUS_PERSONA } from './persona';
import type { Chapter, CompanionReply, Journey, Moment, MomentInput, PersonId } from '../../shared/types';

const NAV = 'campus';

export class CampusNavigator {
  readonly persona = CAMPUS_PERSONA;
  private os: NavigatorOS;

  constructor(clock?: () => string) {
    this.os = new NavigatorOS(clock);
    this.os.registerVertical(CAMPUS_CONFIG);
  }

  model(): string { return this.os.model(); }
  logSize(): number { return this.os.logSize(); }

  onboard(personId: PersonId, name: string, program: string, year: number): void {
    this.os.onboard(personId, NAV, { name, program, year });
  }
  say(personId: PersonId, message: string): Promise<CompanionReply> {
    return this.os.say(personId, NAV, message);
  }
  openChapter(personId: PersonId, title: string, journey: Journey = 'University'): string {
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
  reflectAcrossMoments(personId: PersonId): string | undefined {
    return this.os.reflectAcrossMoments(personId);
  }
  forget(momentId: string, mode: 'deemphasize' | 'delete' = 'delete'): void {
    this.os.forget(momentId, mode);
  }
  grantCrossContext(personId: PersonId): void {
    this.os.grantCrossContext(personId, NAV);
  }
  oneMomentPrompt(): string { return this.os.oneMomentPrompt(); }
}
