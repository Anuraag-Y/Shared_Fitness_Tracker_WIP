/* The Board — shared workout tracker.
   Talks to Supabase over plain REST. No build step, no dependencies. */

const C = window.CONFIG;
const H = {
  apikey: C.SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + C.SUPABASE_ANON_KEY,
  'Content-Type': 'application/json'
};

async function get(table, query) {
  const r = await fetch(`${C.SUPABASE_URL}/rest/v1/${table}?${query || 'select=*'}`, { headers: H });
  if (!r.ok) throw new Error(table + ': ' + await r.text());
  return r.json();
}
async function post(table, body) {
  const r = await fetch(`${C.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: Object.assign({ Prefer: 'return=representation' }, H), body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(table + ': ' + await r.text());
  return r.json();
}
async function patch(table, query, body) {
  const r = await fetch(`${C.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH', headers: Object.assign({ Prefer: 'return=representation' }, H), body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(table + ': ' + await r.text());
  return r.json();
}

/* ---------- state ---------- */

const SPLITS = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Chest', 'Back', 'Arms', 'Shoulders', 'Full body', 'Cardio'];
const ROASTS = [
  'Gym bag officially load-bearing furniture at this point.',
  'Has not moved a plate since the last presidential address.',
  'Sending the group chat memes from the couch. Bold strategy.',
  'The treadmill filed a missing persons report.',
  'Rest week number four and counting.'
];

const S = {
  me: localStorage.getItem('board.user') || null,
  unit: localStorage.getItem('board.unit') || 'lb',
  screen: 'board',
  personId: null,
  members: [], sessions: [], prs: [], weights: [],
  draft: { split: '', note: '', weight: '', rows: [blankRow()] },
  msg: '', error: ''
};
function blankRow() { return { ex: '', sets: '', reps: '', weight: '' }; }

/* ---------- dates ---------- */

const today = () => new Date();
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function weekStart(back) {
  const d = today(); const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow - 7 * (back || 0)); d.setHours(0, 0, 0, 0); return d;
}
function inWeek(dateStr, back) {
  const s = weekStart(back), e = new Date(s); e.setDate(e.getDate() + 7);
  const d = new Date(dateStr + 'T12:00:00'); return d >= s && d < e;
}
const short = s => { const d = new Date(s + 'T12:00:00'); return (d.getMonth() + 1) + '/' + d.getDate(); };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/* ---------- units ---------- */

const toLb = v => S.unit === 'kg' ? Number(v) * 2.2046 : Number(v);
const show = lb => S.unit === 'kg' ? Math.round(lb / 2.2046) : Math.round(lb);
const show1 = lb => S.unit === 'kg' ? Math.round(lb / 2.2046 * 10) / 10 : Math.round(lb * 10) / 10;

/* ---------- derived ---------- */

const sessionsOf = id => S.sessions.filter(s => s.member_id === id);
const weightsOf = id => S.weights.filter(w => w.member_id === id).sort((a, b) => a.date < b.date ? -1 : 1);

function score(m) {
  const n = sessionsOf(m.id).filter(s => inWeek(s.date, 0)).length;
  return { n, pts: n + (n >= (m.goal || 4) ? C.GOAL_BONUS : 0) };
}
function streak(m) {
  let n = 0;
  for (let o = 0; o < 26; o++) {
    const c = sessionsOf(m.id).filter(s => inWeek(s.date, o)).length;
    if (c >= (o === 0 ? 1 : (m.goal || 4))) n++; else break;
  }
  return n;
}
function bestPRs(id) {
  const out = {};
  S.prs.filter(p => p.member_id === id).forEach(p => {
    if (!out[p.lift] || Number(p.weight) > Number(out[p.lift].weight)) out[p.lift] = p;
  });
  return out;
}
function improvement(id) {
  const byLift = {};
  S.prs.filter(p => p.member_id === id).forEach(p => {
    (byLift[p.lift] = byLift[p.lift] || []).push(p);
  });
  let gain = 0;
  Object.values(byLift).forEach(list => {
    list.sort((a, b) => a.date < b.date ? -1 : 1);
    const recent = list.filter(p => {
      const d = new Date(p.date + 'T12:00:00');
      return (Date.now() - d.getTime()) < 1000 * 60 * 60 * 24 * 42;
    });
    if (recent.length > 1) gain += Number(recent[recent.length - 1].weight) - Number(recent[0].weight);
  });
  return gain;
}

/* ---------- render helpers ---------- */

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = () => document.getElementById('app');
const set = html => { el().innerHTML = html; };

/* ---------- screens ---------- */

function viewLogin() {
  set(`
  <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(120% 80% at 20% 0%, #1d2036 0%, var(--color-bg) 60%)">
    <div style="width:100%;max-width:380px">
      <div class="mono" style="font-size:12px;letter-spacing:.22em;color:var(--color-accent);text-transform:uppercase">The Board</div>
      <h1 style="font-family:var(--font-heading);font-weight:500;font-size:34px;line-height:1.1;margin:12px 0 6px;letter-spacing:-.02em">Nobody skips quietly.</h1>
      <p style="margin:0 0 28px;font-size:14px;line-height:1.55;color:var(--color-neutral-400)">Shared workout log. Sessions, PRs, bodyweight — everyone sees everything.</p>
      <div style="display:flex;flex-direction:column;gap:14px">
        <label style="display:flex;flex-direction:column;gap:6px">
          <span class="kicker">Your name</span>
          <input id="u" placeholder="" autocapitalize="words" autocomplete="off">
        </label>
        <label style="display:flex;flex-direction:column;gap:6px">
          <span class="kicker">Group code</span>
          <input id="c" class="mono" placeholder="" style="letter-spacing:.08em" autocapitalize="characters">
        </label>
        <button class="outline" data-act="login" style="margin-top:6px">Enter the group</button>
        <div id="err" style="font-size:12px;color:var(--color-accent-300);min-height:16px"></div>
        <div style="font-size:12px;color:var(--color-neutral-600);line-height:1.5">First time? Type your name and it makes your account.</div>
        ${S.members.length ? `<div class="kicker" style="margin-top:8px">Already here</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${S.members.map(m => `<button class="chip" data-act="quick" data-id="${esc(m.id)}">${esc(m.name)}</button>`).join('')}
        </div>` : ''}
      </div>
    </div>
  </div>`);
}

function chrome(inner) {
  const me = S.members.find(m => m.id === S.me) || { name: '?' };
  const tabs = [['board', 'Board'], ['log', 'Log'], ['people', 'People'], ['history', 'History']];
  set(`
  <div style="min-height:100vh">
    <div style="position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 20px;background:rgba(22,24,38,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--color-neutral-900)">
      <div class="mono" style="font-size:11px;letter-spacing:.22em;color:var(--color-accent);text-transform:uppercase;white-space:nowrap">The Board</div>
      <div style="display:flex;gap:2px;flex-wrap:wrap">
        ${tabs.map(t => `<button class="ghost" data-act="go" data-screen="${t[0]}" data-on="${S.screen === t[0] ? 1 : 0}">${t[1]}</button>`).join('')}
      </div>
      <div style="flex:1"></div>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="chip mono" data-act="unit" style="font-size:11px;padding:5px 9px">${S.unit}</button>
        <button data-act="logout" style="display:flex;align-items:center;gap:7px;padding:4px 10px 4px 4px;background:transparent;border:1px solid var(--color-neutral-800);border-radius:999px">
          <span style="width:22px;height:22px;display:grid;place-items:center;font-size:11px;color:var(--color-accent-200);background:var(--color-accent-800);border-radius:999px">${esc(me.name[0])}</span>
          <span style="font-size:12px;color:var(--color-neutral-300)">${esc(me.name)}</span>
        </button>
      </div>
    </div>
    <div style="max-width:1120px;margin:0 auto;padding:28px 20px 90px">${inner}</div>
  </div>`);
}

function viewBoard() {
  const ranked = S.members.map(m => Object.assign({ m }, score(m))).sort((a, b) => b.pts - a.pts || b.n - a.n);
  if (!ranked.length) return chrome(`<p style="color:var(--color-neutral-400)">Nobody has joined yet.</p>`);
  const last = ranked[ranked.length - 1];
  const imps = S.members.map(m => ({ m, gain: improvement(m.id) })).sort((a, b) => b.gain - a.gain);
  const prFeed = S.prs.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 5);
  const acts = S.sessions.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 7);
  const name = id => (S.members.find(m => m.id === id) || {}).name || id;

  chrome(`
  <div style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:22px">
    <h1 class="h1">This week</h1>
    <div class="mono" style="font-size:12px;color:var(--color-neutral-600)">Week of ${weekStart(0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · resets Monday</div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:26px">
    <div class="card">
      <div class="kicker" style="color:var(--color-accent-400);margin-bottom:10px">Leading</div>
      <div style="font-family:var(--font-heading);font-weight:500;font-size:22px">${esc(ranked[0].m.name)}</div>
      <div style="font-size:13px;color:var(--color-neutral-400);margin-top:5px">${plural(ranked[0].pts, 'pt')} · ${plural(ranked[0].n, 'session')}</div>
    </div>
    <div class="card">
      <div class="kicker" style="color:var(--color-accent-400);margin-bottom:10px">Most improved</div>
      <div style="font-family:var(--font-heading);font-weight:500;font-size:22px">${esc(imps[0].gain > 0 ? imps[0].m.name : '—')}</div>
      <div style="font-size:13px;color:var(--color-neutral-400);margin-top:5px">${imps[0].gain > 0 ? '+' + show(imps[0].gain) + S.unit + ' across six weeks' : 'Log some PRs to start this'}</div>
    </div>
    <div class="card" style="background:linear-gradient(160deg,#2b2741 0%,var(--color-surface) 70%)">
      <div class="kicker" style="color:var(--color-accent-300);margin-bottom:10px">Dust Collector</div>
      <div style="font-family:var(--font-heading);font-weight:500;font-size:22px">${esc(ranked.length > 1 ? last.m.name : '—')}</div>
      <div style="font-size:13px;color:var(--color-neutral-300);margin-top:5px;line-height:1.45">${ranked.length > 1 ? esc(ROASTS[last.m.name.length % ROASTS.length]) : 'Needs at least two of you. Send the group code around.'}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:26px;align-items:start">
    <div>
      <div class="kicker" style="margin-bottom:12px">Leaderboard</div>
      ${ranked.map((r, i) => `
        <button class="row" data-act="person" data-id="${esc(r.m.id)}">
          <span class="mono" style="font-size:13px;color:var(--color-neutral-600)">${i + 1}</span>
          <span style="min-width:0">
            <span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:15px">${esc(r.m.name)}</span>
              ${i === ranked.length - 1 && ranked.length > 1 ? `<span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;color:var(--color-accent-200);background:var(--color-accent-800);border-radius:999px">Dust Collector</span>` : ''}
            </span>
            <span style="display:block;margin-top:5px;height:3px;background:var(--color-neutral-900);border-radius:999px;overflow:hidden">
              <span style="display:block;height:3px;background:var(--color-accent);width:${Math.round(Math.min(1, r.n / (r.m.goal || 4)) * 100)}%"></span>
            </span>
            <span class="mono" style="display:block;font-size:11px;color:var(--color-neutral-600);margin-top:5px">${r.n}/${r.m.goal || 4} sessions · ${plural(streak(r.m), 'week')} streak</span>
          </span>
          <span style="font-family:var(--font-heading);font-weight:500;font-size:20px">${r.pts}</span>
        </button>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;gap:26px">
      <div>
        <div class="kicker" style="margin-bottom:12px">Recent PRs</div>
        ${prFeed.length ? prFeed.map(p => `
          <div style="display:flex;gap:10px;align-items:baseline;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid var(--color-neutral-900)">
            <div style="flex:1;min-width:0">
              <div style="font-size:14px">${esc(name(p.member_id))} — ${esc(p.lift)}</div>
              <div class="mono" style="font-size:11px;color:var(--color-neutral-600);margin-top:3px">${show(p.weight)}${S.unit} × ${p.reps} · ${short(p.date)}</div>
            </div>
          </div>`).join('') : `<div style="font-size:13px;color:var(--color-neutral-600)">No PRs logged yet.</div>`}
      </div>
      <div>
        <div class="kicker" style="margin-bottom:12px">Latest activity</div>
        ${acts.map(a => `
          <div style="display:flex;gap:10px;align-items:baseline;margin-bottom:12px">
            <span class="mono" style="font-size:11px;color:var(--color-neutral-700);width:46px;flex-shrink:0">${short(a.date)}</span>
            <span style="font-size:13px;color:var(--color-neutral-300);line-height:1.45">${esc(name(a.member_id))} · ${esc(a.split || '')} — ${esc(a.note || '')}</span>
          </div>`).join('') || `<div style="font-size:13px;color:var(--color-neutral-600)">Nothing logged yet.</div>`}
      </div>
    </div>
  </div>`);
}

function viewLog() {
  const d = S.draft;
  chrome(`
  <div style="max-width:620px">
    <h1 class="h1" style="margin-bottom:4px">Log a session</h1>
    <p style="margin:0 0 24px;font-size:13px;color:var(--color-neutral-500)">${today().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

    <div class="kicker" style="margin-bottom:10px">What did you train</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:24px">
      ${SPLITS.map(s => `<button class="chip" data-act="split" data-v="${s}" data-on="${d.split === s ? 1 : 0}">${s}</button>`).join('')}
    </div>

    <div class="kicker" style="margin-bottom:10px">Quick note</div>
    <textarea id="note" rows="3" placeholder="4x chest press 170lb, 3x incline db 60s, burnout flyes" style="width:100%;line-height:1.5;resize:vertical;border-radius:var(--radius-md)">${esc(d.note)}</textarea>

    <div style="display:flex;align-items:center;justify-content:space-between;margin:26px 0 10px">
      <div class="kicker">Sets (optional)</div>
      <button class="chip" data-act="addrow" style="font-size:12px;border-radius:var(--radius-sm)">Add row</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${d.rows.map((r, i) => `
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 56px 56px 70px 28px;gap:6px;align-items:center">
          <input data-row="${i}" data-k="ex" value="${esc(r.ex)}" placeholder="Exercise" style="font-size:13px">
          <input data-row="${i}" data-k="sets" value="${esc(r.sets)}" placeholder="sets" class="mono" style="font-size:13px;text-align:center" inputmode="numeric">
          <input data-row="${i}" data-k="reps" value="${esc(r.reps)}" placeholder="reps" class="mono" style="font-size:13px;text-align:center" inputmode="numeric">
          <input data-row="${i}" data-k="weight" value="${esc(r.weight)}" placeholder="${S.unit}" class="mono" style="font-size:13px;text-align:center" inputmode="decimal">
          <button data-act="delrow" data-i="${i}" style="background:transparent;border:none;color:var(--color-neutral-600);font-size:15px">×</button>
        </div>`).join('')}
    </div>
    <div style="font-size:12px;color:var(--color-neutral-600);margin-top:10px;line-height:1.5">Rows that beat your current best are saved as a PR automatically.</div>

    <div style="margin-top:26px;padding-top:22px;border-top:1px solid var(--color-neutral-900);display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <label style="display:flex;flex-direction:column;gap:6px">
        <span class="kicker">Bodyweight (${S.unit})</span>
        <input id="bw" value="${esc(d.weight)}" placeholder="—" class="mono" style="width:110px" inputmode="decimal">
      </label>
      <div style="flex:1"></div>
      <button class="outline" data-act="save">Save session</button>
    </div>
    <div style="margin-top:14px;font-size:13px;color:var(--color-accent-300);min-height:18px">${esc(S.msg)}</div>
  </div>`);
}

function viewPeople() {
  chrome(`
  <h1 class="h1" style="margin-bottom:22px">The group</h1>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">
    ${S.members.map(m => {
      const s = score(m); const w = weightsOf(m.id).slice(-1)[0];
      return `<button class="card" data-act="person" data-id="${esc(m.id)}" style="text-align:left;border:none">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:12px">
          <span style="width:26px;height:26px;display:grid;place-items:center;font-size:12px;color:var(--color-accent-200);background:var(--color-accent-800);border-radius:999px">${esc(m.name[0])}</span>
          <span style="font-size:16px">${esc(m.name)}</span>
        </div>
        <div class="mono" style="font-size:12px;color:var(--color-neutral-500);line-height:1.7">
          ${s.n}/${m.goal || 4} this week · ${plural(s.pts, 'pt')}<br>
          ${w ? show1(w.lb) + S.unit + ' · ' : ''}${sessionsOf(m.id).length} sessions logged
        </div>
      </button>`;
    }).join('')}
  </div>`);
}

function viewPerson() {
  const p = S.members.find(m => m.id === S.personId);
  if (!p) return viewPeople();
  const s = score(p), mine = p.id === S.me;
  const bw = weightsOf(p.id).slice(-10);
  const lo = bw.length ? Math.min(...bw.map(x => Number(x.lb))) - 3 : 0;
  const hi = bw.length ? Math.max(...bw.map(x => Number(x.lb))) + 1 : 1;
  const counts = [5, 4, 3, 2, 1, 0].map(o => sessionsOf(p.id).filter(x => inWeek(x.date, o)).length);
  const mx = Math.max(1, ...counts);
  const best = bestPRs(p.id);
  const log = sessionsOf(p.id).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 15);

  chrome(`
  <button data-act="go" data-screen="people" style="padding:0;margin-bottom:16px;font-size:12px;color:var(--color-neutral-500);background:transparent;border:none">← Everyone</button>
  <div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px">
    <h1 class="h1" style="font-size:32px">${esc(p.name)}</h1>
    <div style="font-size:13px;color:var(--color-neutral-500)">${s.n}/${p.goal || 4} this week · ${plural(s.pts, 'pt')} · ${plural(streak(p), 'week')} streak</div>
  </div>
  <div style="font-size:13px;color:var(--color-neutral-400);margin-bottom:28px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    <span>Weekly goal: ${p.goal || 4} sessions.</span>
    ${mine ? `<button class="chip" data-act="goal" style="font-size:12px;padding:3px 10px">Change</button>` : ''}
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:26px;align-items:start">
    <div>
      <div class="kicker" style="margin-bottom:14px">Bodyweight (${S.unit})</div>
      ${bw.length ? `
      <div style="display:flex;align-items:flex-end;gap:5px;height:120px">
        ${bw.map(x => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%">
          <div class="mono" style="font-size:9px;color:var(--color-neutral-600);text-align:center;margin-bottom:4px">${show1(x.lb)}</div>
          <div style="background:var(--color-accent-700);border-radius:2px 2px 0 0;height:${Math.max(4, Math.round((Number(x.lb) - lo) / (hi - lo) * 96))}px"></div>
        </div>`).join('')}
      </div>
      <div class="mono" style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-neutral-700);margin-top:6px">
        <span>${short(bw[0].date)}</span><span>${short(bw[bw.length - 1].date)}</span>
      </div>` : `<div style="font-size:13px;color:var(--color-neutral-600)">No weigh-ins yet.</div>`}

      <div class="kicker" style="margin:30px 0 12px">Sessions per week</div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:70px">
        ${counts.map((c, i) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:4px">
          <div style="background:${i === 5 ? 'var(--color-accent)' : 'var(--color-neutral-700)'};border-radius:2px 2px 0 0;height:${Math.max(3, Math.round(c / mx * 56))}px"></div>
          <div class="mono" style="font-size:9px;color:var(--color-neutral-700);text-align:center">${i === 5 ? 'now' : (5 - i) + 'w'}</div>
        </div>`).join('')}
      </div>
    </div>

    <div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="kicker">Personal records</div>
        ${mine ? `<button class="chip" data-act="addpr" style="font-size:12px;padding:3px 10px">Add PR</button>` : ''}
      </div>
      ${C.LIFTS.map(l => {
        const r = best[l];
        return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--color-neutral-900)">
          <span style="font-size:14px;color:var(--color-neutral-200)">${esc(l)}</span>
          <span style="text-align:right;white-space:nowrap">
            <span class="mono" style="font-size:14px">${r ? show(r.weight) + S.unit + ' × ' + r.reps : '—'}</span>
            ${r ? `<span class="mono" style="display:block;font-size:10px;color:var(--color-neutral-600);margin-top:2px">set ${short(r.date)}</span>` : ''}
          </span>
        </div>`;
      }).join('')}
      ${Object.keys(best).filter(l => !C.LIFTS.includes(l)).map(l => `
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:11px 0;border-top:1px solid var(--color-neutral-900)">
          <span style="font-size:14px;color:var(--color-neutral-200)">${esc(l)}</span>
          <span class="mono" style="font-size:14px">${show(best[l].weight)}${S.unit} × ${best[l].reps}</span>
        </div>`).join('')}

      <div class="kicker" style="margin:30px 0 10px">History</div>
      ${log.length ? log.map(x => `
        <div style="padding:11px 0;border-top:1px solid var(--color-neutral-900)">
          <div style="display:flex;gap:10px;align-items:baseline">
            <span class="mono" style="font-size:11px;color:var(--color-neutral-600);width:52px;flex-shrink:0">${short(x.date)}</span>
            <span style="font-size:13px;color:var(--color-accent-300)">${esc(x.split || '')}</span>
          </div>
          <div style="font-size:13px;color:var(--color-neutral-400);line-height:1.5;margin:4px 0 0 62px">${esc(x.note || '')}</div>
        </div>`).join('') : `<div style="font-size:13px;color:var(--color-neutral-600)">Nothing logged yet.</div>`}
    </div>
  </div>`);
}

