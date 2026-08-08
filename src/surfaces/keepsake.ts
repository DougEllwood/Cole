// Keepsake builder — turns Kane's real conversations with Cole into "The Story of
// Kane": a personal copy for each event, organized by title and date. It reads the
// conversations from ElevenLabs (which saves every chat) using the API key that
// already lives in the server's environment — the key never leaves the server.
//
// Served at GET /keepsake. Nothing invented: only real transcript text is shown.

interface Turn { role: string; message: string; t: number }
interface Convo { id: string; startUnix: number; turns: Turn[] }

const API = 'https://api.elevenlabs.io';

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string
  ));
}

// ---- ElevenLabs reads ----
// agentId null = account-wide (all agents the key owns).
async function listConversations(key: string, agentId: string | null): Promise<Array<{ id: string; startUnix: number; agentId: string }>> {
  const out: Array<{ id: string; startUnix: number; agentId: string }> = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 50; guard++) {
    const url = new URL('/v1/convai/conversations', API);
    if (agentId) url.searchParams.set('agent_id', agentId);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: { 'xi-api-key': key } });
    if (!res.ok) throw new Error(`list failed (${res.status})`);
    const data: any = await res.json();
    const items: any[] = data?.conversations ?? data?.items ?? [];
    for (const c of items) {
      const id = c?.conversation_id ?? c?.id;
      if (id) out.push({ id, startUnix: Number(c?.start_time_unix_secs ?? c?.created_at_unix_secs ?? 0), agentId: String(c?.agent_id ?? '') });
    }
    if (data?.has_more && data?.next_cursor) cursor = data.next_cursor; else break;
  }
  return out;
}

async function getConversation(key: string, id: string, fallbackStart: number): Promise<Convo | null> {
  const res = await fetch(new URL(`/v1/convai/conversations/${id}`, API), { headers: { 'xi-api-key': key } });
  if (!res.ok) return null;
  const data: any = await res.json();
  const rows: any[] = data?.transcript ?? [];
  const turns: Turn[] = rows
    .map((r) => ({ role: String(r?.role ?? ''), message: String(r?.message ?? '').trim(), t: Number(r?.time_in_call_secs ?? 0) }))
    .filter((r) => r.message.length > 0);
  const startUnix = Number(data?.metadata?.start_time_unix_secs ?? fallbackStart ?? 0);
  return { id, startUnix, turns };
}

// ---- grouping & titling ----
const TZ = 'America/Toronto';
function dayKey(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}
function fmtDay(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-CA', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('en-CA', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(/\s/g, ' ');
}
function fmtRange(startUnix: number, endUnix: number): string {
  if (!startUnix) return '';
  const y = (u: number) => new Date(u * 1000).toLocaleDateString('en-CA', { timeZone: TZ, year: 'numeric' });
  const md = (u: number) => new Date(u * 1000).toLocaleDateString('en-CA', { timeZone: TZ, month: 'long', day: 'numeric' });
  const s = md(startUnix), e = md(endUnix), yr = y(endUnix || startUnix);
  return s === e ? `${s}, ${yr}` : `${s} – ${e}, ${yr}`;
}
function titleFor(c: Convo): string {
  const firstUser = c.turns.find((t) => t.role === 'user' && t.message.length > 1);
  const src = firstUser?.message ?? c.turns[0]?.message ?? 'A chat with Cole';
  const words = src.replace(/\s+/g, ' ').trim().split(' ').slice(0, 7).join(' ');
  return words.length < src.replace(/\s+/g, ' ').trim().length ? words + '…' : words;
}

const HIGHLIGHT_RE = /\b(best|unreal|amazing|incredible|epic|favou?rite|loved?|so good|unbelievable|insane|never forget(ting)?|the best|greatest|wild|perfect)\b/i;

