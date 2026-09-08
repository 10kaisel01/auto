// ============================================================
// MICRO-MAYHEM DOMÉSTICO — Prototipo jugable (Pista 1: Cocina)
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const CENTER = { x: W / 2, y: H / 2 };
const TRACK_OUTER = { rx: 400, ry: 230 };
const TRACK_INNER = { rx: 230, ry: 110 };

// ---------- Estado del juego ----------
const state = {
  running: false,
  finished: false,
  time: 0,
  lap: 0,
  totalLaps: 3,
  checkpoint: 0, // próximo checkpoint esperado (0..3)
  lastAngleQuadrant: 0,
};

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---------- Auto ----------
const car = {
  x: CENTER.x,
  y: CENTER.y - (TRACK_OUTER.ry + TRACK_INNER.ry) / 2,
  angle: 0, // radianes, 0 = derecha
  speed: 0,
  maxSpeed: 5.4,
  boostMaxSpeed: 8.6,
  accel: 0.16,
  turnRate: 0.045,
  friction: 0.985,
  offTrackPenalty: 0.9,
  boost: 100,
  boostMax: 100,
  isBoosting: false,
  isOffTrack: false,
};

let particles = [];
let toaster = { timer: 0, active: false, x: CENTER.x + 250, y: CENTER.y + 40, radius: 46 };

// ---------- Utilidades de pista ----------
function ellipseContains(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function onTrack(px, py) {
  const inOuter = ellipseContains(px, py, CENTER.x, CENTER.y, TRACK_OUTER.rx, TRACK_OUTER.ry);
  const inInner = ellipseContains(px, py, CENTER.x, CENTER.y, TRACK_INNER.rx, TRACK_INNER.ry);
  return inOuter && !inInner;
}

function distToInnerEdge(px, py) {
  const dx = (px - CENTER.x) / TRACK_INNER.rx;
  const dy = (py - CENTER.y) / TRACK_INNER.ry;
  const d = Math.sqrt(dx * dx + dy * dy);
  return Math.abs(d - 1); // 0 = justo en el borde interior (near-miss)
}

function angleQuadrant(px, py) {
  const a = Math.atan2(py - CENTER.y, px - CENTER.x);
  const norm = (a + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(norm / (Math.PI / 2)); // 0..3
}

// ---------- Física del auto ----------
function updateCar(dt) {
  const forward = keys['ArrowUp'] || keys['KeyW'];
  const backward = keys['ArrowDown'] || keys['KeyS'];
  const left = keys['ArrowLeft'] || keys['KeyA'];
  const right = keys['ArrowRight'] || keys['KeyD'];
  const boostKey = keys['Space'];

  car.isOffTrack = !onTrack(car.x, car.y);
  const speedCap = car.isOffTrack ? car.maxSpeed * car.offTrackPenalty : car.maxSpeed;
  const cap = car.isBoosting ? car.boostMaxSpeed : speedCap;

  if (forward) car.speed += car.accel;
  else if (backward) car.speed -= car.accel * 0.7;
  else car.speed *= car.friction;

  car.speed = Math.max(-cap * 0.5, Math.min(cap, car.speed));

  const turnFactor = Math.min(1, Math.abs(car.speed) / 2.5);
  let turning = false;
  if (left) { car.angle -= car.turnRate * turnFactor; turning = true; }
  if (right) { car.angle += car.turnRate * turnFactor; turning = true; }

  // Boost
  car.isBoosting = boostKey && car.boost > 0 && car.speed > 1;
  if (car.isBoosting) {
    car.speed += car.accel * 1.4;
    car.boost = Math.max(0, car.boost - dt * 42);
    if (Math.random() < 0.7) spawnSpark();
  } else {
    // Recarga por derrape (girar a buena velocidad)
    if (turning && Math.abs(car.speed) > 3) {
      car.boost = Math.min(car.boostMax, car.boost + dt * 14);
    }
  }

  // Recarga extra por near-miss al borde interior
  const edgeDist = distToInnerEdge(car.x, car.y);
  if (edgeDist < 0.06 && Math.abs(car.speed) > 2) {
    car.boost = Math.min(car.boostMax, car.boost + dt * 30);
  }

  // Distorsión por calor de la tostadora: si está activa y el auto está cerca, penaliza control
  let heatFactor = 1;
  if (toaster.active) {
    const dx = car.x - toaster.x, dy = car.y - toaster.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < toaster.radius * 2.2) {
      heatFactor = 0.55; // el auto "tiembla" y pierde tracción
    }
  }

  car.x += Math.cos(car.angle) * car.speed * heatFactor;
  car.y += Math.sin(car.angle) * car.speed * heatFactor;

  updateLapProgress();
}

function updateLapProgress() {
  const q = angleQuadrant(car.x, car.y);
  if (q !== state.lastAngleQuadrant) {
    const expected = (state.checkpoint) % 4;
    if (q === expected) {
      state.checkpoint++;
      if (state.checkpoint % 4 === 0) {
        state.lap++;
        showLapToast();
        if (state.lap >= state.totalLaps) finishRace();
      }
    }
    state.lastAngleQuadrant = q;
  }
}

// ---------- Partículas ----------
function spawnSpark() {
  const backX = car.x - Math.cos(car.angle) * 14;
  const backY = car.y - Math.sin(car.angle) * 14;
  particles.push({
    x: backX + (Math.random() - 0.5) * 6,
    y: backY + (Math.random() - 0.5) * 6,
    vx: -Math.cos(car.angle) * (1 + Math.random() * 2) + (Math.random() - 0.5),
    vy: -Math.sin(car.angle) * (1 + Math.random() * 2) + (Math.random() - 0.5),
    life: 1,
    color: Math.random() < 0.5 ? '#F3D98B' : '#E4572E',
    size: 2 + Math.random() * 2,
  });
}

function spawnCrumb() {
  particles.push({
    x: toaster.x + (Math.random() - 0.5) * 20,
    y: toaster.y - 20,
    vx: (Math.random() - 0.5) * 1.5,
    vy: -1 - Math.random(),
    life: 1,
    color: '#C9A24B',
    size: 1.5 + Math.random() * 1.5,
    gravity: true,
  });
}

function updateParticles(dt) {
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.gravity) p.vy += 0.05;
    p.life -= dt * 1.6;
  });
  particles = particles.filter(p => p.life > 0);
}

