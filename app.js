'use strict';

/* ---------- data ---------- */
// Item types:
//   activity: log[day][id] = 1 when done, absent otherwise
//   rating:   1 = good, 0 = not good, absent = not logged
//   limit:    1 = happened, 0 = did not, absent = not logged (fewer is better)
const KEY = 'saff-tracker-v1';
const DEFAULT_ITEMS = [
  { id: 'crossfit', name: 'CrossFit', emoji: '🏋️', color: 1, type: 'activity', target: null },
  { id: 'football', name: 'Football', emoji: '⚽', color: 3, type: 'activity', target: null },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', color: 2, type: 'activity', target: null },
  { id: 'paddle', name: 'Paddle', emoji: '🎾', color: 4, type: 'activity', target: null },
  { id: 'meditation', name: 'Meditation', emoji: '🧘', color: 7, type: 'activity', target: null },
  { id: 'eating', name: 'Ate well', emoji: '🥗', color: 6, type: 'rating', target: null },
  { id: 'drinking', name: 'Drinking', emoji: '🍺', color: 8, type: 'limit', target: null },
];
const COLOR_NAMES = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
const EMOJI = ['🏋️', '⚽', '🏀', '🎾', '🧘', '🏃', '🚴', '🏊', '🥊', '⛳', '🧗', '🚶', '📚', '💤', '💧', '🥗', '🍺', '🚭', '☕', '🎸', '💊', '🧹', '✍️', '⭐'];

function fresh() {
  return { v: 1, items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)), log: {}, meta: { lastBackup: null } };
}
function valid(o) {
  return o && typeof o === 'object' && Array.isArray(o.items) && o.log && typeof o.log === 'object' &&
    o.items.every(i => i && typeof i.id === 'string' && typeof i.name === 'string' && ['activity', 'rating', 'limit'].includes(i.type));
}
function load() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    if (valid(o)) { o.meta = o.meta || { lastBackup: null }; return o; }
  } catch (e) { /* fall through */ }
  return fresh();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save on this device'); }
}
let S = load();

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const weekStart = d => addDays(d, -((d.getDay() + 6) % 7)); // Monday
const monthStart = d => new Date(d.getFullYear(), d.getMonth(), 1);
const daysIn = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const fmt = (d, o) => d.toLocaleDateString('en-GB', o);
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* ---------- queries ---------- */
const val = (k, id) => (S.log[k] ? S.log[k][id] : undefined);
function setVal(k, id, v) {
  if (v === undefined) {
    if (S.log[k]) { delete S.log[k][id]; if (!Object.keys(S.log[k]).length) delete S.log[k]; }
  } else {
    (S.log[k] = S.log[k] || {})[id] = v;
  }
  save();
}
function count(id, from, to, v = 1) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (val(dk(d), id) === v) n++;
  return n;
}
const acts = () => S.items.filter(i => i.type === 'activity');
const doneOn = k => acts().filter(i => val(k, i.id) === 1);
function sessions(from, to) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) n += doneOn(dk(d)).length;
  return n;
}
function activeDays(from, to) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (doneOn(dk(d)).length) n++;
  return n;
}
// Whether a weekly target is met for the week starting at ws.
function targetState(it, ws) {
  const n = count(it.id, ws, addDays(ws, 6));
  if (it.type === 'limit') return { n, met: n <= it.target, over: n > it.target };
  return { n, met: n >= it.target, over: false };
}

/* ---------- ui state ---------- */
const ui = { tab: 'today', date: today(), week: weekStart(today()), month: monthStart(today()), filter: 'all' };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function nav(act, title, sub, canNext, extra = '') {
  return `<div class="datenav">
    <button class="arrow" data-act="${act}" data-d="-1" aria-label="Previous">‹</button>
    <div class="mid"><b>${title}</b><span>${sub}</span>${extra}</div>
    <button class="arrow" data-act="${act}" data-d="1" aria-label="Next" ${canNext ? '' : 'disabled'}>›</button>
  </div>`;
}

