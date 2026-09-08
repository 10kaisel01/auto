// ============================================================
// MICRO-MAYHEM DOMÉSTICO — Prototipo 3D (Three.js)
// Cámara en tercera persona, baja al piso, estilo kart de carreras.
// La pista recorre la casa completa: cocina, living, baño y pasillo.
// ============================================================

// ---------- Dimensiones de la pista (unidades de mundo) ----------
const TRACK_OUTER = { rx: 26, rz: 15.5 };
const TRACK_INNER = { rx: 14.5, rz: 7 };
const RING_SEGMENTS = 96;

// Colores por zona de la casa (0..3), en el orden en que se recorren
const ZONE_COLORS = [
  0xEDE7DD, // 0: Cocina — mesada de mármol claro
  0xD8E7EC, // 1: Baño — piso de cerámica celeste claro
  0xB98A55, // 2: Pasillo — piso de madera cálida
  0xC96B4A, // 3: Living — alfombra terracota
];

// ============================================================
// ESCENA, CÁMARA, RENDERER
// ============================================================
const container = document.getElementById('sceneContainer');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe0e8);
scene.fog = new THREE.Fog(0xE9DFC8, 30, 78);

const camera = new THREE.PerspectiveCamera(72, 960 / 560, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

function resizeRenderer() {
  const w = container.clientWidth || 960;
  const h = container.clientHeight || 560;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeRenderer);

// ---------- Luces: hora dorada entrando por la ventana ----------
const hemi = new THREE.HemisphereLight(0xfff3d6, 0x6b6459, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffd9a0, 1.15);
sun.position.set(-30, 26, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 100;
scene.add(sun);

const fill = new THREE.PointLight(0xffe3b8, 0.4, 60);
fill.position.set(20, 10, -10);
scene.add(fill);

// ============================================================
// GEOMETRÍA DE LA PISTA — anillo elíptico con 4 zonas de la casa
// ============================================================
function buildTrackRing() {
  const positions = [];
  const colors = [];
  const indices = [];
  const palette = ZONE_COLORS.map(c => new THREE.Color(c));

  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const t = (i / RING_SEGMENTS) * Math.PI * 2;
    const q = Math.floor(((t + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4;
    const col = palette[q];

    const ox = Math.cos(t) * TRACK_OUTER.rx;
    const oz = Math.sin(t) * TRACK_OUTER.rz;
    const ix = Math.cos(t) * TRACK_INNER.rx;
    const iz = Math.sin(t) * TRACK_INNER.rz;

    positions.push(ox, 0, oz, ix, 0, iz);
    colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
  }

  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
scene.add(buildTrackRing());

// ---------- Piso exterior (madera de la casa, con vetas procedurales) ----------
function buildWoodTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#8B5E34';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * 512 + (Math.random() - 0.5) * 6;
    g.strokeStyle = `rgba(60,38,18,${0.15 + Math.random() * 0.12})`;
    g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) {
      g.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}
const outerFloor = new THREE.Mesh(
  new THREE.CircleGeometry(90, 48),
  new THREE.MeshStandardMaterial({ map: buildWoodTexture(), roughness: 0.88 })
);
outerFloor.rotation.x = -Math.PI / 2;
outerFloor.position.y = -0.02;
outerFloor.receiveShadow = true;
scene.add(outerFloor);

// ---------- Props decorativos: bloques tipo Lego y rampa de cartón ----------
function addLegoScatter() {
  const legoColors = [0xC0392B, 0xF1C40F, 0x2980B9, 0x27AE60, 0xE67E22];
  const group = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = TRACK_OUTER.rx + 6 + Math.random() * 14;
    const x = Math.cos(ang) * r * (TRACK_OUTER.rx / TRACK_OUTER.rx);
    const z = Math.sin(ang) * (r * (TRACK_OUTER.rz / TRACK_OUTER.rx));
    const size = 0.35 + Math.random() * 0.3;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color: legoColors[i % legoColors.length], roughness: 0.4 })
    );
    block.position.set(x, size / 2, z);
    block.rotation.y = Math.random() * Math.PI;
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
  }
  // Rampa de cartón decorativa
  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.3, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xC9A24B, roughness: 0.9 })
  );
  ramp.position.set(-(TRACK_OUTER.rx + 10), 0.5, -8);
  ramp.rotation.z = 0.35;
  ramp.castShadow = true;
  group.add(ramp);
  scene.add(group);
}
addLegoScatter();

