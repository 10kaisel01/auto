// ============================================================
// MICRO-MAYHEM DOMÉSTICO — Prototipo 3D (Three.js)
// Pista completa de una casa gigante: Cocina -> Pasillo -> Living
// -> Pasillo -> Baño -> Dormitorio -> vuelta a la Cocina.
// ============================================================

// ---------- Escala general de la casa ("casa gigantezca" + vueltas más largas) ----------
const SCALE = 4.5;
const PROP_SCALE = 2.1; // escala de muebles/props (más chica que SCALE: el kart se siente diminuto)

const WAYPOINTS = [
  { x: 0,   z: -50, w: 22, room: 0 }, // Cocina — pared del fondo
  { x: 26,  z: -50, w: 20, room: 0 }, // Cocina — esquina
  { x: 46,  z: -34, w: 10, room: 1 }, // Pasillo A — giro
  { x: 52,  z: -6,  w: 10, room: 1 }, // Pasillo A — recta
  { x: 46,  z: 22,  w: 24, room: 2 }, // Living — entrada
  { x: 18,  z: 40,  w: 26, room: 2 }, // Living — centro
  { x: -14, z: 46,  w: 12, room: 3 }, // Pasillo B — giro al baño
  { x: -40, z: 38,  w: 16, room: 4 }, // Baño — entrada
  { x: -54, z: 12,  w: 14, room: 4 }, // Baño — centro
  { x: -54, z: -18, w: 14, room: 5 }, // Dormitorio — pasillo
  { x: -36, z: -44, w: 18, room: 5 }, // Dormitorio — giro
  { x: -14, z: -52, w: 20, room: 0 }, // vuelta a la Cocina
].map(p => ({ x: p.x * SCALE, z: p.z * SCALE, w: p.w * SCALE, room: p.room }));
const ROOM_COLORS = [
  0xEDE7DD, // Cocina — mármol claro
  0xB98A55, // Pasillo A — madera
  0xC96B4A, // Living — alfombra terracota
  0xB98A55, // Pasillo B — madera
  0xD8E7EC, // Baño — cerámica celeste
  0xCBB68E, // Dormitorio — piso claro
];
const ROOM_NAMES = ['Cocina', 'Pasillo', 'Living', 'Pasillo', 'Baño', 'Dormitorio'];
const SAMPLES = 320;

const curvePoints = WAYPOINTS.map(p => new THREE.Vector3(p.x, 0, p.z));
const trackCurve = new THREE.CatmullRomCurve3(curvePoints, true, 'catmullrom', 0.5);

// ============================================================
// ESCENA, CÁMARA, RENDERER
// ============================================================
const container = document.getElementById('sceneContainer');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe0e8);
scene.fog = new THREE.Fog(0xE9DFC8, 140, 430);

const camera = new THREE.PerspectiveCamera(58, 960 / 560, 0.1, 900);

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

const sun = new THREE.DirectionalLight(0xffd9a0, 1.2);
sun.position.set(-220, 180, 110);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -320;
sun.shadow.camera.right = 320;
sun.shadow.camera.top = 320;
sun.shadow.camera.bottom = -320;
sun.shadow.camera.far = 700;
scene.add(sun);

const fill = new THREE.PointLight(0xffe3b8, 0.35, 100);
fill.position.set(30, 16, -10);
scene.add(fill);

// ============================================================
// PISO EXTERIOR — madera de la casa, con vetas procedurales
// ============================================================
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
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(100, 100);
  return tex;
}
const outerFloor = new THREE.Mesh(
  new THREE.CircleGeometry(320, 64),
  new THREE.MeshStandardMaterial({ map: buildWoodTexture(), roughness: 0.88 })
);
outerFloor.rotation.x = -Math.PI / 2;
outerFloor.position.y = -0.02;
outerFloor.receiveShadow = true;
scene.add(outerFloor);

// (los muros de la pista y la ventana se generan más abajo, con los trackSamples)

// ============================================================
// PISTA — cinta que sigue la curva de la casa, con ancho y color
// variables según el ambiente (cocina/pasillo/living/baño/dormitorio)
// ============================================================
const trackSamples = []; // {x,z,nx,nz,halfWidth}

