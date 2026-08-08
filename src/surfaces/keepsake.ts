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
async function listConversationIds(key: string, agentId: string): Promise<Array<{ id: string; startUnix: number }>> {
  const out: Array<{ id: string; startUnix: number }> = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 50; guard++) {
    const url = new URL('/v1/convai/conversations', API);
    url.searchParams.set('agent_id', agentId);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: { 'xi-api-key': key } });
    if (!res.ok) throw new Error(`list failed (${res.status})`);
    const data: any = await res.json();
    const items: any[] = data?.conversations ?? data?.items ?? [];
    for (const c of items) {
      const id = c?.conversation_id ?? c?.id;
      if (id) out.push({ id, startUnix: Number(c?.start_time_unix_secs ?? c?.created_at_unix_secs ?? 0) });
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
function dayKey(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toISOString().slice(0, 10);
}
function fmtDay(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}
function titleFor(c: Convo): string {
  const firstUser = c.turns.find((t) => t.role === 'user' && t.message.length > 1);
  const src = firstUser?.message ?? c.turns[0]?.message ?? 'A chat with Cole';
  const words = src.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
  return words.length < src.length ? words + '…' : words;
}

// ---- render ----
function renderPage(convos: Convo[], opts: { eventTitle: string; chapter: string; subtitle: string }): string {
  const withText = convos.filter((c) => c.turns.length > 0).sort((a, b) => a.startUnix - b.startUnix);
  // group by day
  const byDay = new Map<string, Convo[]>();
  for (const c of withText) {
    const k = c.startUnix ? dayKey(c.startUnix) : 'undated';
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(c);
  }
  const dayNames = ['', 'Day One', 'Day Two', 'Day Three', 'Day Four', 'Day Five', 'Day Six', 'Day Seven'];
  let n = 0;
  const daysHtml = [...byDay.entries()].map(([, list]) => {
    n++;
    const label = dayNames[n] ?? `Day ${n}`;
    const dayLabel = list[0].startUnix ? fmtDay(list[0].startUnix) : 'Undated';
    const cards = list.map((c) => {
      const turns = c.turns.map((t) => {
        const who = t.role === 'user' ? 'Kane' : 'Cole';
        const cls = t.role === 'user' ? 'k' : 'c';
        return `<div class="turn ${cls}"><span class="who">${who}</span><p>${esc(t.message)}</p></div>`;
      }).join('');
      const when = c.startUnix ? `${fmtTime(c.startUnix)}` : '';
      return `<div class="conv"><div class="chd"><p class="ct">${esc(titleFor(c))}</p><span class="cw">${when}</span></div>${turns}</div>`;
    }).join('');
    return `<h2>${label}</h2><div class="day">${dayLabel}</div>${cards}`;
  }).join('');

  const empty = withText.length === 0
    ? `<div class="conv"><p class="ct">No conversations yet</p><div class="turn c"><span class="who">Cole</span><p>Once Kane talks to me, every chat shows up here — kept by day, forever.</p></div></div>`
    : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(opts.eventTitle)} · The Story of Kane</title>
<style>
  :root{ --paper:#fbf7f0; --ink:#26211b; --mut:#7c7264; --gold:#c8862a; --line:#e7ddcd; --card:#fff; --kane:#2b3342; --cole:#8a5a1e; }
  *{ box-sizing:border-box; } html,body{ margin:0; }
  body{ background:var(--paper); color:var(--ink); font:16px/1.65 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; -webkit-font-smoothing:antialiased; }
  .page{ max-width:760px; margin:0 auto; padding:56px 26px 80px; }
  .cover{ text-align:center; padding:6px 0 40px; border-bottom:1px solid var(--line); }
  .kicker{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; letter-spacing:.32em; text-transform:uppercase; font-size:12.5px; color:var(--gold); font-weight:700; }
  .chapter{ font-size:15px; color:var(--mut); font-style:italic; margin-top:14px; }
  h1{ font-size:52px; line-height:1.05; margin:6px 0 8px; letter-spacing:-.01em; }
  .meta{ color:var(--mut); font-size:15px; } .meta b{ color:var(--ink); font-weight:600; }
  .rule{ width:56px; height:3px; background:var(--gold); border-radius:3px; margin:22px auto 0; }
  h2{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:13px; letter-spacing:.2em; text-transform:uppercase; color:var(--gold); font-weight:700; margin:48px 0 4px; }
  .day{ font-size:26px; margin:6px 0 14px; }
  .conv{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px 20px; margin:16px 0; box-shadow:0 2px 12px rgba(120,90,30,.05); }
  .conv .chd{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; border-bottom:1px dashed var(--line); padding-bottom:10px; margin-bottom:12px; }
  .conv .ct{ font-size:20px; margin:0; }
  .conv .cw{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:12.5px; color:var(--mut); white-space:nowrap; }
  .turn{ margin:9px 0; font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:15px; line-height:1.55; }
  .who{ font-weight:700; font-size:12px; letter-spacing:.04em; text-transform:uppercase; }
  .turn.k .who{ color:var(--kane); } .turn.c .who{ color:var(--cole); }
  .turn p{ margin:2px 0 0; }
  .foot{ text-align:center; margin-top:60px; padding-top:26px; border-top:1px solid var(--line); color:var(--mut); }
  .foot .m1{ font-size:18px; font-style:italic; color:var(--ink); }
  .foot .m2{ font-family:-apple-system,Segoe UI,Roboto,sans-serif; font-size:12px; letter-spacing:.14em; text-transform:uppercase; margin-top:10px; color:var(--gold); }
  @media print{ body{ background:#fff; } .conv,.foot{ box-shadow:none; } }
</style></head><body><div class="page">
  <div class="cover">
    <div class="kicker">The Story of Kane</div>
    <div class="chapter">${esc(opts.chapter)}</div>
    <h1>${esc(opts.eventTitle)}</h1>
    <div class="meta">${esc(opts.subtitle)}</div>
    <div class="rule"></div>
  </div>
  ${daysHtml}${empty}
  <div class="foot"><div class="m1">"Every journey deserves to be remembered."</div><div class="m2">The Story of Me</div></div>
</div></body></html>`;
}

// ---- public entry ----
export async function buildKeepsakeHTML(): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID ?? 'agent_0501kzf5d5d8eaga0kxsmh0ky1hs';
  const eventTitle = process.env.KEEPSAKE_EVENT_TITLE ?? 'Boots & Hearts 2026';
  const subtitle = process.env.KEEPSAKE_SUBTITLE ?? 'Kane · with Cole';
  const chapter = process.env.KEEPSAKE_CHAPTER ?? 'Chapter One';

  if (!key) {
    return renderPage([], { eventTitle, chapter, subtitle: 'Set ELEVENLABS_API_KEY to load the real conversations.' });
  }
  try {
    const ids = await listConversationIds(key, agentId);
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