/* ---------- Today ---------- */
function weekLine(it, d) {
  const ws = weekStart(d), n = count(it.id, ws, addDays(ws, 6));
  if (it.type === 'activity') return it.target ? `${n} of ${it.target} this week` : `${n} this week`;
  if (it.type === 'rating') return `${plural(n, 'good day')} this week${it.target ? ` · goal ${it.target}` : ''}`;
  return `${plural(n, 'day')} this week${it.target != null ? ` · max ${it.target}` : ''}`;
}
function viewToday() {
  const t = today(), d = ui.date, k = dk(d), diff = Math.round((t - d) / 864e5);
  const title = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : fmt(d, { weekday: 'long' });
  const back = diff ? `<div><button class="linkbtn" data-act="goto" data-k="${dk(t)}">Back to today</button></div>` : '';
  let h = nav('day', title, fmt(d, { weekday: 'short', day: 'numeric', month: 'long' }), diff > 0, back);
  if (!S.items.length) h += `<div class="card pad muted">Nothing to track yet. Add an activity in Settings.</div>`;
  for (const it of S.items) {
    const v = val(k, it.id), st = `style="--c:var(--c${it.color})"`;
    const name = `<span class="emo">${esc(it.emoji)}</span><span class="nm"><b>${esc(it.name)}</b><small>${weekLine(it, d)}</small></span>`;
    if (it.type === 'activity') {
      h += `<button class="item ${v === 1 ? 'on' : ''}" ${st} data-act="tog" data-id="${it.id}" aria-pressed="${v === 1}">${name}<span class="chk">✓</span></button>`;
    } else {
      const [a, b] = it.type === 'rating' ? [['Well', 1, 'good'], ['Not well', 0, 'bad']] : [['Yes', 1, 'bad'], ['No', 0, 'good']];
      const btn = ([lab, bv, cls]) => `<button class="${v === bv ? 'sel ' + cls : ''}" data-act="set" data-id="${it.id}" data-v="${bv}" aria-pressed="${v === bv}">${lab}</button>`;
      h += `<div class="item" ${st}>${name}<span class="seg">${btn(a)}${btn(b)}</span></div>`;
    }
  }
  const days = Object.keys(S.log).length, lb = S.meta.lastBackup;
  if (days >= 7 && (!lb || Date.now() - lb > 30 * 864e5)) {
    h += `<div class="card banner"><span>${lb ? 'Your last backup is over a month old.' : 'You have not backed up your data yet.'}</span><button class="linkbtn" data-act="export">Back up</button></div>`;
  }
  return h;
}

/* ---------- Week ---------- */
function cellHtml(it, k, future) {
  const v = val(k, it.id);
  let cls = '', g = '';
  if (it.type === 'activity') { if (v === 1) { cls = 'done'; g = '✓'; } }
  else if (it.type === 'rating') { if (v === 1) { cls = 'good'; g = '✓'; } else if (v === 0) { cls = 'bad'; g = '✕'; } }
  else if (v === 0) { cls = 'good'; g = '✓'; } else if (v === 1) { cls = 'bad emoji'; g = esc(it.emoji); }
  return `<button class="cell ${cls}" style="--c:var(--c${it.color})" data-act="cell" data-id="${it.id}" data-k="${k}" ${future ? 'disabled' : ''} aria-label="${esc(it.name)} ${k}">${g}</button>`;
}
function viewWeek() {
  const t = today(), ws = ui.week, we = addDays(ws, 6), cur = +ws === +weekStart(t);
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const sub = `${fmt(ws, { day: 'numeric', month: 'short' })} – ${fmt(we, { day: 'numeric', month: 'short' })}`;
  let h = nav('wk', cur ? 'This week' : +ws === +addDays(weekStart(t), -7) ? 'Last week' : `Week of ${fmt(ws, { day: 'numeric', month: 'short' })}`, sub, !cur);

  const withT = S.items.filter(i => i.target != null), hit = withT.filter(i => targetState(i, ws).met).length;
  h += `<div class="statrow">
    <div class="card stat"><div class="k">Active days</div><div class="v">${activeDays(ws, we)}<small> / 7</small></div></div>
    <div class="card stat"><div class="k">Sessions</div><div class="v">${sessions(ws, we)}</div></div>
    <div class="card stat"><div class="k">Targets met</div><div class="v">${withT.length ? `${hit}<small> / ${withT.length}</small>` : '<small>none set</small>'}</div></div>
  </div>`;

  h += `<div class="card pad"><table class="wk"><colgroup><col class="name">${'<col>'.repeat(7)}<col class="tot"></colgroup><thead><tr><th></th>`;
  days.forEach((d, i) => { h += `<th class="${+d === +t ? 'now' : ''}">${DOW[i]}<b>${d.getDate()}</b></th>`; });
  h += `<th></th></tr></thead><tbody>`;
  for (const it of S.items) {
    const n = count(it.id, ws, we);
    h += `<tr><th class="rowh" scope="row"><span class="e">${esc(it.emoji)}</span>${esc(it.name)}</th>`;
    days.forEach(d => { h += `<td>${cellHtml(it, dk(d), d > t)}</td>`; });
    h += `<td class="tot">${n}${it.target != null ? `<small>/${it.target}</small>` : ''}</td></tr>`;
  }
  h += `</tbody></table><div class="legend"><span>Tap a square to change it</span>`;
  if (S.items.some(i => i.type !== 'activity')) h += `<span><i>✓</i>good day</span><span><i>✕</i>not well</span>`;
  S.items.filter(i => i.type === 'limit').forEach(i => { h += `<span><i>${esc(i.emoji)}</i>${esc(i.name.toLowerCase())}</span>`; });
  h += `</div></div>`;
  return h;
}