function viewHistory() {
  const labels = [5, 4, 3, 2, 1, 0].map(o => weekStart(o).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }));
  chrome(`
  <h1 class="h1" style="margin-bottom:4px">History</h1>
  <p style="margin:0 0 26px;font-size:13px;color:var(--color-neutral-500)">Sessions logged per week, last six weeks.</p>
  ${S.members.map(m => {
    const counts = [5, 4, 3, 2, 1, 0].map(o => sessionsOf(m.id).filter(s => inWeek(s.date, o)).length);
    const mx = Math.max(1, ...counts);
    return `<div style="display:grid;grid-template-columns:100px minmax(0,1fr) 50px;gap:14px;align-items:center;padding:14px 0;border-top:1px solid var(--color-neutral-900)">
      <span style="font-size:14px;color:var(--color-neutral-200)">${esc(m.name)}</span>
      <span style="display:flex;align-items:flex-end;gap:5px;height:44px">
        ${counts.map((c, i) => `<span style="flex:1;display:block;background:${i === 5 ? 'var(--color-accent)' : 'var(--color-neutral-700)'};border-radius:2px;height:${Math.max(3, Math.round(c / mx * 44))}px"></span>`).join('')}
      </span>
      <span class="mono" style="font-size:13px;color:var(--color-neutral-500);text-align:right">${counts.reduce((a, b) => a + b, 0)}</span>
    </div>`;
  }).join('')}
  <div style="display:grid;grid-template-columns:100px minmax(0,1fr) 50px;gap:14px;margin-top:8px">
    <span></span>
    <span class="mono" style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-neutral-700)">${labels.map(l => `<span>${l}</span>`).join('')}</span>
    <span></span>
  </div>`);
}