function buildTrackRibbon() {
  const positions = [];
  const colors = [];
  const indices = [];
  const roomCols = ROOM_COLORS.map(c => new THREE.Color(c));
  const N = WAYPOINTS.length;

  for (let j = 0; j <= SAMPLES; j++) {
    const t = (j % SAMPLES) / SAMPLES;
    const pos = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t).normalize();
    const nx = -tan.z, nz = tan.x;

    const idx = t * N;
    const i0 = Math.floor(idx) % N;
    const i1 = (i0 + 1) % N;
    const frac = idx - Math.floor(idx);
    const halfWidth = THREE.MathUtils.lerp(WAYPOINTS[i0].w, WAYPOINTS[i1].w, frac) / 2;
    const col = roomCols[WAYPOINTS[i0].room].clone().lerp(roomCols[WAYPOINTS[i1].room], frac);

    if (j < SAMPLES) trackSamples.push({ x: pos.x, z: pos.z, nx, nz, halfWidth });

    positions.push(pos.x + nx * halfWidth, 0, pos.z + nz * halfWidth);
    positions.push(pos.x - nx * halfWidth, 0, pos.z - nz * halfWidth);
    colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
  }

  for (let i = 0; i < SAMPLES; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.01;
  mesh.receiveShadow = true;
  return mesh;
}
scene.add(buildTrackRibbon());

// ---------- Muros de la casa: siguen los bordes reales de la pista ----------
// El margen es proporcional al ancho del ambiente: pasillos angostos quedan
// ajustados (sensación de corredor) y las salas anchas quedan más abiertas.
const WALL_MARGIN_MIN = 3 * PROP_SCALE;
const WALL_HEIGHT = 15;

function buildWallRibbon(sign) {
  const N = trackSamples.length;
  const positions = [];
  const normals = [];
  const indices = [];
  for (let i = 0; i <= N; i++) {
    const s = trackSamples[i % N];
    const m = Math.max(WALL_MARGIN_MIN, s.halfWidth * 0.4);
    const px = s.x + s.nx * (s.halfWidth + m) * sign;
    const pz = s.z + s.nz * (s.halfWidth + m) * sign;
    positions.push(px, 0, pz, px, WALL_HEIGHT, pz);
    // normal de la pared apunta hacia el pasillo (adentro)
    normals.push(-s.nx * sign, 0, -s.nz * sign, -s.nx * sign, 0, -s.nz * sign);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  const mat = new THREE.MeshStandardMaterial({ color: 0xF4F1EA, roughness: 0.92, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
function buildTrackWalls() {
  scene.add(buildWallRibbon(1));
  scene.add(buildWallRibbon(-1));

  // Zócalo (base oscura) para dar detalle arquitectónico a la pared
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xB98A55, roughness: 0.8 });
  [1, -1].forEach(sign => {
    const N = trackSamples.length;
    const positions = [];
    const indices = [];
    for (let i = 0; i <= N; i++) {
      const s = trackSamples[i % N];
      const m = Math.max(WALL_MARGIN_MIN, s.halfWidth * 0.4);
      const px = s.x + s.nx * (s.halfWidth + m) * sign;
      const pz = s.z + s.nz * (s.halfWidth + m) * sign;
      positions.push(px, 0, pz, px, 1.1, pz);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, baseMat);
    mesh.material.side = THREE.DoubleSide;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}
buildTrackWalls();

// Ventana con luz cálida (hora dorada), ubicada sobre el muro real del baño
(function placeWindow() {
  const s = trackSamples[Math.round((8 / WAYPOINTS.length) * SAMPLES) % trackSamples.length];
  const margin = Math.max(WALL_MARGIN_MIN, s.halfWidth * 0.4) + 0.3;
  const wx = s.x - s.nx * (s.halfWidth + margin);
  const wz = s.z - s.nz * (s.halfWidth + margin);
  const windowGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(6 * PROP_SCALE * 0.5, 4 * PROP_SCALE * 0.5),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  windowGlow.position.set(wx, WALL_HEIGHT * 0.4, wz);
  windowGlow.rotation.y = Math.atan2(-s.nx, -s.nz);
  scene.add(windowGlow);
})();

// Línea de meta sobre el primer segmento
(function drawFinishLine() {
  const p0 = trackSamples[0];
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(p0.halfWidth * 2, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x1F2A44 })
  );
  line.rotation.x = -Math.PI / 2;
  line.position.set(p0.x, 0.02, p0.z);
  const ang = Math.atan2(p0.nz, p0.nx);
  line.rotation.z = -ang;
  scene.add(line);
})();

// Marcos de puerta entre ambientes (refuerzan la sensación de habitaciones separadas)
(function addDoorFrames() {
  const N = WAYPOINTS.length;
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xB98A55, roughness: 0.7 });
  for (let i = 0; i < N; i++) {
    const nextIdx = (i + 1) % N;
    if (WAYPOINTS[i].room === WAYPOINTS[nextIdx].room) continue;
    const sIdx = Math.round((nextIdx / N) * SAMPLES) % trackSamples.length;
    const s = trackSamples[sIdx];
    [1, -1].forEach(side => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5 * PROP_SCALE, 6.5 * PROP_SCALE, 0.5 * PROP_SCALE), doorMat);
      post.position.set(
        s.x + s.nx * (s.halfWidth + 0.6 * PROP_SCALE) * side,
        3.25 * PROP_SCALE,
        s.z + s.nz * (s.halfWidth + 0.6 * PROP_SCALE) * side
      );
      post.castShadow = true;
      scene.add(post);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(s.halfWidth * 2 + 1.6 * PROP_SCALE, 0.5 * PROP_SCALE, 0.5 * PROP_SCALE), doorMat);
    lintel.position.set(s.x, 6.2 * PROP_SCALE, s.z);
    lintel.rotation.y = Math.atan2(s.nx, s.nz) + Math.PI / 2;
    lintel.castShadow = true;
    scene.add(lintel);
  }
})();