/* ---------- Month ---------- */
function viewMonth() {
  const t = today(), ms = ui.month, n = daysIn(ms), me = addDays(ms, n - 1), cur = +ms === +monthStart(t);
  if (ui.filter !== 'all' && !S.items.some(i => i.id === ui.filter)) ui.filter = 'all';
  const f = S.items.find(i => i.id === ui.filter);
  let h = nav('mo', fmt(ms, { month: 'long' }), String(ms.getFullYear()), !cur);

  h += `<div class="chips"><button class="chip ${f ? '' : 'on'}" data-act="filter" data-id="all">All</button>`;
  for (const it of S.items) h += `<button class="chip ${f === it ? 'on' : ''}" data-act="filter" data-id="${it.id}"><span class="dot" style="--c:var(--c${it.color})"></span>${esc(it.name)}</button>`;
  h += `</div><div class="card pad"><div class="cal">${DOW.map(d => `<div class="dow">${d}</div>`).join('')}`;
  h += '<div></div>'.repeat((ms.getDay() + 6) % 7);
  for (let i = 0; i < n; i++) {
    const d = addDays(ms, i), k = dk(d), future = d > t;
    let cls = future ? 'future' : '', inner = '', tip = fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
    if (!future && f) {
      const v = val(k, f.id), good = f.type === 'rating' ? 1 : 0;
      if (f.type === 'activity') { if (v === 1) { cls = 'done'; inner = '<span class="g">✓</span>'; } }
      else if (v === good) { cls = 'good'; inner = '<span class="g">✓</span>'; }
      else if (v !== undefined) { cls = 'bad'; inner = `<span class="g">${f.type === 'limit' ? esc(f.emoji) : '✕'}</span>`; }
    } else if (!future) {
      const on = S.items.filter(it => it.type !== 'rating' && val(k, it.id) === 1);
      inner = `<span class="dots">${on.map(it => `<span class="dot" style="--c:var(--c${it.color})"></span>`).join('')}</span>`;
      if (on.length) tip += ': ' + on.map(it => it.name).join(', ');
    }
    h += `<button class="day ${cls} ${+d === +t ? 'now' : ''}" style="--c:var(--c${f ? f.color : 1})" data-act="goto" data-k="${k}" ${future ? 'disabled' : ''} aria-label="${esc(tip)}">${d.getDate()}${inner}</button>`;
  }
  h += `</div><div class="legend"><span>${f ? '' : 'Dots show what you did. '}Tap a day to edit it.</span></div></div>`;

  // totals, compared with the previous month (to the same day number when this month is still running)
  const ps = new Date(ms.getFullYear(), ms.getMonth() - 1, 1);
  const end = cur ? t : me, pEnd = addDays(ps, Math.min(cur ? t.getDate() : 31, daysIn(ps)) - 1);
  h += `<div class="card pad"><h2>Totals</h2><p class="sub">${cur ? `Compared with the same point in ${fmt(ps, { month: 'long' })}` : `Compared with ${fmt(ps, { month: 'long' })}`}</p><div class="rows">`;
  for (const it of S.items) {
    const a = count(it.id, ms, end), p = count(it.id, ps, pEnd), dlt = a - p;
    const zero = count(it.id, ms, end, 0);
    const detail = it.type === 'rating' ? `${plural(zero, 'day')} not well` : it.type === 'limit' ? `${plural(zero, 'day')} without` : '';
    h += `<div class="row"><span class="e">${esc(it.emoji)}</span><span class="n">${esc(it.name)}${detail ? `<small>${detail}</small>` : ''}</span>
      <span class="val">${plural(a, 'day')}<small>${dlt === 0 ? 'same' : (dlt > 0 ? '▲ ' : '▼ ') + Math.abs(dlt)} vs ${p}</small></span></div>`;
  }
  h += `</div></div>`;
  return h;
}