// ---- render ----
function renderPage(convos: Convo[], opts: { eventTitle: string; chapter: string; subtitle: string; tagline?: string }): string {
  const withText = convos.filter((c) => c.turns.length > 0).sort((a, b) => a.startUnix - b.startUnix);
  const dated = withText.filter((c) => c.startUnix);
  const first = dated[0]?.startUnix ?? 0;
  const last = dated[dated.length - 1]?.startUnix ?? 0;

  // group by day
  const byDay = new Map<string, Convo[]>();
  for (const c of withText) {
    const k = c.startUnix ? dayKey(c.startUnix) : 'undated';
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(c);
  }
  const dayNames = ['', 'Day One', 'Day Two', 'Day Three', 'Day Four', 'Day Five', 'Day Six', 'Day Seven'];

  // highlights — Kane's own standout lines (real text only)
  const highlights: Array<{ msg: string; unix: number }> = [];
  for (const c of withText) for (const t of c.turns) {
    if (t.role === 'user' && HIGHLIGHT_RE.test(t.message) && t.message.length >= 8 && t.message.length <= 160) {
      highlights.push({ msg: t.message, unix: c.startUnix });
    }
  }
  const topHighlights = highlights.slice(0, 4);
  const highlightsHtml = topHighlights.length
    ? `<h2>In Kane's words</h2><div class="hls">${topHighlights.map((h) =>
        `<div class="hl"><p class="hq">“${esc(h.msg)}”</p>${h.unix ? `<span class="hd">${esc(fmtDay(h.unix))}</span>` : ''}</div>`).join('')}</div>`
    : '';

  let n = 0;
  const navLinks: string[] = [];
  const daysHtml = [...byDay.entries()].map(([, list]) => {
    n++;
    const id = `day-${n}`;
    const label = dayNames[n] ?? `Day ${n}`;
    const dayLabel = list[0].startUnix ? fmtDay(list[0].startUnix) : 'Undated';
    navLinks.push(`<a href="#${id}">${esc(dayLabel.split(',')[0])}</a>`);
    const cards = list.map((c) => {
      const turns = c.turns.map((t) => {
        const who = t.role === 'user' ? 'Kane' : 'Cole';
        const cls = t.role === 'user' ? 'k' : 'c';
        return `<div class="turn ${cls}"><span class="who">${who}</span><p>${esc(t.message)}</p></div>`;
      }).join('');
      const when = c.startUnix ? fmtTime(c.startUnix) : '';
      const count = c.turns.length;
      return `<details class="conv" open><summary class="chd"><span class="ct">${esc(titleFor(c))}</span><span class="cw">${when} · ${count} lines</span></summary>${turns}</details>`;
    }).join('');
    return `<section id="${id}"><h2>${label}</h2><div class="day">${dayLabel}</div>${cards}</section>`;
  }).join('');

  const empty = withText.length === 0
    ? `<div class="conv-empty"><p class="ct">No conversations yet</p><p class="em">Once Kane talks to Cole, every chat shows up here — kept by day, forever.</p></div>`
    : '';

  const nDays = byDay.size;
  const stats = withText.length
    ? `${withText.length} conversation${withText.length === 1 ? '' : 's'} · ${nDays} day${nDays === 1 ? '' : 's'}`
    : '';
  const dateLine = first ? fmtRange(first, last) : '';
  const tagline = opts.tagline ?? opts.subtitle;

  const nav = withText.length
    ? `<div class="nav"><span class="navname">${esc(opts.eventTitle)}</span><nav class="navdays">${navLinks.join('')}</nav><button class="pdf" onclick="window.print()">Save PDF</button></div>`
    : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(opts.eventTitle)} · The Story of Kane</title>
