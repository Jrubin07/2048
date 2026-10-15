// Chia demo server: static web app + small JSON API. No dependencies required;
// install @anthropic-ai/sdk (npm install) and set ANTHROPIC_API_KEY to enable Claude.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { seed } = require('./lib/seed');
const { analyze, ageText, today } = require('./lib/insights');
const assistant = require('./lib/assistant');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const MAX_BODY = 8 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Storage (one JSON file)
// ---------------------------------------------------------------------------

let db;

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function reset() {
  db = seed();
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  save();
}

function load() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    reset();
  }
}

function findDog(id) {
  const dog = db.dogs.find((d) => d.id === id);
  if (!dog) throw httpError(404, 'Dog not found');
  return dog;
}

function withInsights(dog) {
  return { ...dog, age: ageText(dog.birthDate), ...analyze(dog) };
}

function summary(dog) {
  const { status, signals } = analyze(dog);
  const weights = [...dog.weights].sort((a, b) => a.date.localeCompare(b.date));
  return {
    id: dog.id, name: dog.name, breed: dog.breed, sex: dog.sex, avatar: dog.avatar,
    age: ageText(dog.birthDate), weightKg: weights.length ? weights[weights.length - 1].kg : null,
    status, signalCount: signals.filter((s) => s.level !== 'info').length,
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function isoDate(value) {
  if (value === undefined || value === null || value === '') return today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw httpError(400, 'date must be YYYY-MM-DD');
  return value;
}

function oneOf(value, allowed, name, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!allowed.includes(value)) throw httpError(400, `${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

function number(value, name, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, `${name} must be a number between ${min} and ${max}`);
  return n;
}

function text(value, max = 2000) {
  return String(value || '').slice(0, max).trim();
}

function upsertByDate(list, entry) {
  const i = list.findIndex((x) => x.date === entry.date);
  if (i >= 0) list[i] = entry;
  else list.push(entry);
  list.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const routes = [
  ['GET', /^\/api\/status$/, () => assistant.mode()],
  ['GET', /^\/api\/dogs$/, () => db.dogs.map(summary)],
  ['GET', /^\/api\/dogs\/([\w-]+)$/, (_, id) => withInsights(findDog(id))],

  ['POST', /^\/api\/dogs\/([\w-]+)\/weights$/, (body, id) => {
    const dog = findDog(id);
    const kg = number(body.kg, 'kg', 0.3, 120);
    if (kg === undefined) throw httpError(400, 'kg is required');
    upsertByDate(dog.weights, { date: isoDate(body.date), kg: Math.round(kg * 100) / 100 });
    save();
    return withInsights(dog);
  }],

  ['POST', /^\/api\/dogs\/([\w-]+)\/habits$/, (body, id) => {
    const dog = findDog(id);
    upsertByDate(dog.habits, {
      date: isoDate(body.date),
      appetite: oneOf(body.appetite, ['none', 'reduced', 'normal', 'increased'], 'appetite', 'normal'),
      water: oneOf(body.water, ['less', 'normal', 'more'], 'water', 'normal'),
      energy: oneOf(body.energy, ['low', 'normal', 'high'], 'energy', 'normal'),
      stool: oneOf(body.stool, ['none', 'normal', 'soft', 'diarrhea'], 'stool', 'normal'),
      vomiting: Math.round(number(body.vomiting, 'vomiting', 0, 20, 0)),
      walkMinutes: Math.round(number(body.walkMinutes, 'walkMinutes', 0, 600, 0)),
      note: text(body.note, 500),
    });
    save();
    return withInsights(dog);
  }],

  ['POST', /^\/api\/dogs\/([\w-]+)\/records$/, (body, id) => {
    const dog = findDog(id);
    const title = text(body.title, 200);
    if (!title) throw httpError(400, 'title is required');
    const record = {
      id: `rec-${crypto.randomUUID().slice(0, 8)}`,
      type: oneOf(body.type, ['visit', 'lab', 'vaccine', 'note', 'other'], 'type', 'note'),
      title,
      date: isoDate(body.date),
      text: text(body.text, 5000),
    };
    if (body.file && body.file.data) {
      const name = path.basename(text(body.file.name, 120) || 'file').replace(/[^\w.-]+/g, '_');
      const stored = `${record.id}-${name}`;
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, stored), Buffer.from(String(body.file.data), 'base64'));
      record.file = { name, url: `/files/${stored}` };
    }
    dog.records.push(record);
    save();
    return withInsights(dog);
  }],

  ['POST', /^\/api\/dogs\/([\w-]+)\/consent$/, (body, id) => {
    const dog = findDog(id);
    dog.shareForResearch = Boolean(body.shareForResearch);
    save();
    return withInsights(dog);
  }],

  // Emergency keyword screen only: instant, no AI. Lets the app show the banner before the answer arrives.
  ['POST', /^\/api\/dogs\/([\w-]+)\/screen$/, (body, id) => ({ emergency: assistant.emergencyScreen(text(body.text, 4000), findDog(id)) })],

  ['POST', /^\/api\/dogs\/([\w-]+)\/assistant$/, (body, id) => assistant.respond(findDog(id), body.messages)],

  ['POST', /^\/api\/reset$/, () => {
    reset();
    return { ok: true };
  }],
];

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(httpError(413, 'Request too large (max 8 MB)'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(httpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf',
  '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

function sendFile(res, root, rel, download) {
  const file = path.join(root, path.normalize(rel).replace(/^([/\\]|\.\.)+/, ''));
  if (!file.startsWith(root + path.sep)) return sendJson(res, 404, { error: 'Not found' });
  fs.readFile(file, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Not found' });
    const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' };
    if (download) headers['Content-Disposition'] = 'inline';
    res.writeHead(200, headers);
    res.end(data);
  });
}

// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    const route = routes.find(([method, re]) => method === req.method && re.test(pathname));
    if (!route) return sendJson(res, 404, { error: 'Not found' });
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const params = pathname.match(route[1]).slice(1);
      sendJson(res, 200, await route[2](body, ...params));
    } catch (err) {
      if (!err.status) console.error(err);
      sendJson(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
    }
    return;
  }

  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  if (pathname.startsWith('/files/')) return sendFile(res, UPLOAD_DIR, pathname.slice('/files/'.length), true);
  sendFile(res, PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
});

load();
server.listen(PORT, () => {
  const m = assistant.mode();
  console.log(`Chia demo running at http://localhost:${PORT}`);
  console.log(m.mode === 'claude'
    ? `Assistant: Claude (${m.model})`
    : `Assistant: offline demo mode${m.reason ? ` (${m.reason})` : ' (set ANTHROPIC_API_KEY to use Claude)'}`);
});