/* ---------- Dashboard ---------- */
function ring(it, ws) {
  const s = targetState(it, ws), r = 28, c = 2 * Math.PI * r;
  const frac = it.target === 0 ? (s.n ? 1 : 0) : Math.min(1, s.n / it.target);
  const col = s.over ? 'var(--bad)' : `var(--c${it.color})`;
  const status = it.type === 'limit' ? (s.over ? '✕ over limit' : `max ${it.target}`) : (s.met ? '✓ target met' : `${it.target - s.n} to go`);
  return `<div class="ring"><svg viewBox="0 0 72 72" role="img" aria-label="${esc(it.name)}: ${s.n} of ${it.target}">
    <circle class="track" cx="36" cy="36" r="${r}" fill="none" stroke-width="7"/>
    ${frac ? `<circle cx="36" cy="36" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(frac * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 36 36)"/>` : ''}
    <text x="36" y="42" text-anchor="middle">${s.n}/${it.target}</text></svg>
    <div class="nm">${esc(it.emoji)} ${esc(it.name)}</div><div class="st">${status}</div></div>`;
}
function weeklyChart(t) {
  const W = 328, H = 150, L = 22, T = 16, B = 20, N = 12, slot = (W - L) / N, bw = 16, ph = H - T - B;
  const ws0 = weekStart(t), data = [];
  for (let i = N - 1; i >= 0; i--) { const ws = addDays(ws0, -7 * i); data.push({ ws, n: sessions(ws, addDays(ws, 6)) }); }
  const max = Math.max(4, Math.ceil(Math.max(...data.map(d => d.n)) / 2) * 2);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sessions per week for the last 12 weeks">`;
  for (const g of [0, max / 2, max]) {
    const y = T + ph - (g / max) * ph;
    s += `<line class="grid" x1="${L}" x2="${W}" y1="${y}" y2="${y}"/><text class="ax" x="${L - 6}" y="${y + 3}" text-anchor="end">${g}</text>`;
  }
  data.forEach((d, i) => {
    const x = L + i * slot + (slot - bw) / 2, h = (d.n / max) * ph, y = T + ph - h, r = Math.min(4, h);
    const tip = `Week of ${fmt(d.ws, { day: 'numeric', month: 'short' })}: ${plural(d.n, 'session')}`;
    s += `<rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}" data-tip="${tip}"/>`;
    s += h ? `<path class="bar" d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z" pointer-events="none"/>` : `<g/>`;
    if (i === N - 1) s += `<text class="lbl" x="${x + bw / 2}" y="${y - 5}" text-anchor="middle">${d.n}</text>`;
    if (i % 3 === 0 || i === N - 1) s += `<text class="ax" x="${x + bw / 2}" y="${H - 5}" text-anchor="middle">${i === N - 1 ? 'Now' : fmt(d.ws, { day: 'numeric', month: 'short' })}</text>`;
  });
  return s + '</svg>';
}
function heatmap(t) {
  const N = 18, cs = 14, gap = 3, L = 18, T = 16, W = L + N * (cs + gap), H = T + 7 * (cs + gap);
  const ws0 = addDays(weekStart(t), -7 * (N - 1));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Activities per day for the last 18 weeks">`;
  [0, 2, 4, 6].forEach(r => { s += `<text class="ax" x="0" y="${T + r * (cs + gap) + 11}">${DOW[r]}</text>`; });
  let lastM = -1;
  for (let w = 0; w < N; w++) {
    const ws = addDays(ws0, w * 7), x = L + w * (cs + gap);
    if (ws.getMonth() !== lastM && w < N - 1) { lastM = ws.getMonth(); s += `<text class="ax" x="${x}" y="10">${fmt(ws, { month: 'short' })}</text>`; }
    for (let r = 0; r < 7; r++) {
      const d = addDays(ws, r);
      if (d > t) continue;
      const on = doneOn(dk(d)), lvl = Math.min(4, on.length);
      const tip = `${fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })}: ${on.length ? on.map(i => i.name).join(', ') : 'nothing logged'}`;
      s += `<rect class="hm" x="${x}" y="${T + r * (cs + gap)}" width="${cs}" height="${cs}" rx="3" fill="var(--h${lvl})" data-tip="${esc(tip)}"/>`;
    }
  }
  return s + `</svg><div class="hmlegend">0 ${[0, 1, 2, 3, 4].map(l => `<i style="background:var(--h${l})"></i>`).join('')} 4+ a day</div>`;
}
function viewDash() {
  const t = today(), ws = weekStart(t), ms = monthStart(t);
  const ps = new Date(ms.getFullYear(), ms.getMonth() - 1, 1), pEnd = addDays(ps, Math.min(t.getDate(), daysIn(ps)) - 1);
  const sNow = sessions(ms, t), sPrev = sessions(ps, pEnd), dlt = sNow - sPrev;
  let h = `<div class="tiles">
    <div class="card tile"><div class="k">Active days this week</div><div class="v">${activeDays(ws, t)}<small> / 7</small></div><div class="d">${plural(sessions(ws, t), 'session')}</div></div>
    <div class="card tile"><div class="k">Sessions this month</div><div class="v">${sNow}</div><div class="d">${dlt === 0 ? 'Same as' : (dlt > 0 ? '▲ ' : '▼ ') + Math.abs(dlt) + (dlt > 0 ? ' more than' : ' fewer than')} this point last month</div></div>`;
  for (const it of S.items.filter(i => i.type === 'rating')) {
    const g = count(it.id, ms, t), b = count(it.id, ms, t, 0), tot = g + b;
    h += `<div class="card tile"><div class="k">${esc(it.emoji)} ${esc(it.name)} this month</div><div class="v">${tot ? Math.round(100 * g / tot) + '<small>%</small>' : '<small>no data</small>'}</div><div class="d">${g} of ${plural(tot, 'logged day')}</div></div>`;
  }
  for (const it of S.items.filter(i => i.type === 'limit')) {
    let last = null, first = null;
    for (const k of Object.keys(S.log).sort()) { const v = S.log[k][it.id]; if (v !== undefined && !first) first = k; if (v === 1) last = k; }
    const from = last || first, [y, m, d] = (from || '0-1-1').split('-').map(Number);
    const n = from ? Math.round((t - new Date(y, m - 1, d)) / 864e5) + (last ? 0 : 1) : null;
    h += `<div class="card tile"><div class="k">${esc(it.emoji)} Days without ${esc(it.name.toLowerCase())}</div><div class="v">${n == null ? '<small>no data</small>' : Math.max(0, n)}</div><div class="d">${last ? `Last: ${fmt(new Date(y, m - 1, d), { day: 'numeric', month: 'short' })}` : n == null ? 'Log a day to start' : 'None logged so far'}</div></div>`;
  }
  h += `</div>`;

  const withT = S.items.filter(i => i.target != null);
  h += `<div class="card pad"><h2>This week's targets</h2>`;
  h += withT.length ? `<p class="sub">Progress since Monday</p><div class="rings">${withT.map(i => ring(i, ws)).join('')}</div>`
    : `<p class="sub" style="margin:0">No weekly targets yet. Set one for any activity in Settings.</p>`;
  h += `</div>`;

  h += `<div class="card pad"><h2>Sessions per week</h2><p class="sub">All activities, last 12 weeks</p>${weeklyChart(t)}</div>`;
  h += `<div class="card pad"><h2>Daily activity</h2><p class="sub">Activities done each day, last 18 weeks</p>${heatmap(t)}</div>`;

  const from = addDays(t, -29), rows = acts().map(i => ({ i, n: count(i.id, from, t) })), max = Math.max(1, ...rows.map(r => r.n));
  h += `<div class="card pad"><h2>Activity mix</h2><p class="sub">Days done in the last 30 days</p>`;
  h += rows.length ? rows.map(r => `<div class="hbar" style="--c:var(--c${r.i.color})" data-tip="${esc(r.i.name)}: ${plural(r.n, 'day')}"><span>${esc(r.i.emoji)}</span><span class="n">${esc(r.i.name)}</span><span class="t"><span class="f" style="display:block;width:${r.n ? (100 * r.n / max).toFixed(1) : 0}%;${r.n ? '' : 'visibility:hidden'}"></span></span><span class="x">${r.n}</span></div>`).join('')
    : `<p class="sub" style="margin:0">No activities set up.</p>`;
  h += `</div>`;
  return h;
}