<style>
  :root{ --paper:#fbf7f0; --ink:#26211b; --mut:#7c7264; --gold:#c8862a; --goldd:#a76d1e; --line:#e7ddcd; --card:#fff; --kane:#2b3342; --cole:#8a5a1e; }
  *{ box-sizing:border-box; } html,body{ margin:0; scroll-behavior:smooth; overflow-x:hidden; }
  body{ background:var(--paper); color:var(--ink); font:16px/1.65 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; -webkit-font-smoothing:antialiased; }
  a{ color:inherit; }
  h1,.ct,.hq,.turn p,.navname{ overflow-wrap:anywhere; }
  .nav{ position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:14px; flex-wrap:wrap;
    background:rgba(251,247,240,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--line);
    padding:10px 20px; font-family:-apple-system,Segoe UI,Roboto,sans-serif; }
  .navname{ font-weight:700; font-size:14px; }
  .navdays{ display:flex; gap:12px; flex:1; flex-wrap:wrap; }
  .navdays a{ font-size:13px; color:var(--goldd); text-decoration:none; }
  .navdays a:hover{ text-decoration:underline; }
  .pdf{ font:inherit; font-size:13px; border:1px solid var(--gold); color:var(--goldd); background:#fff;
    border-radius:999px; padding:5px 14px; cursor:pointer; }
  .pdf:hover{ background:#fbeed3; }
  .page{ max-width:760px; margin:0 auto; padding:40px 26px 80px; }
  .cover{ text-align:center; padding:6px 0 34px; border-bottom:1px solid var(--line); }
  .wordmark{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-weight:800; font-size:30px; letter-spacing:.28em;
    color:var(--goldd); margin:6px 0 20px; text-indent:.28em; }
  .kicker{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; letter-spacing:.32em; text-transform:uppercase; font-size:12.5px; color:var(--gold); font-weight:700; }
  .chapter{ font-size:15px; color:var(--mut); font-style:italic; margin-top:12px; }
  h1{ font-size:52px; line-height:1.05; margin:6px 0 10px; letter-spacing:-.01em; }
  .dateline{ color:var(--ink); font-size:17px; }
  .stats{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:13px; color:var(--mut); margin-top:6px; letter-spacing:.02em; }
  .tag{ color:var(--mut); font-size:14px; font-style:italic; margin-top:4px; }
  .rule{ width:56px; height:3px; background:var(--gold); border-radius:3px; margin:20px auto 0; }
  h2{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:13px; letter-spacing:.2em; text-transform:uppercase; color:var(--gold); font-weight:700; margin:46px 0 4px; }
  .day{ font-size:26px; margin:6px 0 14px; scroll-margin-top:64px; }
  section{ scroll-margin-top:60px; }

  .hls{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; }
  .hl{ background:linear-gradient(180deg,#fff,#fdf7ea); border:1px solid var(--line); border-left:4px solid var(--gold);
    border-radius:12px; padding:14px 16px; }
  .hq{ margin:0; font-size:18px; line-height:1.4; }
  .hd{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--gold); }

  .conv{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:6px 20px 16px; margin:14px 0; box-shadow:0 2px 12px rgba(120,90,30,.05); }
  .conv[open]{ padding-bottom:18px; }
  .chd{ display:flex; align-items:baseline; justify-content:space-between; gap:8px 12px; cursor:pointer; list-style:none;
    padding:12px 0 10px; flex-wrap:wrap; }
  .chd::-webkit-details-marker{ display:none; }
  .conv[open] .chd{ border-bottom:1px dashed var(--line); margin-bottom:10px; }
  .ct{ font-size:20px; flex:1 1 auto; min-width:0; }
  .cw{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:12.5px; color:var(--mut); white-space:nowrap; flex:0 0 auto; }
  .conv,.hl,.page,.cover,.nav{ max-width:100%; }
  svg,img{ max-width:100%; height:auto; }
  .hl{ min-width:0; }
  .turn{ margin:9px 0; font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:15px; line-height:1.55; }
  .who{ font-weight:700; font-size:12px; letter-spacing:.04em; text-transform:uppercase; }
  .turn.k .who{ color:var(--kane); } .turn.c .who{ color:var(--cole); }
  .turn p{ margin:2px 0 0; }
  .conv-empty{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:26px; text-align:center; margin-top:20px; }
  .conv-empty .ct{ font-size:22px; } .conv-empty .em{ color:var(--mut); }

  .foot{ text-align:center; margin-top:60px; padding-top:26px; border-top:1px solid var(--line); color:var(--mut); }
  .foot .m1{ font-size:18px; font-style:italic; color:var(--ink); }
  .foot .m2{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:12px; letter-spacing:.14em; text-transform:uppercase; margin-top:10px; color:var(--gold); }

  @media (max-width:560px){ .hls{ grid-template-columns:1fr; } h1{ font-size:34px; } .navdays{ display:none; } .page{ padding-left:20px; padding-right:20px; } }
  @media print{ .nav{ display:none; } body{ background:#fff; } .conv,.hl{ box-shadow:none; } .conv{ break-inside:avoid; } }
</style></head><body>
${nav}
<div class="page">
  <div class="cover">
    <div class="wordmark">COLE</div>
    <div class="kicker">The Story of Kane</div>
    <div class="chapter">${esc(opts.chapter)}</div>
    <h1>${esc(opts.eventTitle)}</h1>
    ${dateLine ? `<div class="dateline">${esc(dateLine)}</div>` : ''}
    ${stats ? `<div class="stats">${esc(stats)}</div>` : ''}
    ${tagline ? `<div class="tag">${esc(tagline)}</div>` : ''}
    <div class="rule"></div>
  </div>
  ${highlightsHtml}
  ${daysHtml}${empty}
  <div class="foot"><div class="m1">"Every journey deserves to be remembered."</div><div class="m2">The Story of Me</div></div>
</div></body></html>`;
}

// ---- public entry ----
export async function buildKeepsakeHTML(options: { debug?: boolean } = {}): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID ?? 'agent_0501kzf5d5d8eaga0kxsmh0ky1hs';
  const eventTitle = process.env.KEEPSAKE_EVENT_TITLE ?? 'Boots & Hearts 2026';
  const subtitle = process.env.KEEPSAKE_SUBTITLE ?? 'Kane · with Cole';
  const chapter = process.env.KEEPSAKE_CHAPTER ?? 'Chapter One';

  if (!key) {
    if (options.debug) return `<pre>key set: NO — add ELEVENLABS_API_KEY in Render</pre>`;
    return renderPage([], { eventTitle, chapter, subtitle: 'Set ELEVENLABS_API_KEY to load the real conversations.' });
  }

  // Diagnostic view (no conversation content) — shows why the list may be empty.
  if (options.debug) {
    try {
      const all = await listConversations(key, null);
      const filtered = await listConversations(key, agentId);
      const byAgent = new Map<string, number>();
      for (const c of all) byAgent.set(c.agentId, (byAgent.get(c.agentId) ?? 0) + 1);
      const lines = [...byAgent.entries()].map(([a, n]) => `  ${a || '(none)'} — ${n}`).join('\n');
      return `<pre>key set: yes
configured agent_id: ${esc(agentId)}
conversations WITH that agent filter: ${filtered.length}
conversations account-wide (all agents): ${all.length}
agent_ids this key can see:
${esc(lines || '  (none)')}
</pre>`;
    } catch (err) {
      return `<pre>key set: yes, but the list call failed: ${esc(String((err as Error).message ?? err))}</pre>`;
    }
  }

  try {
    // Prefer the configured agent; if that yields nothing, fall back to account-wide
    // so Kane's chats still show even if the agent id differs slightly.
    let ids = await listConversations(key, agentId);
    if (ids.length === 0) ids = await listConversations(key, null);
    const convos: Convo[] = [];
    for (const it of ids) {
      const c = await getConversation(key, it.id, it.startUnix);
      if (c && c.turns.length) convos.push(c);
    }
    return renderPage(convos, { eventTitle, chapter, subtitle });
  } catch (err) {
    return renderPage([], { eventTitle, chapter, subtitle: `Couldn't load conversations right now (${esc(String((err as Error).message ?? err))}).` });
  }
}
