// Story of Me — a viewer surface (Layer 5). Renders a person's Story as a
// private, calm "museum" page: Chapters and Moments, no feed, no metrics, no
// likes. Pure function — takes the Story, returns self-contained HTML.
// docs/architecture/12-the-story-of-me.md

import type { Chapter, Moment } from '../shared/types';

type Story = { chapter: Chapter; moments: Moment[] }[];

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BASIS_LABEL: Record<string, string> = {
  growth: 'growth', reflection: 'reflection', gratitude: 'gratitude', connection: 'connection',
};

export function renderStoryHTML(personName: string, story: Story): string {
  // Group chapters by journey, preserving order of first appearance.
  const journeys: { name: string; chapters: Story }[] = [];
  for (const entry of story) {
    let j = journeys.find((x) => x.name === entry.chapter.journey);
    if (!j) { j = { name: entry.chapter.journey, chapters: [] }; journeys.push(j); }
    j.chapters.push(entry);
  }

  const momentCount = story.reduce((n, s) => n + s.moments.length, 0);

  const momentCard = (m: Moment) => `
    <article class="moment">
      <p class="why">${esc(m.whyItMattered)}</p>
      ${m.reflection ? `<p class="reflection">${esc(m.reflection)}</p>` : ''}
      ${m.voiceNoteText ? `<blockquote class="voice"><span class="mic">🎤</span> “${esc(m.voiceNoteText)}”</blockquote>` : ''}
      ${m.whatILearned ? `<p class="learned"><span>What I learned</span> ${esc(m.whatILearned)}</p>` : ''}
      <div class="chips">
        ${m.covenantBasis.map((b) => `<span class="chip chip-${b}">${BASIS_LABEL[b] ?? b}</span>`).join('')}
      </div>
      <div class="meta">
        <span>${esc(m.occurredOn)}</span>
        ${m.whoWasInvolved.length ? `<span>· with ${m.whoWasInvolved.map((w) => esc(w.who)).join(', ')}</span>` : ''}
      </div>
    </article>`;

  const chapterBlock = (c: Chapter, moments: Moment[]) => `
    <section class="chapter">
      <h3>${esc(c.title)}</h3>
      ${moments.map(momentCard).join('')}
    </section>`;

  const journeyBlock = (name: string, chapters: Story) => `
    <div class="journey">
      <h2>${esc(name)}</h2>
      ${chapters.map((ch) => chapterBlock(ch.chapter, ch.moments)).join('')}
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The Story of ${esc(personName)}</title>
<style>
  :root{
    --bg:#f6f4ef; --ink:#2c2a26; --muted:#8a8278; --line:#e3ddd2;
    --card:#fffdf9; --accent:#7a6a53; --shadow:0 1px 2px rgba(0,0,0,.04),0 8px 24px rgba(0,0,0,.05);
  }
  @media (prefers-color-scheme: dark){
    :root{ --bg:#17150f; --ink:#ece7dc; --muted:#a49a89; --line:#2c281f; --card:#201d16; --accent:#c9b48f; --shadow:0 1px 2px rgba(0,0,0,.3),0 12px 32px rgba(0,0,0,.35);}
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:16px/1.6 ui-serif,Georgia,'Times New Roman',serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:720px;margin:0 auto;padding:56px 22px 96px}
  header{text-align:center;margin-bottom:14px}
  .eyebrow{font:600 12px/1 ui-sans-serif,system-ui;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
  h1{font-size:34px;margin:.35em 0 .15em;font-weight:600}
  .tagline{color:var(--muted);font-style:italic;margin:0}
  .private{display:inline-flex;gap:6px;align-items:center;margin-top:16px;padding:5px 12px;border:1px solid var(--line);
    border-radius:999px;font:600 12px/1 ui-sans-serif,system-ui;color:var(--muted)}
  .count{text-align:center;color:var(--muted);font:13px/1 ui-sans-serif,system-ui;margin:22px 0 40px}
  .journey > h2{font-size:14px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);
    border-top:1px solid var(--line);padding-top:26px;margin:44px 0 6px;font-family:ui-sans-serif,system-ui}
  .chapter{margin:26px 0}
  .chapter > h3{font-size:23px;font-weight:600;margin:0 0 14px}
  .moment{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin:14px 0;box-shadow:var(--shadow)}
  .why{font-size:18px;font-weight:600;margin:0 0 6px}
  .reflection{margin:.2em 0;color:var(--ink)}
  .voice{margin:14px 0;padding:12px 16px;border-left:3px solid var(--accent);background:rgba(122,106,83,.06);
    border-radius:0 8px 8px 0;font-style:italic}
  .voice .mic{font-style:normal;margin-right:4px}
  .learned{font-size:14px;color:var(--muted);margin:.4em 0 0}
  .learned span{font-weight:700;color:var(--accent);margin-right:6px;text-transform:uppercase;font:700 11px/1 ui-sans-serif,system-ui;letter-spacing:.08em}
  .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
  .chip{font:600 11px/1 ui-sans-serif,system-ui;letter-spacing:.04em;padding:5px 9px;border-radius:999px;
    background:rgba(122,106,83,.1);color:var(--accent)}
  .meta{margin-top:10px;color:var(--muted);font:12px/1.4 ui-sans-serif,system-ui}
  footer{text-align:center;color:var(--muted);font:12px/1.6 ui-sans-serif,system-ui;margin-top:56px;
    border-top:1px solid var(--line);padding-top:20px}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="eyebrow">The Story of Me</div>
      <h1>${esc(personName)}</h1>
      <p class="tagline">Every journey deserves to be remembered.</p>
      <div class="private">🔒 Private · no feed · no likes · no followers</div>
    </header>
    <p class="count">${momentCount} moment${momentCount === 1 ? '' : 's'} kept — because each one mattered, not because it filled a camera roll.</p>
    ${journeys.map((j) => journeyBlock(j.name, j.chapters)).join('')}
    <footer>Navigator OS · a private museum of becoming · authored by ${esc(personName)}, kept with their Navigator</footer>
  </div>
</body>
</html>`;
}