/* ---------- Settings ---------- */
const TYPE_LABEL = { activity: 'Activity', rating: 'Well / not well', limit: 'Yes / no, fewer is better' };
function viewSettings() {
  let h = `<div class="card pad"><h2>What you track</h2><p class="sub">Rename, reorder, set weekly targets or add your own</p>`;
  S.items.forEach((it, i) => {
    const tg = it.target == null ? 'no target' : it.type === 'limit' ? `max ${it.target} a week` : `${it.target} a week`;
    h += `<div class="srow"><span class="emo">${esc(it.emoji)}</span><span class="n">${esc(it.name)}<small>${TYPE_LABEL[it.type]} · ${tg}</small></span>
      <button class="mini" data-act="move" data-id="${it.id}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Move up">↑</button>
      <button class="mini" data-act="move" data-id="${it.id}" data-d="1" ${i < S.items.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button>
      <button class="mini" data-act="edit" data-id="${it.id}" aria-label="Edit ${esc(it.name)}">✎</button></div>`;
  });
  h += `<button class="btn primary full" style="margin-top:12px" data-act="edit" data-id="">Add something to track</button></div>`;

  const lb = S.meta.lastBackup;
  h += `<div class="card pad"><h2>Backup</h2><p class="sub">Your data lives only on this device. Save a backup file now and then, and restore it on a new phone. Last backup: ${lb ? fmt(new Date(lb), { day: 'numeric', month: 'short', year: 'numeric' }) : 'never'}.</p>
    <div class="btnrow"><button class="btn" data-act="export">Save backup</button><button class="btn" data-act="import">Restore backup</button></div></div>`;
  h += `<div class="card pad"><h2>Start over</h2><p class="sub">Deletes every logged day and restores the original list.</p><button class="btn danger full" data-act="reset">Erase all data</button></div>`;
  return h;
}

