// Navigator OS — a minimal interactive surface (Layer 5). Thin client over the
// platform. Talk to Campus Navigator; capture and revisit Moments.
//
//   run:  npm run cli
//
// Commands:  /moment   capture one Moment (the One Moment Rule)
//            /story    show your Story of Me
//            /revisit <chapter>   hear a past Moment
//            /quit

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { CampusNavigator } from '../navigators/campus/campusNavigator';
import type { CovenantBasis } from '../shared/types';

const nav = new CampusNavigator();
const PERSON = 'person_cli';
const rl = createInterface({ input, output });

function today() { return new Date().toISOString().slice(0, 10); }

async function main() {
  console.log('Navigator OS — Campus Navigator (type /quit to leave)\n');
  const name = (await rl.question('Your first name: ')).trim() || 'friend';
  const program = (await rl.question('Your program: ')).trim() || 'Undeclared';
  nav.onboard(PERSON, name, program, 1);
  nav.openChapter(PERSON, 'First Week');
  console.log(`\nHi ${name}, I'm Ivy. I'm glad you're here.\n`);

  for (;;) {
    const line = (await rl.question('you › ')).trim();
    if (!line) continue;
    if (line === '/quit') break;

    if (line === '/story') {
      for (const { chapter, moments } of nav.story(PERSON)) {
        console.log(`\n📖 ${chapter.title}`);
        for (const m of moments) console.log(`   • ${m.whyItMattered} [${m.covenantBasis.join(', ')}]`);
      }
      console.log();
      continue;
    }

    if (line.startsWith('/revisit')) {
      const ch = line.replace('/revisit', '').trim() || 'First Week';
      const m = nav.revisit(PERSON, ch);
      console.log(m ? `\nIvy › Here's what mattered: "${m.whyItMattered}"${m.voiceNoteText ? `\n🎤 "${m.voiceNoteText}"` : ''}\n`
                    : `\nIvy › Nothing kept in "${ch}" yet.\n`);
      continue;
    }

    if (line === '/moment') {
      const why = (await rl.question('  Why did this matter? ')).trim();
      const basis = (await rl.question('  Serves (growth/reflection/gratitude/connection, comma-sep): '))
        .split(',').map((s) => s.trim()).filter(Boolean) as CovenantBasis[];
      const ch = (await rl.question('  Which chapter? (default: First Week) ')).trim() || 'First Week';
      const chapterId = `chp_${ch.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const res = nav.captureMoment({ personId: PERSON, chapterId, whyItMattered: why, covenantBasis: basis, occurredOn: today() });
      console.log(res.ok ? '  ✓ kept.\n' : `  ✗ ${res.reason}\n`);
      continue;
    }

    const r = await nav.say(PERSON, line);
    console.log(`Ivy › ${r.text}\n`);
  }

  console.log('\nIvy › Take care of yourself out there.');
  rl.close();
}

main().catch((e) => { console.error(e); rl.close(); process.exit(1); });