function render() {
  if (!S.me) return viewLogin();
  if (S.screen === 'log') return viewLog();
  if (S.screen === 'people') return viewPeople();
  if (S.screen === 'person') return viewPerson();
  if (S.screen === 'history') return viewHistory();
  viewBoard();
}

/* ---------- actions ---------- */

function readDraftFields() {
  const n = document.getElementById('note'); if (n) S.draft.note = n.value;
  const b = document.getElementById('bw'); if (b) S.draft.weight = b.value;
  document.querySelectorAll('[data-row]').forEach(i => {
    S.draft.rows[Number(i.dataset.row)][i.dataset.k] = i.value;
  });
}

document.addEventListener('input', e => {
  const i = e.target;
  if (i.dataset && i.dataset.row) S.draft.rows[Number(i.dataset.row)][i.dataset.k] = i.value;
  if (i.id === 'note') S.draft.note = i.value;
  if (i.id === 'bw') S.draft.weight = i.value;
});

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;

  if (act === 'login') {
    const name = (document.getElementById('u').value || '').trim();
    const code = (document.getElementById('c').value || '').trim().toUpperCase();
    const err = document.getElementById('err');
    if (!name) { err.textContent = 'Name first.'; return; }
    if (code !== C.GROUP_CODE.toUpperCase()) { err.textContent = 'Wrong group code.'; return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!S.members.some(m => m.id === id)) {
      try { await post('members', [{ id, name, goal: 4 }]); } catch (x) { err.textContent = String(x.message).slice(0, 120); return; }
    }
    S.me = id; localStorage.setItem('board.user', id);
    await load(); return;
  }
  if (act === 'quick') { S.me = t.dataset.id; localStorage.setItem('board.user', S.me); await load(); return; }
  if (act === 'logout') { S.me = null; localStorage.removeItem('board.user'); render(); return; }
  if (act === 'go') { S.screen = t.dataset.screen; S.msg = ''; render(); return; }
  if (act === 'person') { S.personId = t.dataset.id; S.screen = 'person'; render(); return; }
  if (act === 'unit') { S.unit = S.unit === 'lb' ? 'kg' : 'lb'; localStorage.setItem('board.unit', S.unit); render(); return; }
  if (act === 'split') { readDraftFields(); S.draft.split = S.draft.split === t.dataset.v ? '' : t.dataset.v; render(); return; }
  if (act === 'addrow') { readDraftFields(); S.draft.rows.push(blankRow()); render(); return; }
  if (act === 'delrow') {
    readDraftFields();
    if (S.draft.rows.length > 1) S.draft.rows.splice(Number(t.dataset.i), 1); else S.draft.rows = [blankRow()];
    render(); return;
  }
  if (act === 'goal') {
    const v = prompt('Sessions per week?', String((S.members.find(m => m.id === S.me) || {}).goal || 4));
    if (!v) return;
    await patch('members', 'id=eq.' + encodeURIComponent(S.me), { goal: Number(v) });
    await load(); return;
  }
  if (act === 'addpr') {
    const lift = prompt('Which lift?', C.LIFTS[0]); if (!lift) return;
    const weight = prompt('Weight (' + S.unit + ')?'); if (!weight) return;
    const reps = prompt('Reps?', '5'); if (!reps) return;
    await post('prs', [{ member_id: S.me, lift, weight: toLb(weight), reps: Number(reps), date: iso(today()) }]);
    await load(); return;
  }
  if (act === 'save') {
    readDraftFields();
    const d = S.draft;
    const rows = d.rows.filter(r => r.ex.trim());
    if (!d.split && !d.note.trim() && !rows.length) { S.msg = 'Pick a split or write something first.'; render(); return; }
    const extra = rows.map(r => [r.sets && r.reps ? r.sets + 'x' + r.reps : '', r.ex, r.weight ? r.weight + S.unit : ''].filter(Boolean).join(' ')).join(', ');
    const note = [d.note.trim(), extra].filter(Boolean).join(' · ');
    try {
      await post('sessions', [{ member_id: S.me, date: iso(today()), split: d.split || 'Full body', note }]);
      if (d.weight) await post('weights', [{ member_id: S.me, date: iso(today()), lb: toLb(d.weight) }]);
      const best = bestPRs(S.me);
      for (const r of rows) {
        if (!r.weight || !r.reps) continue;
        const lb = toLb(r.weight);
        const cur = best[r.ex.trim()];
        if (!cur || lb > Number(cur.weight)) {
          await post('prs', [{ member_id: S.me, lift: r.ex.trim(), weight: lb, reps: Number(r.reps), date: iso(today()) }]);
        }
      }
      S.draft = { split: '', note: '', weight: '', rows: [blankRow()] };
      S.msg = 'Logged. +1 point.';
      await load();
    } catch (x) {
      S.msg = 'Could not save: ' + String(x.message).slice(0, 120); render();
    }
  }
});

/* ---------- boot ---------- */

async function load() {
  try {
    const [members, sessions, prs, weights] = await Promise.all([
      get('members', 'select=*&order=name'),
      get('sessions', 'select=*&order=date.desc&limit=2000'),
      get('prs', 'select=*&order=date.desc&limit=2000'),
      get('weights', 'select=*&order=date&limit=2000')
    ]);
    Object.assign(S, { members, sessions, prs, weights });
    render();
  } catch (x) {
    set(`<div style="max-width:520px;margin:80px auto;padding:24px">
      <div class="mono" style="font-size:12px;letter-spacing:.2em;color:var(--color-accent);text-transform:uppercase">The Board</div>
      <h1 style="font-family:var(--font-heading);font-weight:500;font-size:26px;margin:14px 0 10px">Can't reach the database</h1>
      <p style="font-size:14px;line-height:1.6;color:var(--color-neutral-400)">Check that the tables exist and the open policies were created. Run <span class="mono" style="color:var(--color-accent-300)">schema.sql</span> in the Supabase SQL editor.</p>
      <pre class="mono" style="font-size:11px;color:var(--color-neutral-600);white-space:pre-wrap">${esc(x.message)}</pre>
    </div>`);
  }
}

load();