/* ---------- item editor ---------- */
let draft = null;
function openEditor(id) {
  const it = S.items.find(i => i.id === id);
  draft = it ? { ...it } : { id: null, name: '', emoji: '⭐', color: (S.items.length % 8) + 1, type: 'activity', target: null };
  renderEditor();
  $('#sheet').showModal();
}
function renderEditor() {
  const d = draft, isNew = !d.id;
  const tLabel = d.target == null ? 'No target' : d.type === 'limit' ? `Max ${d.target} a week` : `${d.target} a week`;
  $('#sheet').innerHTML = `<h2>${isNew ? 'Add something to track' : 'Edit'}</h2>
    <div class="field"><label for="fName">Name</label><input id="fName" type="text" maxlength="24" value="${esc(d.name)}" placeholder="e.g. Running" autocomplete="off"></div>
    ${isNew ? `<div class="field"><label for="fType">How you log it</label><select id="fType">
      <option value="activity" ${d.type === 'activity' ? 'selected' : ''}>Activity: tap when you did it</option>
      <option value="rating" ${d.type === 'rating' ? 'selected' : ''}>Rating: well / not well</option>
      <option value="limit" ${d.type === 'limit' ? 'selected' : ''}>Limit: yes / no, fewer is better</option></select></div>` : ''}
    <div class="field"><span class="lab">Icon</span><div class="pick">${EMOJI.map(e => `<button type="button" class="${e === d.emoji ? 'sel' : ''}" data-act="dEmoji" data-e="${e}">${e}</button>`).join('')}</div>
      <input id="fEmoji" type="text" maxlength="8" value="${esc(d.emoji)}" aria-label="Or type any emoji"><span class="hint">Pick one, or type any emoji.</span></div>
    <div class="field"><span class="lab">Colour</span><div class="pick">${COLOR_NAMES.map((n, i) => `<button type="button" class="sw ${d.color === i + 1 ? 'sel' : ''}" style="--c:var(--c${i + 1})" data-act="dColor" data-c="${i + 1}" aria-label="${n}"></button>`).join('')}</div></div>
    <div class="field"><span class="lab">Weekly target</span><div class="stepper">
      <button type="button" class="mini" data-act="dTarget" data-d="-1" aria-label="Lower target">−</button><b>${tLabel}</b>
      <button type="button" class="mini" data-act="dTarget" data-d="1" aria-label="Raise target">+</button></div>
      <span class="hint">${d.type === 'limit' ? 'The most days a week you want this to happen.' : 'How many days a week you are aiming for.'} Optional.</span></div>
    <div class="btnrow"><button class="btn" data-act="dCancel">Cancel</button><button class="btn primary" data-act="dSave">Save</button></div>
    ${isNew ? '' : `<button class="btn danger full" style="margin-top:8px" data-act="dDelete">Delete</button>`}`;
}
function syncDraft() {
  const n = $('#fName'), e = $('#fEmoji'), ty = $('#fType');
  if (n) draft.name = n.value;
  if (e && e.value.trim()) draft.emoji = e.value.trim();
  if (ty) draft.type = ty.value;
}

