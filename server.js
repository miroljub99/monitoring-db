const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

const SRC_PATH = path.join(process.cwd(), 'db.json');
const TMP_DIR = process.env.TEMP || '/tmp';
const WORK_PATH = fs.existsSync(TMP_DIR) ? path.join(TMP_DIR, 'db.runtime.json')
                                         : path.join(process.cwd(), 'db.runtime.json');

// init runtime db if missing or empty/invalid
function ensureRuntimeDb() {
  try {
    const raw = fs.existsSync(WORK_PATH) ? fs.readFileSync(WORK_PATH, 'utf8') : '';
    if (!raw.trim()) throw new Error('runtime empty');
    JSON.parse(raw); // validate
  } catch {
    const src = fs.readFileSync(SRC_PATH, 'utf8');
    JSON.parse(src); // validate src; will throw if tvoj db.json nije validan
    fs.writeFileSync(WORK_PATH, src);
    console.log('📄 Runtime DB reinitialized from src');
  }
}

// safe read helper
function readJsonSafe(p) {
  const raw = fs.readFileSync(p, 'utf8');
  if (!raw.trim()) throw new Error('empty json');
  return JSON.parse(raw);
}

// atomic write helper
function writeJsonAtomic(p, obj) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

ensureRuntimeDb();

const statuses = ['online', 'offline', 'degraded'];
const rand = (min, max) => Math.round(Math.random() * (max - min) + min);

function updateData() {
  ensureRuntimeDb(); // if something went wrong, heal before update
  const json = readJsonSafe(WORK_PATH);

  json.services.forEach(s => {
    s.status = statuses[rand(0, statuses.length - 1)];
    if (s.status === 'online' || s.status === 'degraded') {
      s.cpu = rand(20, 90);
      s.memory = rand(200, 1024);
      s.responseTime = rand(80, 300);
      s.errors = rand(0, 5);
    } else {
      s.cpu = 0; s.memory = 0; s.responseTime = 0; s.errors = rand(5, 20);
    }
  });

  writeJsonAtomic(WORK_PATH, json);
  console.log('✅ Podaci osveženi');
}

// --- simulator on-demand ---
let intervalId = null;
let lastActivity = Date.now();

function startSimulator() {
  if (!intervalId) {
    console.log('▶️ Simulator start');
    intervalId = setInterval(() => {
      try { updateData(); } catch (e) { console.error('Update fail', e); ensureRuntimeDb(); }
      if (Date.now() - lastActivity > 15 * 60 * 1000) stopSimulator();
    }, 10000);
  }
}
function stopSimulator() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏸️ Simulator pauziran (idle)');
  }
}

app.get('/', (_req, res) => res.send('API up. Try /services'));

app.get('/services', (_req, res) => {
  try {
    lastActivity = Date.now();
    startSimulator();
    ensureRuntimeDb();

    const obj = readJsonSafe(WORK_PATH); // { services: [...] } ili []
    const list = Array.isArray(obj)
      ? obj
      : Array.isArray(obj?.services)
        ? obj.services
        : [];

    res.json(list); // Vrati niz koji frontend očekuje
  } catch (err) {
    console.error('READ FAIL', err);
    res.status(500).json({ error: 'Failed to read data', detail: String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 API on port ${PORT}`));