// ============================================================
// MOBILIARIO POR AMBIENTE (da identidad a cada sala)
// ============================================================
function addProp(geo, mat, x, y, z, ry) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

// Ubica un mueble a un costado de la pista (fuera del camino) según su
// posición sobre la curva (t 0..1), el lado (+1/-1) y cuánto se lo aleja
// del borde del camino además de su propio ancho medio.
function trackSide(t, side, clearance) {
  const p = trackCurve.getPointAt(t);
  const tan = trackCurve.getTangentAt(t).normalize();
  const nx = -tan.z, nz = tan.x;
  const idx = Math.round(t * trackSamples.length) % trackSamples.length;
  const halfWidth = trackSamples[idx].halfWidth;
  const dist = halfWidth + clearance;
  return {
    x: p.x + nx * dist * side,
    z: p.z + nz * dist * side,
    ry: Math.atan2(tan.x, tan.z),
  };
}

// --- Isla de cocina / mesa (obstáculo sólido, punto de despegue de la rampa) ---
const islandPos = trackSide(0.05, 1, 3.2 * PROP_SCALE);
const island = addProp(
  new THREE.BoxGeometry(9 * PROP_SCALE, 1.1 * PROP_SCALE, 5 * PROP_SCALE),
  new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.7 }),
  islandPos.x, 0.55 * PROP_SCALE, islandPos.z, islandPos.ry
);

// --- Heladera (punto de aterrizaje del salto épico) ---
const fridgePos = trackSide(0.10, 1, 4 * PROP_SCALE);
addProp(
  new THREE.BoxGeometry(3.2 * PROP_SCALE, 6.4 * PROP_SCALE, 3 * PROP_SCALE),
  new THREE.MeshStandardMaterial({ color: 0xE7E2D6, roughness: 0.35, metalness: 0.15 }),
  fridgePos.x, 3.2 * PROP_SCALE, fridgePos.z, fridgePos.ry
);

// --- Obstáculos con los que te podés chocar (reducen velocidad al impactar) ---
const OBSTACLES = [
  { x: islandPos.x, z: islandPos.z, rx: 5.2 * PROP_SCALE, rz: 3.0 * PROP_SCALE, jumpable: true },
];