/* ---------- backup ---------- */
async function exportData() {
  S.meta.lastBackup = Date.now();
  const name = `saff-tracker-backup-${dk(today())}.json`;
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Saff Tracker backup' });
      save(); render(); return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') { S = load(); return; } // cancelled: backup did not happen
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  save(); render(); toast('Backup saved');
}
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    let o = null;
    try { o = JSON.parse(r.result); } catch (e) { /* invalid */ }
    if (!valid(o)) return toast('That is not a tracker backup file');
    const n = Object.keys(o.log).length;
    if (!confirm(`Replace everything on this device with the backup (${plural(n, 'logged day')})?`)) return;
    o.meta = o.meta || { lastBackup: null };
    S = o; save(); render(); toast('Backup restored');
  };
  r.readAsText(file);
}

/* ---------- render + events ---------- */
const VIEWS = { today: ['Today', viewToday], week: ['Week', viewWeek], month: ['Month', viewMonth], dash: ['Dashboard', viewDash], settings: ['Settings', viewSettings] };
function render() {
  const [title, fn] = VIEWS[ui.tab];
  $('#title').textContent = title;
  $('#main').innerHTML = fn();
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  hideTip();
}
let toastT;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2400);
}
function showTip(el) {
  const tip = $('#tip'); tip.textContent = el.dataset.tip; tip.hidden = false;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  tip.style.top = (r.top - h - 6 < 8 ? r.bottom + 6 : r.top - h - 6) + 'px';
}
function hideTip() { $('#tip').hidden = true; }

