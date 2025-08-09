const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

const filePath = path.join(process.cwd(), 'db.json');
const statuses = ['online', 'offline', 'degraded'];

function rand(min, max) { return Math.round(Math.random() * (max - min) + min); }

function updateData() {
  const data = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(data);

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

  fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
  console.log('✅ Podaci osveženi');
}

// --- simulator control ---
let intervalId = null;
let lastActivity = Date.now();

function startSimulator() {
  if (!intervalId) {
    console.log('▶️ Simulator start');
    intervalId = setInterval(() => {
      updateData();
      if (Date.now() - lastActivity > 8 * 60 * 1000) stopSimulator(); // 8 min idle
    }, 10000);
  }
}
function stopSimulator() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏸️ Simulator pause (inactivity)');
  }
}

// API
app.get('/services', (req, res) => {
  lastActivity = Date.now();
  startSimulator();
  const data = fs.readFileSync(filePath, 'utf8');
  res.json(JSON.parse(data));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 API on port ${PORT}`));