function addCrashObstacle(t, side, clearanceFrac, rx, rz, geo, mat) {
  const p = trackCurve.getPointAt(t);
  const tan = trackCurve.getTangentAt(t).normalize();
  const nx = -tan.z, nz = tan.x;
  const idx = Math.round(t * trackSamples.length) % trackSamples.length;
  const halfWidth = trackSamples[idx].halfWidth;
  // clearanceFrac 0 = centro del camino, 1 = pegado al borde: así el obstáculo
  // realmente invade parte del camino y hay que esquivarlo.
  const dist = halfWidth * clearanceFrac * side;
  const pos = { x: p.x + nx * dist, z: p.z + nz * dist, ry: Math.atan2(tan.x, tan.z) };
  addProp(geo, mat, pos.x, rx > rz ? rz : rz, pos.z, pos.ry);
  OBSTACLES.push({ x: pos.x, z: pos.z, rx, rz });
  return pos;
}

// Canasto de ropa en el Pasillo B (parcialmente en el camino)
addCrashObstacle(
  0.55, 1, 0.35, 2.4 * PROP_SCALE, 2.4 * PROP_SCALE,
  new THREE.CylinderGeometry(2.4 * PROP_SCALE, 2.0 * PROP_SCALE, 2.6 * PROP_SCALE, 16),
  new THREE.MeshStandardMaterial({ color: 0xEADFC8, roughness: 0.95 })
);

// Torre de bloques en el Living (parcialmente en el camino)
addCrashObstacle(
  0.43, -1, 0.3, 2.6 * PROP_SCALE, 2.6 * PROP_SCALE,
  new THREE.BoxGeometry(2.6 * PROP_SCALE, 3.4 * PROP_SCALE, 2.6 * PROP_SCALE),
  new THREE.MeshStandardMaterial({ color: 0x2980B9, roughness: 0.5 })
);

// --- Rampa de salto épico: de la mesa a la heladera (atajo) ---
const RAMP_T = 0.02;
const rampPos = trackSide(RAMP_T, 1, 1 * PROP_SCALE);
const ramp = addProp(
  new THREE.BoxGeometry(3.4 * PROP_SCALE, 0.5 * PROP_SCALE, 5 * PROP_SCALE),
  new THREE.MeshStandardMaterial({ color: 0xC9A24B, roughness: 0.6 }),
  rampPos.x, 1.3 * PROP_SCALE, rampPos.z, rampPos.ry
);
ramp.rotation.x = -0.42;
const RAMP = { x: rampPos.x, z: rampPos.z, radius: 3.5 * PROP_SCALE, tRange: [0.008, 0.032] };

// --- Living: sillón + mesa ratona ---
const couchPos = trackSide(0.40, -1, 2.5 * PROP_SCALE);
addProp(
  new THREE.BoxGeometry(6 * PROP_SCALE, 1.6 * PROP_SCALE, 3 * PROP_SCALE),
  new THREE.MeshStandardMaterial({ color: 0xC96B4A, roughness: 0.85 }),
  couchPos.x, 0.8 * PROP_SCALE, couchPos.z, couchPos.ry
);
const tablePos = trackSide(0.47, 1, 3 * PROP_SCALE);
addProp(
  new THREE.CylinderGeometry(1.4 * PROP_SCALE, 1.4 * PROP_SCALE, 0.4 * PROP_SCALE, 24),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 }),
  tablePos.x, 0.22 * PROP_SCALE, tablePos.z
);

// --- Baño: bañera ---
const tubPos = trackSide(0.61, 1, 2.8 * PROP_SCALE);
addProp(
  new THREE.BoxGeometry(6 * PROP_SCALE, 1.6 * PROP_SCALE, 3.2 * PROP_SCALE),
  new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.3, metalness: 0.05 }),
  tubPos.x, 0.8 * PROP_SCALE, tubPos.z, tubPos.ry
);