const ACT = {
  tab(b) { ui.tab = b.dataset.tab; if (ui.tab === 'today') ui.date = today(); scrollTo(0, 0); },
  day(b) { const d = addDays(ui.date, +b.dataset.d); if (d <= today()) ui.date = d; },
  wk(b) { const d = addDays(ui.week, 7 * b.dataset.d); if (d <= today()) ui.week = d; },
  mo(b) { const d = new Date(ui.month.getFullYear(), ui.month.getMonth() + +b.dataset.d, 1); if (d <= today()) ui.month = d; },
  goto(b) { const [y, m, d] = b.dataset.k.split('-').map(Number); ui.date = new Date(y, m - 1, d); ui.tab = 'today'; scrollTo(0, 0); },
  filter(b) { ui.filter = b.dataset.id; },
  tog(b) { const k = dk(ui.date); setVal(k, b.dataset.id, val(k, b.dataset.id) === 1 ? undefined : 1); },
  set(b) { const k = dk(ui.date), v = +b.dataset.v; setVal(k, b.dataset.id, val(k, b.dataset.id) === v ? undefined : v); },
  cell(b) {
    const it = S.items.find(i => i.id === b.dataset.id), k = b.dataset.k, v = val(k, it.id);
    if (it.type === 'activity') setVal(k, it.id, v === 1 ? undefined : 1);
    else { const first = it.type === 'rating' ? 1 : 0; setVal(k, it.id, v === undefined ? first : v === first ? 1 - first : undefined); }
  },
  move(b) {
    const i = S.items.findIndex(x => x.id === b.dataset.id), j = i + +b.dataset.d;
    if (j < 0 || j >= S.items.length) return;
    [S.items[i], S.items[j]] = [S.items[j], S.items[i]]; save();
  },
  edit(b) { openEditor(b.dataset.id); return false; },
  export() { exportData(); return false; },
  import() { $('#importFile').click(); return false; },
  reset() {
    if (!confirm('Erase every logged day and restore the original list? This cannot be undone.')) return false;
    S = fresh(); save(); toast('All data erased');
  },
  dEmoji(b) { syncDraft(); draft.emoji = b.dataset.e; renderEditor(); return false; },
  dColor(b) { syncDraft(); draft.color = +b.dataset.c; renderEditor(); return false; },
  dTarget(b) {
    syncDraft();
    const min = draft.type === 'limit' ? 0 : 1, t = draft.target, up = +b.dataset.d > 0;
    draft.target = t == null ? (up ? min : null) : up ? Math.min(7, t + 1) : (t - 1 < min ? null : t - 1);
    renderEditor(); return false;
  },
  dCancel() { $('#sheet').close(); return false; },
  dSave() {
    syncDraft();
    draft.name = draft.name.trim();
    if (!draft.name) { toast('Give it a name'); $('#fName').focus(); return false; }
    if (draft.type !== 'limit' && draft.target === 0) draft.target = 1;
    if (draft.id) Object.assign(S.items.find(i => i.id === draft.id), draft);
    else S.items.push({ ...draft, id: 'i' + Date.now().toString(36) });
    save(); $('#sheet').close();
  },
  dDelete() {
    if (!confirm(`Delete "${draft.name}" and its history?`)) return false;
    S.items = S.items.filter(i => i.id !== draft.id);
    for (const k of Object.keys(S.log)) { delete S.log[k][draft.id]; if (!Object.keys(S.log[k]).length) delete S.log[k]; }
    save(); $('#sheet').close();
  },
};

document.addEventListener('click', e => {
  const tipEl = e.target.closest('[data-tip]');
  if (tipEl) showTip(tipEl); else hideTip();
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  if (ACT[b.dataset.act](b) !== false) render();
});
document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { const el = e.target.closest('[data-tip]'); if (el) showTip(el); else hideTip(); } });
addEventListener('scroll', hideTip, { passive: true });
$('#sheet').addEventListener('change', e => { if (e.target.id === 'fType') { syncDraft(); draft.target = null; renderEditor(); } });
$('#importFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importData(f); });
// A day may have rolled over while the app sat in the background.
document.addEventListener('visibilitychange', () => { if (!document.hidden && ui.tab === 'today' && !$('#sheet').open) render(); });

render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