// ---------- Isla central (muebles/isla de cocina, obstáculo sólido) ----------
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 1.1, 32, 1, false),
  new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.7 })
);
island.scale.set(TRACK_INNER.rx * 0.92, 1, TRACK_INNER.rz * 0.92);
island.position.y = 0.55;
island.castShadow = true;
island.receiveShadow = true;
scene.add(island);

// ---------- Paredes perimetrales de la casa ----------
function makeWallSegment(cx, cz, rotY, width) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, 8, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xF4F1EA, roughness: 0.9 })
  );
  wall.position.set(cx, 4, cz);
  wall.rotation.y = rotY;
  wall.receiveShadow = true;
  wall.castShadow = true;
  scene.add(wall);
}
const wallDist = TRACK_OUTER.rx + 6;
makeWallSegment(0, -TRACK_OUTER.rz - 6, 0, TRACK_OUTER.rx * 2.3);
makeWallSegment(0, TRACK_OUTER.rz + 6, 0, TRACK_OUTER.rx * 2.3);
makeWallSegment(-wallDist, 0, Math.PI / 2, TRACK_OUTER.rz * 2.3);
makeWallSegment(wallDist, 0, Math.PI / 2, TRACK_OUTER.rz * 2.3);

// Ventana con luz cálida (hint de "hora dorada")
const windowGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 4.5),
  new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.9 })
);
windowGlow.position.set(-wallDist + 0.31, 5, -6);
windowGlow.rotation.y = Math.PI / 2;
scene.add(windowGlow);

// ============================================================
// TOSTADORA — evento dinámico (calor / distorsión)
// ============================================================
const toaster = {
  active: false,
  timer: 0,
  x: 8, z: 4, radius: 6,
};
const toasterGroup = new THREE.Group();
const toasterBody = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 1.1, 1.1),
  new THREE.MeshStandardMaterial({ color: 0xC7C7C7, metalness: 0.6, roughness: 0.35 })
);
toasterBody.castShadow = true;
toasterGroup.add(toasterBody);
const toasterGlowMat = new THREE.MeshBasicMaterial({ color: 0xE4572E, transparent: true, opacity: 0 });
const toasterGlow = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 16), toasterGlowMat);
toasterGroup.add(toasterGlow);
const toasterLight = new THREE.PointLight(0xE4572E, 0, 10);
toasterGroup.add(toasterLight);
toasterGroup.position.set(toaster.x, island.position.y + 1.1, toaster.z);
scene.add(toasterGroup);

// Rebanada de pan que sale disparada cuando se activa la tostadora
const toastSlices = [];
function spawnToast() {
  const slice = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.5, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xD9A24B, roughness: 0.7 })
  );
  slice.position.set(toasterGroup.position.x, toasterGroup.position.y + 0.4, toasterGroup.position.z);
  slice.castShadow = true;
  scene.add(slice);
  toastSlices.push({ mesh: slice, vy: 6.5, vx: (Math.random() - 0.5) * 0.6, life: 1.4 });
}
function updateToastSlices(dt) {
  for (let i = toastSlices.length - 1; i >= 0; i--) {
    const t = toastSlices[i];
    t.mesh.position.y += t.vy * dt;
    t.mesh.position.x += t.vx * dt;
    t.vy -= 9 * dt;
    t.mesh.rotation.x += dt * 4;
    t.life -= dt;
    if (t.life <= 0) {
      scene.remove(t.mesh);
      toastSlices.splice(i, 1);
    }
  }
}

// ---------- Partículas: migas de la tostadora + chispas de boost ----------
const particleGeo = new THREE.SphereGeometry(0.06, 6, 6);
const sparkPool = [];
function spawnParticle(x, y, z, vx, vy, vz, color, life) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(particleGeo, mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  sparkPool.push({ mesh, vx, vy, vz, life, maxLife: life });
}
function updateParticles(dt) {
  for (let i = sparkPool.length - 1; i >= 0; i--) {
    const p = sparkPool[i];
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= 2.2 * dt;
    p.life -= dt;
    p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    p.mesh.material.transparent = true;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.material.dispose();
      sparkPool.splice(i, 1);
    }
  }
}