// --- Dormitorio: cama ---
const bedPos = trackSide(0.83, -1, 4.5 * PROP_SCALE);
addProp(
  new THREE.BoxGeometry(6 * PROP_SCALE, 1.4 * PROP_SCALE, 8 * PROP_SCALE),
  new THREE.MeshStandardMaterial({ color: 0x8B5E34, roughness: 0.8 }),
  bedPos.x, 0.7 * PROP_SCALE, bedPos.z, bedPos.ry
);
addProp(
  new THREE.BoxGeometry(5.4 * PROP_SCALE, 0.8 * PROP_SCALE, 7 * PROP_SCALE),
  new THREE.MeshStandardMaterial({ color: 0xF4F1EA, roughness: 0.9 }),
  bedPos.x, 1.5 * PROP_SCALE, bedPos.z, bedPos.ry
);

// --- Bloques tipo Lego dispersos en el pasillo/entrada ---
(function addLegoScatter() {
  const legoColors = [0xC0392B, 0xF1C40F, 0x2980B9, 0x27AE60, 0xE67E22];
  for (let i = 0; i < 40; i++) {
    const t = Math.random();
    const p = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const nx = -tan.z, nz = tan.x;
    const idx = Math.round(t * trackSamples.length) % trackSamples.length;
    const halfWidth = trackSamples[idx].halfWidth;
    const side = (Math.random() < 0.5 ? -1 : 1) * (halfWidth + PROP_SCALE * (1.5 + Math.random() * 2.5));
    const size = (0.4 + Math.random() * 0.35) * PROP_SCALE;
    addProp(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color: legoColors[i % legoColors.length], roughness: 0.4 }),
      p.x + nx * side, size / 2, p.z + nz * side, Math.random() * Math.PI
    );
  }
})();

// ============================================================
// TOSTADORA — evento dinámico (calor + dispara pan)
// ============================================================
const toaster = { active: false, timer: 0, x: OBSTACLES[0].x, z: OBSTACLES[0].z, radius: 6.5 * PROP_SCALE };
const toasterGroup = new THREE.Group();
const toasterBody = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 1.1, 1.1),
  new THREE.MeshStandardMaterial({ color: 0xC7C7C7, metalness: 0.6, roughness: 0.35 })
);
toasterBody.castShadow = true;
toasterGroup.add(toasterBody);
const toasterGlowMat = new THREE.MeshBasicMaterial({ color: 0xE4572E, transparent: true, opacity: 0 });
toasterGroup.add(new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 16), toasterGlowMat));
const toasterLight = new THREE.PointLight(0xE4572E, 0, 10);
toasterGroup.add(toasterLight);
toasterGroup.position.set(toaster.x, (1.1 + 0.55) * PROP_SCALE, toaster.z);
toasterGroup.scale.setScalar(PROP_SCALE);
scene.add(toasterGroup);

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
    if (t.life <= 0) { scene.remove(t.mesh); toastSlices.splice(i, 1); }
  }
}

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
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.material.dispose(); sparkPool.splice(i, 1); }
  }
}

function updateToaster(dt) {
  toaster.timer += dt;
  if (!toaster.active && toaster.timer > 6) {
    toaster.active = true; toaster.timer = 0; spawnToast();
  } else if (toaster.active && toaster.timer > 3) {
    toaster.active = false; toaster.timer = 0;
  }
  updateToastSlices(dt);
  const targetOpacity = toaster.active ? 0.55 : 0;
  toasterGlowMat.opacity += (targetOpacity - toasterGlowMat.opacity) * 0.1;
  toasterLight.intensity += ((toaster.active ? 2.2 : 0) - toasterLight.intensity) * 0.1;
  if (toaster.active && Math.random() < 0.5) {
    spawnParticle(
      toaster.x + (Math.random() - 0.5) * 0.8, toasterGroup.position.y + 0.6, toaster.z + (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 1.5, 2 + Math.random(), (Math.random() - 0.5) * 1.5, 0xC9A24B, 0.9
    );
  }
}

// ============================================================
// KART DEL JUGADOR — estilo monster truck de juguete
// ============================================================
const kart = new THREE.Group();

const chassis = new THREE.Mesh(
  new THREE.BoxGeometry(1.3, 0.5, 2.1),
  new THREE.MeshStandardMaterial({ color: 0xE8B23B, roughness: 0.45, metalness: 0.1 })
);
chassis.position.y = 0.62;
chassis.castShadow = true;
kart.add(chassis);

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

const rollBar = new THREE.Mesh(
  new THREE.TorusGeometry(0.55, 0.05, 8, 16, Math.PI),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.5, roughness: 0.4 })
);
rollBar.rotation.z = Math.PI;
rollBar.rotation.x = Math.PI / 2;
rollBar.position.set(0, 1.15, -0.6);
kart.add(rollBar);

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
// FÍSICA ARCADE (estilo Mario Kart) sobre la cinta de la pista
// ============================================================
const startTangent = trackCurve.getTangentAt(0).normalize();
const startHeading = Math.atan2(startTangent.x, startTangent.z);

