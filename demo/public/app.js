'use strict';

// ---------------------------------------------------------------------------
// State and API
// ---------------------------------------------------------------------------

const state = {
  dogs: [],
  dogId: null,
  dog: null,
  tab: 'overview',
  chats: {}, // dogId -> [{role, content, emergency?, mode?, model?}]
  ai: { mode: 'offline' },
  checkin: null,
};

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const $ = (sel, root = document) => root.querySelector(sel);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function todayISO() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, opts);
}

function pron(dog) {
  return dog.sex === 'female' ? { she: 'she', her: 'her', She: 'She', Her: 'Her' } : { she: 'he', her: 'his', She: 'He', Her: 'His' };
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
}

// Minimal, safe markdown: escape first, then **bold**, bullet lists, paragraphs.
function md(text) {
  const blocks = esc(text).split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    if (/^#{1,4}\s/.test(b)) return `<p><strong>${inline(b.replace(/^#{1,4}\s/, ''))}</strong></p>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('');
}

function inline(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function loadDogs() {
  state.dogs = await api('/api/dogs');
  if (!state.dogId || !state.dogs.some((d) => d.id === state.dogId)) state.dogId = state.dogs[0]?.id;
}

async function loadDog() {
  state.dog = await api(`/api/dogs/${state.dogId}`);
  state.checkin = null;
}

function applyDog(dog) {
  state.dog = dog;
  const s = state.dogs.find((d) => d.id === dog.id);
  if (s) s.status = dog.status;
  render();
}

async function selectDog(id) {
  state.dogId = id;
  await loadDog();
  render();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render() {
  renderSwitcher();
  renderHero();
  renderOverview();
  renderCheckin();
  renderChat();
  renderRecords();
  renderProfile();
  showTab(state.tab);
}

function renderSwitcher() {
  $('#dogSwitcher').innerHTML = state.dogs.map((d) => `
    <button class="dog-chip ${d.id === state.dogId ? 'active' : ''}" data-dog="${esc(d.id)}">
      <span class="avatar">${esc(d.avatar)}</span>
      <span>${esc(d.name)}</span>
      <span class="dot ${esc(d.status.color)}" title="${esc(d.status.label)}"></span>
    </button>`).join('');
}

function renderHero() {
  const d = state.dog;
  const weights = d.weights;
  const w = weights[weights.length - 1];
  const sub = {
    green: 'No warning signs right now',
    amber: 'Something to watch',
    orange: 'Signals worth a vet\'s look',
    red: 'Don\'t wait: call your vet',
  }[d.status.color];
  const hero = $('#hero');
  hero.className = `hero ${d.status.color}`;
  hero.innerHTML = `
    <div class="big-avatar">${esc(d.avatar)}</div>
    <div>
      <h1>${esc(d.name)}</h1>
      <div class="meta">${esc(d.breed)} · ${esc(d.sex === 'female' ? 'Female' : 'Male')} · ${esc(d.age)}${w ? ` · ${w.kg} kg` : ''}</div>
    </div>
    <div class="status-pill ${d.status.color}">${esc(d.status.label)}<small>${esc(sub)}</small></div>`;
}

const LEVEL_LABEL = { urgent: 'Now', vet: 'Vet', watch: 'Watch', info: 'Info' };

function signalsHtml(signals) {
  return `<ul class="signals">${signals.map((s) => `
    <li class="signal">
      <span class="lvl ${s.level}">${LEVEL_LABEL[s.level] || s.level}</span>
      <span class="title">${esc(s.title)} <span class="area">· ${esc(s.area)}</span></span>
      <span class="detail">${esc(s.detail)}</span>
    </li>`).join('')}</ul>`;
}

function renderOverview() {
  const d = state.dog;
  const p = pron(d);
  const serious = d.signals.filter((s) => s.level !== 'info');
  const areas = new Set(serious.map((s) => s.area));
  const pattern = serious.length >= 3 && areas.size >= 3
    ? `<div class="pattern-note"><strong>Why this matters:</strong> none of these signals alone looks dramatic. Together, from ${areas.size} different sources (${[...areas].join(', ').toLowerCase()}), they form a pattern that's worth a vet's attention.</div>`
    : '';
  const nextVaccine = [...d.vaccines].sort((a, b) => a.due.localeCompare(b.due))[0];

  $('#tab-overview').innerHTML = `
    <div class="grid">
      <div class="card span-7">
        <div class="card-head"><h2>Early-warning signals</h2><span class="hint">Plain rules, not AI</span></div>
        ${d.signals.length ? signalsHtml(d.signals) : `<div class="all-clear">✓ All clear. ${esc(d.name)}'s check-ins, weight, labs and vaccines look on track.</div>`}
        ${pattern}
      </div>
      <div class="card span-5">
        <div class="card-head"><h2>At a glance</h2></div>
        <dl class="facts">
          <dt>Age</dt><dd>${esc(d.age)} (born ${fmtDate(d.birthDate)})</dd>
          <dt>Diet</dt><dd>${esc(d.diet)}</dd>
          <dt>Allergies</dt><dd>${d.allergies.length ? esc(d.allergies.join(', ')) : 'None known'}</dd>
          <dt>Medications</dt><dd>${d.medications.length ? d.medications.map((m) => esc(m.name)).join('<br>') : 'None'}</dd>
          <dt>Next vaccine</dt><dd>${nextVaccine ? `${esc(nextVaccine.name)}, ${fmtDate(nextVaccine.due)}` : '—'}</dd>
          <dt>Vet</dt><dd>${esc(d.clinic.vet)}, ${esc(d.clinic.name)}<br><a href="tel:${esc(d.clinic.phone)}">${esc(d.clinic.phone)}</a></dd>
        </dl>
      </div>
      <div class="card span-12">
        <div class="card-head"><h2>Weight</h2><span class="hint">kg</span></div>
        <div class="chart">${weightChart(d.weights)}</div>
      </div>
      <div class="card span-12">
        <div class="card-head"><h2>Last 14 days</h2><span class="hint">Hover a day to see ${p.her} notes</span></div>
        ${habitGrid(d)}
      </div>
    </div>`;
}

function weightChart(weights) {
  const pts = weights.slice(-8);
  if (pts.length < 2) return '<p class="muted">Add at least two weights to see a trend.</p>';
  const W = 900, H = 220, pl = 44, pr = 20, pt = 22, pb = 32;
  const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date);
  const kgs = pts.map((p) => p.kg);
  let lo = Math.min(...kgs), hi = Math.max(...kgs);
  const pad = Math.max((hi - lo) * 0.35, hi * 0.03);
  lo -= pad; hi += pad;
  const x = (d) => pl + ((Date.parse(d) - t0) / Math.max(t1 - t0, 1)) * (W - pl - pr);
  const y = (kg) => pt + (1 - (kg - lo) / (hi - lo)) * (H - pt - pb);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts[pts.length - 1].date).toFixed(1)},${H - pb} L${pl},${H - pb} Z`;
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
  const dec = hi < 10 ? 2 : 1;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight chart">
    ${ticks.map((t) => `<line class="axis" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/><text class="label" x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${t.toFixed(dec)}</text>`).join('')}
    <path class="area" d="${area}"/>
    <path class="line" d="${line}"/>
    ${pts.map((p, i) => `
      <circle class="pt ${i === pts.length - 1 ? 'last' : ''}" cx="${x(p.date)}" cy="${y(p.kg)}" r="4.5"><title>${p.kg} kg on ${fmtDate(p.date)}</title></circle>
      <text class="val" x="${x(p.date)}" y="${y(p.kg) - 10}" text-anchor="middle">${p.kg}</text>
      <text class="label" x="${x(p.date)}" y="${H - 10}" text-anchor="middle">${fmtDate(p.date, { day: 'numeric', month: 'short' })}</text>`).join('')}
  </svg>`;
}

const HABIT_ROWS = [
  { key: 'appetite', label: 'Appetite', cls: (v) => ({ normal: 'ok', increased: 'mild', reduced: 'bad', none: 'severe' }[v]), short: (v) => ({ normal: '✓', increased: '↑', reduced: '↓', none: '✕' }[v]) },
  { key: 'water', label: 'Water', cls: (v) => ({ normal: 'ok', less: 'mild', more: 'mild' }[v]), short: (v) => ({ normal: '✓', less: '↓', more: '↑' }[v]) },
  { key: 'energy', label: 'Energy', cls: (v) => ({ normal: 'ok', high: 'ok', low: 'bad' }[v]), short: (v) => ({ normal: '✓', high: '↑', low: '↓' }[v]) },
  { key: 'stool', label: 'Stool', cls: (v) => ({ normal: 'ok', soft: 'mild', diarrhea: 'bad', none: 'mild' }[v]), short: (v) => ({ normal: '✓', soft: '~', diarrhea: '!', none: '–' }[v]) },
  { key: 'vomiting', label: 'Vomiting', cls: (v) => (v === 0 ? 'ok' : v === 1 ? 'bad' : 'severe'), short: (v) => (v === 0 ? '✓' : String(v)) },
  { key: 'walkMinutes', label: 'Walk (min)', cls: (v) => (v >= 20 ? 'ok' : 'mild'), short: (v) => String(v) },
];

function habitGrid(dog) {
  const days = Array.from({ length: 14 }, (_, i) => dateNDaysAgo(13 - i));
  const byDate = Object.fromEntries(dog.habits.map((h) => [h.date, h]));
  const today = todayISO();
  let html = '<div class="habit-grid"><div></div>';
  html += days.map((d) => `<div class="daylabel ${d === today ? 'today' : ''}">${d === today ? 'Today' : fmtDate(d, { day: 'numeric' })}</div>`).join('');
  for (const row of HABIT_ROWS) {
    html += `<div class="rowlabel">${row.label}</div>`;
    html += days.map((d) => {
      const h = byDate[d];
      if (!h) return `<div class="cell empty" data-date="${d}" data-empty="1"></div>`;
      const v = h[row.key];
      return `<div class="cell ${row.cls(v) || 'ok'} ${h.note ? 'note' : ''}" data-date="${d}">${esc(row.short(v) ?? '')}</div>`;
    }).join('');
  }
  html += '</div>';
  html += `<div class="legend">
    <span><i style="background:var(--green-soft)"></i>Normal</span>
    <span><i style="background:var(--amber-soft)"></i>A bit off</span>
    <span><i style="background:var(--orange-soft)"></i>Concerning</span>
    <span><i style="background:var(--red-soft)"></i>Serious</span>
    <span><i style="background:#fff;outline:2px solid #d8cfc1;outline-offset:-2px"></i>Has a note</span>
    <span><i style="background:#f1ede6"></i>No check-in</span></div>`;
  return html;
}

function habitTooltip(date) {
  const h = state.dog.habits.find((x) => x.date === date);
  if (!h) return `<b>${fmtDate(date)}</b>No check-in logged.`;
  return `<b>${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
    Appetite ${esc(h.appetite)} · water ${esc(h.water)} · energy ${esc(h.energy)}<br>
    Stool ${esc(h.stool)} · vomiting ${h.vomiting} · walk ${h.walkMinutes} min
    ${h.note ? `<br><br>📝 ${esc(h.note)}` : ''}`;
}

// --- Check-in --------------------------------------------------------------

const CHECKIN_OPTIONS = {
  appetite: [['none', 'None'], ['reduced', 'Less'], ['normal', 'Normal'], ['increased', 'More']],
  water: [['less', 'Less'], ['normal', 'Normal'], ['more', 'More']],
  energy: [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']],
  stool: [['none', 'None'], ['normal', 'Normal'], ['soft', 'Soft'], ['diarrhea', 'Diarrhea']],
};
const WARN = new Set(['none', 'reduced', 'low', 'diarrhea', 'more', 'less', 'soft']);

function renderCheckin() {
  const d = state.dog;
  const p = pron(d);
  const existing = d.habits.find((h) => h.date === todayISO());
  if (!state.checkin) {
    state.checkin = existing
      ? { ...existing }
      : { appetite: 'normal', water: 'normal', energy: 'normal', stool: 'normal', vomiting: 0, walkMinutes: 30, note: '' };
  }
  const c = state.checkin;
  const seg = (key, label) => `
    <div class="field"><span class="label">${label}</span>
      <div class="seg" data-key="${key}">${CHECKIN_OPTIONS[key].map(([v, t]) =>
        `<button type="button" data-val="${v}" class="${c[key] === v ? 'on' : ''} ${c[key] === v && WARN.has(v) && v !== 'normal' ? 'warn' : ''}">${t}</button>`).join('')}</div>
    </div>`;

  $('#tab-checkin').innerHTML = `
    <div class="grid">
      <div class="card span-7">
        <div class="card-head"><h2>How is ${esc(d.name)} today?</h2><span class="hint">About 15 seconds</span></div>
        ${existing ? `<p class="muted" style="margin-top:0">You already logged today. Saving again updates it.</p>` : ''}
        <form class="checkin-form" id="checkinForm">
          ${seg('appetite', 'Appetite')}
          ${seg('water', 'Drinking')}
          ${seg('energy', 'Energy')}
          ${seg('stool', 'Stool')}
          <div class="row">
            <div class="field"><span class="label">Vomiting (times today)</span>
              <div class="stepper"><button type="button" data-step="-1" aria-label="Fewer">−</button><output id="vomitOut">${c.vomiting}</output><button type="button" data-step="1" aria-label="More">+</button></div>
            </div>
            <div class="field"><label for="walkIn">Walk (minutes)</label><input id="walkIn" type="number" min="0" max="600" value="${c.walkMinutes}"></div>
            <div class="field"><label for="weightIn">Weight (kg, optional)</label><input id="weightIn" type="number" step="0.01" min="0.3" max="120" placeholder="e.g. ${d.weights.at(-1)?.kg ?? ''}"></div>
          </div>
          <div class="field"><label for="noteIn">Anything unusual?</label><input id="noteIn" type="text" maxlength="500" value="${esc(c.note)}" placeholder="Ate something, new food, limping, scratching…"></div>
          <div><button class="primary" type="submit">Save check-in</button></div>
        </form>
      </div>
      <div class="card span-5">
        <div class="card-head"><h2>Status after check-in</h2></div>
        <div id="checkinStatus">
          <div class="status-pill ${d.status.color}" style="display:inline-block">${esc(d.status.label)}</div>
          <p class="muted">Chia re-runs ${p.her} early-warning rules every time you log. The status combines today's check-in with the last few days, weight trend, lab results and vaccines.</p>
          ${d.signals.filter((s) => s.level === 'urgent').length ? signalsHtml(d.signals.filter((s) => s.level === 'urgent')) + `<p><strong>Call ${esc(d.clinic.name)}: <a href="tel:${esc(d.clinic.phone)}">${esc(d.clinic.phone)}</a></strong><br>Out of hours: ${esc(d.emergencyClinic.name)}, <a href="tel:${esc(d.emergencyClinic.phone)}">${esc(d.emergencyClinic.phone)}</a></p>` : ''}
        </div>
      </div>
    </div>`;
}

async function submitCheckin(e) {
  e.preventDefault();
  const c = state.checkin;
  c.walkMinutes = Number($('#walkIn').value || 0);
  c.note = $('#noteIn').value;
  const weight = $('#weightIn').value;
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const before = state.dog.status.label;
    if (weight) await api(`/api/dogs/${state.dogId}/weights`, { kg: Number(weight) });
    const dog = await api(`/api/dogs/${state.dogId}/habits`, {
      appetite: c.appetite, water: c.water, energy: c.energy, stool: c.stool,
      vomiting: c.vomiting, walkMinutes: c.walkMinutes, note: c.note,
    });
    state.checkin = null;
    applyDog(dog);
    toast(dog.status.label !== before ? `Saved. Status changed: ${dog.status.label}` : 'Check-in saved');
  } catch (err) {
    toast(err.message);
    btn.disabled = false;
  }
}

// --- Assistant ---------------------------------------------------------------

function suggestions(dog) {
  const p = pron(dog);
  return [
    'What do the latest blood results mean?',
    `Is ${p.her} weight okay?`,
    `What should I watch for today?`,
    'When are vaccines due?',
    `${p.She} ate chocolate`,
  ];
}

function renderChat() {
  const d = state.dog;
  const msgs = state.chats[d.id] || [];
  const chat = $('#chat');
  if (!msgs.length) {
    chat.innerHTML = `<div class="chat-empty"><div class="big">💬</div>
      <p>Ask anything about ${esc(d.name)}'s health. Chia answers from ${esc(pron(d).her)} record: check-ins, weight, lab results and vet notes.</p></div>`;
  } else {
    chat.innerHTML = msgs.map((m) => {
      if (m.role === 'user') return `<div class="msg user">${esc(m.content)}</div>`;
      const em = m.emergency ? `<div class="emergency"><span class="tag">Emergency check · rule-based</span><b>⚠️ ${esc(m.emergency.title)}</b><span>${esc(m.emergency.detail)}</span><span><strong>${esc(m.emergency.action)}</strong></span></div>` : '';
      if (m.pending) return `${em}<div class="msg assistant thinking">Chia is looking at ${esc(d.name)}'s record…</div>`;
      const body = m.content ? `<div class="msg assistant">${md(m.content)}<div class="via">${m.mode === 'claude' ? `Answered by Claude (${esc(m.model)})` : 'Offline demo answer'}</div></div>` : '';
      return em + body;
    }).join('');
  }
  $('#suggestions').innerHTML = suggestions(d).map((s) => `<button type="button" data-q="${esc(s)}">${esc(s)}</button>`).join('');
  chat.scrollTop = chat.scrollHeight;
}

async function ask(question) {
  question = question.trim();
  if (!question) return;
  const dogId = state.dogId;
  const msgs = (state.chats[dogId] = state.chats[dogId] || []);
  msgs.push({ role: 'user', content: question });
  const reply = { role: 'assistant', content: '', pending: true };
  msgs.push(reply);
  renderChat();
  $('#chatInput').value = '';
  // Rule-based emergency screen first, so the banner shows before any AI answer.
  api(`/api/dogs/${dogId}/screen`, { text: question })
    .then((r) => {
      if (r.emergency && reply.pending) {
        reply.emergency = r.emergency;
        if (state.dogId === dogId) renderChat();
      }
    })
    .catch(() => {});
  try {
    const history = msgs.filter((m) => !m.pending && m.content).map((m) => ({ role: m.role, content: m.content }));
    const res = await api(`/api/dogs/${dogId}/assistant`, { messages: history });
    Object.assign(reply, { pending: false, content: res.text, mode: res.mode, model: res.model, emergency: res.emergency });
  } catch (err) {
    Object.assign(reply, { pending: false, content: `Sorry, something went wrong: ${err.message}`, mode: 'offline' });
  }
  if (state.dogId === dogId) renderChat();
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

// --- Records -----------------------------------------------------------------

function renderRecords() {
  const d = state.dog;
  const records = [...d.records].sort((a, b) => b.date.localeCompare(a.date));
  const labs = [...d.labs].sort((a, b) => b.date.localeCompare(a.date));
  $('#tab-records').innerHTML = `
    <div class="grid">
      <div class="card span-12" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">
        <div><h2 style="margin:0">Share with vet</h2><span class="muted">A one-page summary to print or save as PDF for the vet or the emergency clinic.</span></div>
        <a href="/share.html?dog=${encodeURIComponent(d.id)}" target="_blank" rel="noopener"><button class="primary" type="button">Open summary</button></a>
      </div>
      <div class="card span-7">
        <div class="card-head"><h2>Lab results</h2></div>
        ${labs.map((l) => `
          <div class="lab-block">
            <h3>${esc(l.panel)} <span class="muted" style="font-weight:400">· ${fmtDate(l.date)} · ${esc(l.lab)}</span></h3>
            <table><thead><tr><th>Test</th><th>Result</th><th>Range</th><th></th></tr></thead><tbody>
            ${l.values.map((v) => {
              const flag = v.value > v.high ? 'High' : v.value < v.low ? 'Low' : '';
              return `<tr class="${flag ? 'flag' : ''}"><td>${esc(v.name)}</td><td class="num">${v.value} ${esc(v.unit)}</td><td class="num">${v.low}–${v.high}</td><td>${flag}</td></tr>`;
            }).join('')}
            </tbody></table>
          </div>`).join('') || '<p class="muted">No lab results yet.</p>'}
      </div>
      <div class="card span-5">
        <div class="card-head"><h2>Add a record</h2></div>
        <form id="recordForm" class="checkin-form">
          <div class="row">
            <div class="field"><label for="recType">Type</label>
              <select id="recType"><option value="visit">Vet visit</option><option value="lab">Lab report</option><option value="vaccine">Vaccine</option><option value="note" selected>Note</option><option value="other">Other</option></select></div>
            <div class="field"><label for="recDate">Date</label><input id="recDate" type="date" value="${todayISO()}" max="${todayISO()}"></div>
          </div>
          <div class="field"><label for="recTitle">Title</label><input id="recTitle" type="text" maxlength="200" required placeholder="e.g. Ear infection follow-up"></div>
          <div class="field"><label for="recText">Details</label><textarea id="recText" maxlength="5000" placeholder="What the vet said, medicines given…"></textarea></div>
          <div class="field"><label for="recFile">Attach a file (PDF or photo, max 5 MB)</label><input id="recFile" type="file" accept=".pdf,image/*"></div>
          <div><button class="primary" type="submit">Add record</button></div>
        </form>
      </div>
      <div class="card span-12">
        <div class="card-head"><h2>History</h2></div>
        <ul class="timeline">${records.map((r) => `
          <li><span class="date">${fmtDate(r.date)}</span>
            <div><span class="type ${esc(r.type)}">${esc(r.type)}</span><strong>${esc(r.title)}</strong>
              <div class="muted">${esc(r.text)}</div>
              ${r.file ? `<div><a href="${esc(r.file.url)}" target="_blank" rel="noopener">📎 ${esc(r.file.name)}</a></div>` : ''}
            </div></li>`).join('')}</ul>
      </div>
    </div>`;
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });
}

async function submitRecord(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  const file = $('#recFile').files[0];
  if (file && file.size > 5 * 1024 * 1024) return toast('File is larger than 5 MB');
  btn.disabled = true;
  try {
    const body = { type: $('#recType').value, date: $('#recDate').value, title: $('#recTitle').value, text: $('#recText').value };
    if (file) body.file = { name: file.name, data: await readFileBase64(file) };
    applyDog(await api(`/api/dogs/${state.dogId}/records`, body));
    toast('Record added');
  } catch (err) {
    toast(err.message);
    btn.disabled = false;
  }
}

// --- Profile -----------------------------------------------------------------

function renderProfile() {
  const d = state.dog;
  $('#tab-profile').innerHTML = `
    <div class="grid">
      <div class="card span-6">
        <div class="card-head"><h2>Profile</h2></div>
        <dl class="facts">
          <dt>Name</dt><dd>${esc(d.name)}</dd>
          <dt>Breed</dt><dd>${esc(d.breed)}</dd>
          <dt>Sex</dt><dd>${d.sex === 'female' ? 'Female' : 'Male'}${d.neutered ? (d.sex === 'female' ? ', spayed' : ', neutered') : ''}</dd>
          <dt>Born</dt><dd>${fmtDate(d.birthDate)} (${esc(d.age)})</dd>
          <dt>Colour</dt><dd>${esc(d.color)}</dd>
          <dt>Microchip</dt><dd>${esc(d.microchip)}</dd>
          <dt>Diet</dt><dd>${esc(d.diet)}</dd>
          <dt>Allergies</dt><dd>${d.allergies.length ? esc(d.allergies.join(', ')) : 'None known'}</dd>
          <dt>Conditions</dt><dd>${d.conditions.length ? esc(d.conditions.join(', ')) : 'None known'}</dd>
        </dl>
      </div>
      <div class="card span-6">
        <div class="card-head"><h2>Care team</h2></div>
        <dl class="facts">
          <dt>Vet</dt><dd>${esc(d.clinic.vet)}<br>${esc(d.clinic.name)}<br><a href="tel:${esc(d.clinic.phone)}">${esc(d.clinic.phone)}</a></dd>
          <dt>Emergency</dt><dd>${esc(d.emergencyClinic.name)}<br><a href="tel:${esc(d.emergencyClinic.phone)}">${esc(d.emergencyClinic.phone)}</a></dd>
        </dl>
        <h3 style="margin-top:1rem">Medications</h3>
        ${d.medications.length ? `<ul style="margin:0;padding-left:1.1rem">${d.medications.map((m) => `<li><strong>${esc(m.name)}</strong>, ${esc(m.dose)} <span class="muted">(since ${fmtDate(m.since)})</span></li>`).join('')}</ul>` : '<p class="muted">None</p>'}
        <h3 style="margin-top:1rem">Vaccines</h3>
        <ul style="margin:0;padding-left:1.1rem">${d.vaccines.map((v) => `<li>${esc(v.name)}: given ${fmtDate(v.date)}, due ${fmtDate(v.due)}</li>`).join('')}</ul>
      </div>
      <div class="card span-12">
        <div class="toggle">
          <label class="switch"><input type="checkbox" id="researchToggle" ${d.shareForResearch ? 'checked' : ''}><span></span></label>
          <div>
            <h2 style="margin:0">Share ${esc(d.name)}'s anonymised data for research</h2>
            <p class="muted" style="margin:.25rem 0 0">Opt-in, per dog, and you can turn it off any time. Shared: breed, age, weight trend, daily check-ins and lab values. Never shared: your name, contact details, address or microchip number. Pooled data helps vets and researchers spot early patterns of illness across thousands of dogs.</p>
            <p style="margin:.5rem 0 0;font-weight:600" class="${d.shareForResearch ? '' : 'muted'}">${d.shareForResearch ? '✓ Sharing is on' : 'Sharing is off'}</p>
          </div>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.id !== `tab-${tab}`; });
}

function wire() {
  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) showTab(b.dataset.tab);
  });

  $('#dogSwitcher').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dog]');
    if (b && b.dataset.dog !== state.dogId) selectDog(b.dataset.dog).catch((err) => toast(err.message));
  });

  $('#resetBtn').addEventListener('click', async () => {
    if (!confirm('Reset all demo data to the sample dogs?')) return;
    await api('/api/reset', {});
    state.chats = {};
    state.dogId = null;
    state.tab = 'overview';
    await loadDogs();
    await loadDog();
    render();
    toast('Demo data reset');
  });

  // Habit grid tooltip
  const tip = $('#tooltip');
  document.addEventListener('mouseover', (e) => {
    const cell = e.target.closest('.cell[data-date]');
    if (!cell) { tip.hidden = true; return; }
    tip.innerHTML = habitTooltip(cell.dataset.date);
    tip.hidden = false;
    const r = cell.getBoundingClientRect();
    const left = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2));
    const top = r.top - tip.offsetHeight - 8 < 8 ? r.bottom + 8 : r.top - tip.offsetHeight - 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });

  // Check-in
  $('#tab-checkin').addEventListener('click', (e) => {
    const segBtn = e.target.closest('.seg button');
    if (segBtn) {
      state.checkin.walkMinutes = Number($('#walkIn').value || 0);
      state.checkin.note = $('#noteIn').value;
      state.checkin[segBtn.parentElement.dataset.key] = segBtn.dataset.val;
      const weight = $('#weightIn').value;
      renderCheckin();
      $('#weightIn').value = weight;
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step) {
      state.checkin.vomiting = Math.max(0, Math.min(20, state.checkin.vomiting + Number(step.dataset.step)));
      $('#vomitOut').textContent = state.checkin.vomiting;
    }
  });
  $('#tab-checkin').addEventListener('submit', (e) => { if (e.target.id === 'checkinForm') submitCheckin(e); });

  // Assistant
  $('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); ask($('#chatInput').value); });
  $('#suggestions').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-q]');
    if (b) ask(b.dataset.q);
  });

  // Records
  $('#tab-records').addEventListener('submit', (e) => { if (e.target.id === 'recordForm') submitRecord(e); });

  // Profile consent
  $('#tab-profile').addEventListener('change', async (e) => {
    if (e.target.id !== 'researchToggle') return;
    try {
      applyDog(await api(`/api/dogs/${state.dogId}/consent`, { shareForResearch: e.target.checked }));
      toast(e.target.checked ? 'Research sharing turned on' : 'Research sharing turned off');
    } catch (err) {
      toast(err.message);
    }
  });
}

async function init() {
  wire();
  try {
    const [ai] = await Promise.all([api('/api/status'), loadDogs()]);
    state.ai = ai;
    const badge = $('#aiBadge');
    badge.textContent = ai.mode === 'claude' ? `AI: Claude (${ai.model})` : 'AI: offline demo';
    badge.classList.toggle('live', ai.mode === 'claude');
    if (ai.reason) badge.title = ai.reason;
    await loadDog();
    render();
  } catch (err) {
    $('#hero').innerHTML = `<p>Could not load data: ${esc(err.message)}. Is the server running?</p>`;
  }
}

init();