// ---------- Evento dinámico: tostadora ----------
function updateToaster(dt) {
  toaster.timer += dt;
  if (!toaster.active && toaster.timer > 6) {
    toaster.active = true;
    toaster.timer = 0;
  } else if (toaster.active && toaster.timer > 3) {
    toaster.active = false;
    toaster.timer = 0;
  }
  if (toaster.active && Math.random() < 0.5) spawnCrumb();
}

// ---------- Dibujo ----------
function drawTrack() {
  // Piso de madera ya está de fondo (CSS). Dibujamos mesada de mármol.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(CENTER.x, CENTER.y, TRACK_OUTER.rx, TRACK_OUTER.ry, 0, 0, Math.PI * 2);
  const marbleGrad = ctx.createRadialGradient(CENTER.x, CENTER.y, 50, CENTER.x, CENTER.y, TRACK_OUTER.rx);
  marbleGrad.addColorStop(0, '#f4f1ea');
  marbleGrad.addColorStop(1, '#e4ddce');
  ctx.fillStyle = marbleGrad;
  ctx.fill();

  // Vetas de mármol sutiles
  ctx.strokeStyle = 'rgba(150,140,120,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(CENTER.x - TRACK_OUTER.rx + i * 80, CENTER.y - TRACK_OUTER.ry);
    ctx.quadraticCurveTo(CENTER.x - TRACK_OUTER.rx + i * 80 + 40, CENTER.y, CENTER.x - TRACK_OUTER.rx + i * 80 - 20, CENTER.y + TRACK_OUTER.ry);
    ctx.stroke();
  }
  ctx.restore();

  // Isla central (obstáculos de cocina)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(CENTER.x, CENTER.y, TRACK_INNER.rx, TRACK_INNER.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8B5E34';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // Línea de meta
  ctx.save();
  ctx.strokeStyle = '#1F2A44';
  ctx.lineWidth = 6;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(CENTER.x, CENTER.y - TRACK_OUTER.ry);
  ctx.lineTo(CENTER.x, CENTER.y - TRACK_INNER.ry);
  ctx.stroke();
  ctx.restore();

  // Borde exterior de la pista
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(CENTER.x, CENTER.y, TRACK_OUTER.rx, TRACK_OUTER.ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(31,42,68,0.5)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function drawToaster() {
  ctx.save();
  const glow = toaster.active ? 1 : 0.35;
  const grad = ctx.createRadialGradient(toaster.x, toaster.y, 4, toaster.x, toaster.y, toaster.radius);
  grad.addColorStop(0, `rgba(228,87,46,${glow})`);
  grad.addColorStop(1, 'rgba(228,87,46,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(toaster.x, toaster.y, toaster.radius, 0, Math.PI * 2);
  ctx.fill();

  // Cuerpo de la tostadora
  ctx.fillStyle = '#C7C7C7';
  ctx.fillRect(toaster.x - 22, toaster.y - 16, 44, 32);
  ctx.fillStyle = toaster.active ? '#E4572E' : '#8a8a8a';
  ctx.fillRect(toaster.x - 14, toaster.y - 10, 10, 20);
  ctx.fillRect(toaster.x + 4, toaster.y - 10, 10, 20);
  ctx.restore();
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawCar() {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Carrocería
  ctx.fillStyle = car.isOffTrack ? '#a9a29a' : '#1F2A44';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#C9A24B';
  ctx.beginPath();
  ctx.arc(4, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  if (car.isBoosting) {
    ctx.fillStyle = 'rgba(228,87,46,0.85)';
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-20 - Math.random() * 8, 0);
    ctx.lineTo(-10, 4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ---------- Loop principal ----------
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  ctx.clearRect(0, 0, W, H);
  drawTrack();
  drawToaster();

  if (state.running && !state.finished) {
    updateCar(dt);
    updateToaster(dt);
    updateParticles(dt);
    state.time += dt;
    updateHUD();
  } else {
    updateParticles(dt);
  }

  drawParticles();
  drawCar();

  requestAnimationFrame(loop);
}

// ---------- HUD ----------
const lapValue = document.getElementById('lapValue');
const timeValue = document.getElementById('timeValue');
const boostFill = document.getElementById('boostFill');
const lapToast = document.getElementById('lapToast');

function updateHUD() {
  lapValue.textContent = `${Math.min(state.lap, state.totalLaps)} / ${state.totalLaps}`;
  const mins = Math.floor(state.time / 60).toString().padStart(2, '0');
  const secs = (state.time % 60).toFixed(1).padStart(4, '0');
  timeValue.textContent = `${mins}:${secs}`;
  boostFill.style.width = `${car.boost}%`;
}

let lapToastTimer = null;
function showLapToast() {
  lapToast.textContent = state.lap < state.totalLaps ? `¡Vuelta ${state.lap} completada!` : '¡Última vuelta superada!';
  lapToast.classList.remove('hidden');
  clearTimeout(lapToastTimer);
  lapToastTimer = setTimeout(() => lapToast.classList.add('hidden'), 1600);
}

// ---------- Flujo de partida ----------
const startOverlay = document.getElementById('startOverlay');
const finishOverlay = document.getElementById('finishOverlay');
const finalTime = document.getElementById('finalTime');

function resetGame() {
  car.x = CENTER.x;
  car.y = CENTER.y - (TRACK_OUTER.ry + TRACK_INNER.ry) / 2;
  car.angle = 0;
  car.speed = 0;
  car.boost = car.boostMax;
  state.time = 0;
  state.lap = 0;
  state.checkpoint = 0;
  state.lastAngleQuadrant = angleQuadrant(car.x, car.y);
  state.finished = false;
  particles = [];
  toaster.active = false;
  toaster.timer = 0;
}

function startRace() {
  resetGame();
  state.running = true;
  startOverlay.classList.add('hidden');
  finishOverlay.classList.add('hidden');
}

function finishRace() {
  state.finished = true;
  state.running = false;
  const mins = Math.floor(state.time / 60).toString().padStart(2, '0');
  const secs = (state.time % 60).toFixed(1).padStart(4, '0');
  finalTime.textContent = `${mins}:${secs}`;
  setTimeout(() => finishOverlay.classList.remove('hidden'), 500);
}

document.getElementById('startBtn').addEventListener('click', startRace);
document.getElementById('restartBtn').addEventListener('click', startRace);

resetGame();
requestAnimationFrame(loop);