const car = {
  x: trackSamples[0].x, z: trackSamples[0].z,
  heading: startHeading,
  speed: 0,
  maxSpeed: 10,
  boostMaxSpeed: 15,
  accel: 0.24,
  turnRate: 2.0,
  friction: 0.985,
  boost: 100,
  boostMax: 100,
  isBoosting: false,
  y: 0,
  vy: 0,
  jumping: false,
};

function forwardVec(heading) { return { x: Math.sin(heading), z: Math.cos(heading) }; }

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---------- Búsqueda del punto de pista más cercano (ventana local) ----------
let nearestIdx = 0;
function findNearestSample(x, z) {
  const N = trackSamples.length;
  let best = -1, bestD = Infinity;
  const WINDOW = 24;
  for (let k = -WINDOW; k <= WINDOW; k++) {
    const i = ((nearestIdx + k) % N + N) % N;
    const s = trackSamples[i];
    const dx = x - s.x, dz = z - s.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  nearestIdx = best;
  return best;
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
  const tdx = car.x - toaster.x, tdz = car.z - toaster.z;
  if (toaster.active && Math.sqrt(tdx * tdx + tdz * tdz) < toaster.radius) heatFactor = 0.55;

  const f = forwardVec(car.heading);
  let nx = car.x + f.x * car.speed * dt * heatFactor;
  let nz = car.z + f.z * car.speed * dt * heatFactor;

  // --- Rampa de salto épico (atajo mesa -> heladera) ---
  const progressT = nearestIdx / trackSamples.length;
  const inRampZone = progressT >= RAMP.tRange[0] && progressT <= RAMP.tRange[1];
  if (!car.jumping && inRampZone && car.speed > car.maxSpeed * 0.55) {
    car.jumping = true;
    car.vy = 15.5;
  }
  if (car.jumping) {
    car.vy -= 27 * dt;
    car.y += car.vy * dt;
    if (car.y <= 0) { car.y = 0; car.vy = 0; car.jumping = false; }
  }

  // Colisión con obstáculos (mesa, canasto, torre de bloques) — se puede
  // saltar por arriba con la rampa mientras se está en el aire.
  if (!car.jumping) {
    for (const obs of OBSTACLES) {
      const odx = nx - obs.x, odz = nz - obs.z;
      const oVal = (odx / obs.rx) * (odx / obs.rx) + (odz / obs.rz) * (odz / obs.rz);
      if (oVal < 1) {
        const ang = Math.atan2(odz, odx);
        nx = obs.x + Math.cos(ang) * obs.rx * 1.03;
        nz = obs.z + Math.sin(ang) * obs.rz * 1.03;
        car.speed *= 0.5;
        break;
      } else if (oVal < 1.2 && Math.abs(car.speed) > 6) {
        car.boost = Math.min(car.boostMax, car.boost + dt * 26); // near-miss
      }
    }
  }

  // Colisión con los bordes de la pista (no aplica mientras se está saltando)
  const si = findNearestSample(nx, nz);
  const s = trackSamples[si];
  if (!car.jumping) {
    const lateral = (nx - s.x) * s.nx + (nz - s.z) * s.nz;
    const limit = s.halfWidth * 0.97;
    if (lateral > limit) {
      const push = lateral - limit;
      nx -= push * s.nx; nz -= push * s.nz;
      car.speed *= 0.6;
    } else if (lateral < -limit) {
      const push = lateral + limit;
      nx -= push * s.nx; nz -= push * s.nz;
      car.speed *= 0.6;
    } else if (Math.abs(lateral) > s.halfWidth * 0.85 && Math.abs(car.speed) > 6) {
      car.boost = Math.min(car.boostMax, car.boost + dt * 22); // roce cercano al borde
    }
  }

  car.x = nx; car.z = nz;

  kart.position.set(car.x, car.y, car.z);
  kart.rotation.y = car.heading;
  const wheelSpin = car.speed * dt * 2.4;
  wheels.forEach(w => (w.rotation.x += wheelSpin));
  const steerLean = ((left ? 1 : 0) - (right ? 1 : 0)) * 0.08;
  kart.rotation.z = THREE.MathUtils.lerp(kart.rotation.z, -steerLean, 0.15);

  updateLapProgress(si);
}

// ============================================================
// VUELTAS — progreso a lo largo de la curva de la pista
// ============================================================
const state = {
  running: false, finished: false, time: 0,
  lap: 0, totalLaps: 3, prevProgress: 0,
};

function updateLapProgress(sampleIndex) {
  const progress = sampleIndex / trackSamples.length;
  if (state.prevProgress > 0.85 && progress < 0.15) {
    state.lap++;
    showLapToast();
    if (state.lap >= state.totalLaps) finishRace();
  }
  state.prevProgress = progress;
}

// ============================================================
// CÁMARA — tercera persona, baja al piso, tipo hood-cam
// ============================================================
const camTarget = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();

function updateCamera() {
  const f = forwardVec(car.heading);
  const camDist = 5.2, camHeight = 2.3;
  desiredCamPos.set(car.x - f.x * camDist, camHeight + car.y * 0.7, car.z - f.z * camDist);
  camera.position.lerp(desiredCamPos, 0.16);
  camTarget.set(car.x + f.x * 8, 0.9 + car.y * 0.7, car.z + f.z * 8);
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
const roomLabel = document.getElementById('roomLabel');

function updateHUD(sampleIndex) {
  lapValue.textContent = `${Math.min(state.lap, state.totalLaps)}/${state.totalLaps}`;
  boostFill.style.width = `${car.boost}%`;

  const kph = Math.round(Math.abs(car.speed) * 6.4);
  speedValue.textContent = kph;
  const maxKph = car.boostMaxSpeed * 6.4;
  const ratio = Math.min(1, kph / maxKph);
  speedoNeedle.style.transform = `translateX(-50%) rotate(${-110 + ratio * 220}deg)`;

  gadgetBadge.classList.toggle('ready', car.boost > 15);

  const t = sampleIndex / trackSamples.length;
  const mx = 8 + t * 84;
  minimapDot.style.left = `${mx}%`;
  minimapDot.style.top = `50%`;

  const idx = Math.floor(t * WAYPOINTS.length) % WAYPOINTS.length;
  roomLabel.textContent = ROOM_NAMES[WAYPOINTS[idx].room];
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
  car.x = trackSamples[0].x;
  car.z = trackSamples[0].z;
  car.heading = startHeading;
  car.speed = 0;
  car.boost = car.boostMax;
  car.y = 0;
  car.vy = 0;
  car.jumping = false;
  state.time = 0;
  state.lap = 0;
  state.prevProgress = 0;
  state.finished = false;
  nearestIdx = 0;
  toaster.active = false;
  toaster.timer = 0;
  kart.position.set(car.x, 0, car.z);
  kart.rotation.y = car.heading;

  // Posicionar la cámara instantáneamente (sin lerp) para evitar un barrido
  // lento al arrancar o reiniciar, ahora que la casa es mucho más grande.
  const f0 = forwardVec(car.heading);
  camera.position.set(car.x - f0.x * 5.2, 2.3, car.z - f0.z * 5.2);
  camera.lookAt(car.x + f0.x * 8, 0.9, car.z + f0.z * 8);
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
    updateHUD(nearestIdx);
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