function updateToaster(dt) {
  toaster.timer += dt;
  if (!toaster.active && toaster.timer > 6) {
    toaster.active = true;
    toaster.timer = 0;
    spawnToast();
  } else if (toaster.active && toaster.timer > 3) {
    toaster.active = false;
    toaster.timer = 0;
  }
  updateToastSlices(dt);
  const targetOpacity = toaster.active ? 0.55 : 0;
  toasterGlowMat.opacity += (targetOpacity - toasterGlowMat.opacity) * 0.1;
  toasterLight.intensity += ((toaster.active ? 2.2 : 0) - toasterLight.intensity) * 0.1;

  if (toaster.active && Math.random() < 0.5) {
    spawnParticle(
      toaster.x + (Math.random() - 0.5) * 0.8,
      toasterGroup.position.y + 0.6,
      toaster.z + (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 1.5, 2 + Math.random(), (Math.random() - 0.5) * 1.5,
      0xC9A24B, 0.9
    );
  }
}

// ============================================================
// KART DEL JUGADOR — estilo monster truck de juguete (capot visible en cámara)
// ============================================================
const kart = new THREE.Group();

const chassis = new THREE.Mesh(
  new THREE.BoxGeometry(1.3, 0.5, 2.1),
  new THREE.MeshStandardMaterial({ color: 0xE8B23B, roughness: 0.45, metalness: 0.1 })
);
chassis.position.y = 0.62;
chassis.castShadow = true;
kart.add(chassis);

// Capot ancho e inclinado hacia la cámara (lo que se ve en primer plano)
const hood = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 0.34, 1.15),
  new THREE.MeshStandardMaterial({ color: 0xF0C24B, roughness: 0.35, metalness: 0.12 })
);
hood.position.set(0, 0.86, 0.55);
hood.rotation.x = -0.12;
hood.castShadow = true;
kart.add(hood);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(0.85, 0.32, 0.75),
  new THREE.MeshStandardMaterial({ color: 0x1F2A44, roughness: 0.3, metalness: 0.2 })
);
cabin.position.set(0, 1.0, -0.35);
cabin.castShadow = true;
kart.add(cabin);

// Barra antivuelco (detalle tipo RC)
const rollBar = new THREE.Mesh(
  new THREE.TorusGeometry(0.55, 0.05, 8, 16, Math.PI),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.5, roughness: 0.4 })
);
rollBar.rotation.z = Math.PI;
rollBar.rotation.x = Math.PI / 2;
rollBar.position.set(0, 1.15, -0.6);
kart.add(rollBar);

// Ruedas grandes tipo monster truck
const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.42, 20);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xC9A24B, metalness: 0.5, roughness: 0.3 });
const wheelPositions = [
  [-0.78, 0.5, 0.78], [0.78, 0.5, 0.78],
  [-0.78, 0.5, -0.78], [0.78, 0.5, -0.78],
];
const wheels = wheelPositions.map(([x, y, z]) => {
  const w = new THREE.Mesh(wheelGeo, wheelMat);
  w.rotation.z = Math.PI / 2;
  w.position.set(x, y, z);
  w.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.44, 12), hubMat);
  hub.rotation.z = Math.PI / 2;
  w.add(hub);
  kart.add(w);
  return w;
});

scene.add(kart);

// ============================================================
// FÍSICA ARCADE (estilo Mario Kart)
// ============================================================
const car = {
  x: 0, z: -(TRACK_OUTER.rz + TRACK_INNER.rz) / 2,
  heading: Math.PI / 2,
  speed: 0,
  maxSpeed: 15.5,
  boostMaxSpeed: 23,
  accel: 0.42,
  turnRate: 2.1,
  friction: 0.985,
  boost: 100,
  boostMax: 100,
  isBoosting: false,
};

function forwardVec(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function ellipseValue(x, z, rx, rz) {
  return (x / rx) * (x / rx) + (z / rz) * (z / rz);
}

function updateCar(dt) {
  const forward = keys['ArrowUp'] || keys['KeyW'];
  const backward = keys['ArrowDown'] || keys['KeyS'];
  const left = keys['ArrowLeft'] || keys['KeyA'];
  const right = keys['ArrowRight'] || keys['KeyD'];
  const boostKey = keys['Space'];

  if (forward) car.speed += car.accel;
  else if (backward) car.speed -= car.accel * 0.7;
  else car.speed *= car.friction;

  car.isBoosting = !!(boostKey && car.boost > 0 && car.speed > 2);
  const cap = car.isBoosting ? car.boostMaxSpeed : car.maxSpeed;
  car.speed = Math.max(-cap * 0.4, Math.min(cap, car.speed));

  const turnFactor = Math.min(1, Math.abs(car.speed) / 6);
  let turning = false;
  const dir = car.speed >= 0 ? 1 : -1;
  if (left) { car.heading += car.turnRate * turnFactor * dt * dir; turning = true; }
  if (right) { car.heading -= car.turnRate * turnFactor * dt * dir; turning = true; }

  if (car.isBoosting) {
    car.speed += car.accel * 1.6;
    car.boost = Math.max(0, car.boost - dt * 40);
    if (Math.random() < 0.6) {
      const f = forwardVec(car.heading);
      spawnParticle(
        car.x - f.x * 1.1, 0.35, car.z - f.z * 1.1,
        -f.x * 3 + (Math.random() - 0.5), 1.5 + Math.random(), -f.z * 3 + (Math.random() - 0.5),
        Math.random() < 0.5 ? 0xF3D98B : 0xE4572E, 0.5
      );
    }
  } else if (turning && Math.abs(car.speed) > 7) {
    car.boost = Math.min(car.boostMax, car.boost + dt * 16);
  }

  // Distorsión de calor cerca de la tostadora
  let heatFactor = 1;
  if (toaster.active) {
    const dx = car.x - toaster.x, dz = car.z - toaster.z;
    if (Math.sqrt(dx * dx + dz * dz) < toaster.radius) heatFactor = 0.55;
  }

  const f = forwardVec(car.heading);
  let nx = car.x + f.x * car.speed * dt * heatFactor;
  let nz = car.z + f.z * car.speed * dt * heatFactor;

  // Colisión con isla central (empuja hacia afuera)
  const innerVal = ellipseValue(nx, nz, TRACK_INNER.rx * 0.9, TRACK_INNER.rz * 0.9);
  if (innerVal < 1) {
    const ang = Math.atan2(nz, nx);
    nx = Math.cos(ang) * TRACK_INNER.rx * 0.9 * 1.02;
    nz = Math.sin(ang) * TRACK_INNER.rz * 0.9 * 1.02;
    car.speed *= 0.55;
  } else if (innerVal < 1.15 && Math.abs(car.speed) > 6) {
    car.boost = Math.min(car.boostMax, car.boost + dt * 26);
  }

  // Colisión con pared exterior de la casa (empuja hacia adentro)
  const outerVal = ellipseValue(nx, nz, TRACK_OUTER.rx * 0.97, TRACK_OUTER.rz * 0.97);
  if (outerVal > 1) {
    const ang = Math.atan2(nz, nx);
    nx = Math.cos(ang) * TRACK_OUTER.rx * 0.97;
    nz = Math.sin(ang) * TRACK_OUTER.rz * 0.97;
    car.speed *= 0.55;
  }

  car.x = nx;
  car.z = nz;

  kart.position.set(car.x, 0, car.z);
  kart.rotation.y = car.heading;
  const wheelSpin = car.speed * dt * 2.4;
  wheels.forEach(w => (w.rotation.x += wheelSpin));
  const steerLean = ((left ? 1 : 0) - (right ? 1 : 0)) * 0.08;
  kart.rotation.z = THREE.MathUtils.lerp(kart.rotation.z, -steerLean, 0.15);

  updateLapProgress();
}

// ============================================================
// VUELTAS
// ============================================================
const state = {
  running: false,
  finished: false,
  time: 0,
  lap: 0,
  totalLaps: 3,
  checkpoint: 0,
  lastQuadrant: 0,
};

function angleQuadrant(x, z) {
  const a = Math.atan2(z, x);
  const norm = (a + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(norm / (Math.PI / 2)) % 4;
}

function updateLapProgress() {
  const q = angleQuadrant(car.x, car.z);
  if (q !== state.lastQuadrant) {
    const expected = state.checkpoint % 4;
    if (q === expected) {
      state.checkpoint++;
      if (state.checkpoint % 4 === 0) {
        state.lap++;
        showLapToast();
        if (state.lap >= state.totalLaps) finishRace();
      }
    }
    state.lastQuadrant = q;
  }
}

// ============================================================
// CÁMARA — tercera persona, baja al piso, tipo kart
// ============================================================
const camTarget = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();

function updateCamera() {
  const f = forwardVec(car.heading);
  const camDist = 2.7;
  const camHeight = 2.5;
  desiredCamPos.set(
    car.x - f.x * camDist,
    camHeight,
    car.z - f.z * camDist
  );
  camera.position.lerp(desiredCamPos, 0.16);
  camTarget.set(car.x + f.x * 9, 0.4, car.z + f.z * 9);
  camera.lookAt(camTarget);
}

// ============================================================
// HUD
// ============================================================
const lapValue = document.getElementById('lapValue');
const boostFill = document.getElementById('boostFill');
const lapToast = document.getElementById('lapToast');
const speedoNeedle = document.getElementById('speedoNeedle');
const speedValue = document.getElementById('speedValue');
const minimapDot = document.getElementById('minimapDot');
const gadgetBadge = document.getElementById('gadgetBadge');

function updateHUD() {
  lapValue.textContent = `${Math.min(state.lap, state.totalLaps)}/${state.totalLaps}`;
  boostFill.style.width = `${car.boost}%`;

  // Velocímetro
  const kph = Math.round(Math.abs(car.speed) * 6.4);
  speedValue.textContent = kph;
  const maxKph = car.boostMaxSpeed * 6.4;
  const ratio = Math.min(1, kph / maxKph);
  const deg = -110 + ratio * 220;
  speedoNeedle.style.transform = `translateX(-50%) rotate(${deg}deg)`;

  // Gadget (boost) listo
  gadgetBadge.classList.toggle('ready', car.boost > 15);

  // Minimapa: posición del auto proyectada sobre la elipse de la pista
  const ang = Math.atan2(car.z, car.x);
  const mx = 50 + Math.cos(ang) * 38;
  const my = 50 + Math.sin(ang) * 38;
  minimapDot.style.left = `${mx}%`;
  minimapDot.style.top = `${my}%`;
}

let lapToastTimer = null;
function showLapToast() {
  lapToast.textContent = state.lap < state.totalLaps ? `¡Vuelta ${state.lap} completada!` : '¡Última vuelta superada!';
  lapToast.classList.remove('hidden');
  clearTimeout(lapToastTimer);
  lapToastTimer = setTimeout(() => lapToast.classList.add('hidden'), 1600);
}

// ============================================================
// FLUJO DE PARTIDA
// ============================================================
const startOverlay = document.getElementById('startOverlay');
const finishOverlay = document.getElementById('finishOverlay');
const finalTime = document.getElementById('finalTime');

function resetGame() {
  car.x = 0;
  car.z = -(TRACK_OUTER.rz + TRACK_INNER.rz) / 2;
  car.heading = Math.PI / 2;
  car.speed = 0;
  car.boost = car.boostMax;
  state.time = 0;
  state.lap = 0;
  state.checkpoint = 0;
  state.lastQuadrant = angleQuadrant(car.x, car.z);
  state.finished = false;
  toaster.active = false;
  toaster.timer = 0;
  kart.position.set(car.x, 0, car.z);
  kart.rotation.y = car.heading;
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

// ============================================================
// LOOP PRINCIPAL
// ============================================================
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (state.running && !state.finished) {
    updateCar(dt);
    updateToaster(dt);
    state.time += dt;
    updateHUD();
  }
  updateParticles(dt);
  updateCamera();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

resizeRenderer();
resetGame();
updateCamera();
requestAnimationFrame(loop);
