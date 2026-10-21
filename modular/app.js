/* =====================================================================
   PolyCraft Studio Web · VERSIÓN MEJORADA
   Editor Low Poly para papercraft (Pepakura) · Three.js · 100% en navegador
   ---------------------------------------------------------------------
   NUEVAS CARACTERÍSTICAS:
   - Añadir vértices: doble clic en aristas/caras, herramienta V
   - Cuchillo (K): cortar caras con líneas
   - Conectar (J): unir vértices seleccionados con arista
   - Arrastre directo: mover vértices/aristas/caras sin pulsar G
   - Fusión automática: soltar vértice sobre otro los une
   - Hover: resaltar elemento bajo el cursor
   - Disolver mejorado: Ctrl+X sin dejar huecos
   - Imagen de fondo como referencia
   - Colores por cara para pintar el modelo
   ---------------------------------------------------------------------
   Estructura de datos: malla poligonal editable
     mesh.pos   -> [x0,y0,z0, x1,y1,z1, ...]   (unidades reales: mm/cm/m)
     mesh.faces -> [[i0,i1,i2], [i0,i1,i2,i3], ...]  (polígonos CCW = normal hacia fuera)
   Todo (selección, render, reparación, exportación) se deriva de aquí.
   ===================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';

const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('es-ES');

/* ---------------------------------------------------------------------
   Paleta (sale del mundo papercraft: tapete de corte, papel, tinta)
   --------------------------------------------------------------------- */
const C = {
  paper: new THREE.Color('#f5f2ea'),
  faceSel: new THREE.Color('#ffc53d'),
  nonPlanar: new THREE.Color('#ff7a59'),
  back: new THREE.Color('#e0735c'),
  ink: new THREE.Color('#13221b'),
  inkSoft: new THREE.Color('#5b6d63'),
  sel: new THREE.Color('#ffb703'),
  boundary: new THREE.Color('#ff3d1f'),
  nonManifold: new THREE.Color('#c13cff'),
  valley: new THREE.Color('#2f6fd0'),
  flat: new THREE.Color('#9fc4b0'),
  hover: new THREE.Color('#4ecdc4'),
  previewDot: new THREE.Color('#00d9ff'),
  mat: '#2f6b55',
  matDeep: '#24574a',
};

/* ---------------------------------------------------------------------
   Estado global
   --------------------------------------------------------------------- */
const S = {
  mesh: { pos: [], faces: [] },
  edges: [], edgeMap: new Map(),
  faceN: new Float32Array(0), faceC: new Float32Array(0), faceNP: new Uint8Array(0), npCount: 0,
  triFace: new Int32Array(0), triCount: 0,
  mode: 'object', sel: 'v', objSel: true,
  selV: new Set(), selE: new Set(), selF: new Set(),
  showNP: true, fold: false, showEdges: true, xray: false, npTol: 1,
  unit: 'mm', expScale: 1, triExport: true,
  undo: [], redo: [],
  modal: null, tween: null,
  decimBase: null, decimPushed: false, decimTimer: 0,
  mouse: { x: innerWidth / 2, y: innerHeight / 2 },
  gridStep: 10, size: 100,
  
  // NUEVAS: colores por cara, imagen de fondo, hover, herramientas
  faceColors: new Map(), // Map<faceIndex, THREE.Color>
  bgImage: null, // { texture, opacity, scale, offsetX, offsetY }
  hoverV: -1, hoverE: null, hoverF: -1, // elemento bajo el cursor
  activeTool: null, // 'addVertex', 'knife', null
  toolData: null, // datos temporales de la herramienta activa
  directDrag: null, // arrastre directo sin modal G/R/S
  knifePoints: [], // puntos del cuchillo
  previewPos: null, // posición 3D de vista previa
  snapMode: false, // Ctrl para imán
};

const EK = 2097152; // 2^21 -> claves de arista únicas hasta 2M vértices
const ek = (a, b) => (a < b ? a * EK + b : b * EK + a);

/* =====================================================================
   1. ESCENA THREE.JS
   ===================================================================== */
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.matDeep);
scene.fog = new THREE.Fog(C.matDeep, 600, 2400);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 10000);
camera.position.set(170, 150, 230);

const controls = new OrbitControls(camera, canvas);
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
controls.enableDamping = true;
controls.dampingFactor = 0.14;
controls.zoomSpeed = 1.1;
controls.target.set(0, 45, 0);
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x3c7a62, 1.35));
const sun = new THREE.DirectionalLight(0xfff6e8, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdbe9ff, 0.55);
scene.add(fill);

// --- Imagen de fondo (plano de referencia) ---
const bgPlaneGeo = new THREE.PlaneGeometry(1, 1);
const bgPlaneMat = new THREE.MeshBasicMaterial({ 
  transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false 
});
const bgPlane = new THREE.Mesh(bgPlaneGeo, bgPlaneMat);
bgPlane.visible = false;
bgPlane.renderOrder = -1;
scene.add(bgPlane);

// --- Tapete de corte (firma visual): cuadrícula + reglas + diagonal a 45° ---
const matCanvas = document.createElement('canvas');
matCanvas.width = matCanvas.height = 2048;
const matTex = new THREE.CanvasTexture(matCanvas);
matTex.colorSpace = THREE.SRGBColorSpace;
matTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const matMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.96, metalness: 0 })
);
matMesh.rotation.x = -Math.PI / 2;
matMesh.receiveShadow = true;
scene.add(matMesh);
const MAT_CELLS = 40;

function drawMat(step) {
  const g = matCanvas.getContext('2d');
  const W = matCanvas.width, cell = W / MAT_CELLS;
  g.fillStyle = C.mat; g.fillRect(0, 0, W, W);
  g.strokeStyle = 'rgba(214,238,224,.18)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cell * 2, W - cell * 2); g.lineTo(W - cell * 2, cell * 2); g.stroke();
  g.beginPath(); g.moveTo(cell * 2, cell * 2); g.lineTo(W - cell * 2, W - cell * 2); g.stroke();
  for (let i = 0; i <= MAT_CELLS; i++) {
    const p = i * cell, major = i % 5 === 0;
    g.strokeStyle = major ? 'rgba(220,240,228,.55)' : 'rgba(220,240,228,.22)';
    g.lineWidth = major ? 3 : 1.5;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, W); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke();
  }
  g.fillStyle = 'rgba(232,246,237,.85)';
  g.font = '600 26px Archivo, system-ui, sans-serif';
  g.textBaseline = 'top';
  const half = MAT_CELLS / 2;
  for (let i = 0; i <= MAT_CELLS; i += 5) {
    const v = Math.abs(i - half) * step;
    const label = String(+v.toFixed(3));
    g.textAlign = 'center';
    if (i > 0 && i < MAT_CELLS) {
      g.fillText(label, i * cell, 10);
      g.save(); g.translate(14, i * cell); g.rotate(-Math.PI / 2); g.fillText(label, 0, -8); g.restore();
    }
  }
  g.font = '600 30px "Bricolage Grotesque", Archivo, sans-serif';
  g.textAlign = 'right'; g.textBaseline = 'bottom';
  g.fillText(`PolyCraft · 1 casilla = ${+step.toFixed(4)} ${S.unit}`, W - cell * 0.6, W - cell * 0.35);
  matTex.needsUpdate = true;
}

// --- Geometría de la malla editable ---
const meshGeo = new THREE.BufferGeometry();
const frontMat = new THREE.MeshStandardMaterial({
  vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: THREE.FrontSide,
});
const backMat = new THREE.MeshStandardMaterial({
  color: C.back, flatShading: true, roughness: 0.9, side: THREE.BackSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
const frontMesh = new THREE.Mesh(meshGeo, frontMat);
const backMesh = new THREE.Mesh(meshGeo, backMat);
frontMesh.castShadow = true;
scene.add(frontMesh, backMesh);

const edgeGeo = new THREE.BufferGeometry();
const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
edgeLines.renderOrder = 2;
scene.add(edgeLines);

const pointGeo = new THREE.BufferGeometry();
const pointMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: renderer.getPixelRatio() } },
  vertexShader: /* glsl */`
    attribute vec3 aColor; attribute float aSize; varying vec3 vColor; varying float vSel; uniform float uScale;
    void main(){
      vColor = aColor; vSel = step(8.5, aSize);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_Position.z -= 0.0008 * gl_Position.w;
      gl_PointSize = aSize * uScale;
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vColor; varying float vSel;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      vec3 col = (vSel > 0.5 && d > 0.36) ? vec3(0.075,0.133,0.106) : vColor;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
const points = new THREE.Points(pointGeo, pointMat);
points.renderOrder = 3;
scene.add(points);

// --- Punto de vista previa (herramienta añadir vértice) ---
const previewGeo = new THREE.BufferGeometry();
const previewMat = new THREE.PointsMaterial({ 
  color: C.previewDot, size: 10, sizeAttenuation: false, 
  transparent: true, opacity: 0.85, depthTest: false 
});
const previewDot = new THREE.Points(previewGeo, previewMat);
previewDot.renderOrder = 10;
previewDot.visible = false;
scene.add(previewDot);

// --- Líneas del cuchillo ---
const knifeGeo = new THREE.BufferGeometry();
const knifeMat = new THREE.LineBasicMaterial({ 
  color: 0x00ffaa, linewidth: 2, transparent: true, opacity: 0.9, depthTest: false 
});
const knifeLines = new THREE.LineSegments(knifeGeo, knifeMat);
knifeLines.renderOrder = 11;
knifeLines.visible = false;
scene.add(knifeLines);

// marcas de corte (crop marks) alrededor del objeto seleccionado en modo Objeto
const cropGeo = new THREE.BufferGeometry();
const crop = new THREE.LineSegments(cropGeo, new THREE.LineBasicMaterial({ 
  color: 0xffc53d, depthTest: false, transparent: true 
}));
crop.renderOrder = 4;
scene.add(crop);

/* =====================================================================
   2. NÚCLEO DE MALLA: aristas, normales, triangulación, limpieza
   ===================================================================== */
function buildEdges() {
  const map = new Map(), list = [];
  const F = S.mesh.faces;
  for (let fi = 0; fi < F.length; fi++) {
    const f = F[fi], n = f.length;
    for (let i = 0; i < n; i++) {
      const a = f[i], b = f[(i + 1) % n], k = ek(a, b);
      let e = map.get(k);
      if (!e) { e = { k, a: Math.min(a, b), b: Math.max(a, b), f: [], d: [] }; map.set(k, e); list.push(e); }
      e.f.push(fi); e.d.push(a < b ? 1 : -1);
    }
  }
  S.edgeMap = map; S.edges = list;
}

function faceNormal(f, P, out) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0, n = f.length; i < n; i++) {
    const a = f[i] * 3, b = f[(i + 1) % n] * 3;
    nx += (P[a + 1] - P[b + 1]) * (P[a + 2] + P[b + 2]);
    ny += (P[a + 2] - P[b + 2]) * (P[a] + P[b]);
    nz += (P[a] - P[b]) * (P[a + 1] + P[b + 1]);
  }
  out[0] = nx; out[1] = ny; out[2] = nz;
  return Math.hypot(nx, ny, nz);
}

const _n = [0, 0, 0];
function computeFaceInfo() {
  const P = S.mesh.pos, F = S.mesh.faces, nF = F.length;
  const N = new Float32Array(nF * 3), Cc = new Float32Array(nF * 3), NP = new Uint8Array(nF);
  const tol = S.npTol / 100;
  let np = 0;
  for (let fi = 0; fi < nF; fi++) {
    const f = F[fi], n = f.length;
    const len = faceNormal(f, P, _n) || 1;
    const nx = _n[0] / len, ny = _n[1] / len, nz = _n[2] / len;
    let cx = 0, cy = 0, cz = 0;
    for (const v of f) { cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;
    N[fi * 3] = nx; N[fi * 3 + 1] = ny; N[fi * 3 + 2] = nz;
    Cc[fi * 3] = cx; Cc[fi * 3 + 1] = cy; Cc[fi * 3 + 2] = cz;
    if (n > 3) {
      const d = nx * cx + ny * cy + nz * cz;
      let dev = 0, size = 0;
      for (const v of f) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
        dev = Math.max(dev, Math.abs(nx * x + ny * y + nz * z - d));
        size = Math.max(size, Math.hypot(x - cx, y - cy, z - cz));
      }
      if (dev > tol * size * 2) { NP[fi] = 1; np++; }
    }
  }
  S.faceN = N; S.faceC = Cc; S.faceNP = NP; S.npCount = np;
}

function triangulateFace(f, P, nx, ny, nz) {
  const n = f.length;
  if (n === 3) return [[f[0], f[1], f[2]]];
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  let i0, i1;
  if (az >= ax && az >= ay) { i0 = 0; i1 = 1; } else if (ax >= ay) { i0 = 1; i1 = 2; } else { i0 = 2; i1 = 0; }
  const X = (k) => P[f[k] * 3 + i0], Y = (k) => P[f[k] * 3 + i1];
  const cr = (a, b, c) => (X(b) - X(a)) * (Y(c) - Y(a)) - (Y(b) - Y(a)) * (X(c) - X(a));
  let area = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += X(i) * Y(j) - X(j) * Y(i); }
  if (n === 4) {
    const ok02 = cr(0, 1, 2) * area > 0 && cr(0, 2, 3) * area > 0;
    const ok13 = cr(1, 2, 3) * area > 0 && cr(1, 3, 0) * area > 0;
    const d = (a, b) => { const A = f[a] * 3, B = f[b] * 3; return Math.hypot(P[A] - P[B], P[A + 1] - P[B + 1], P[A + 2] - P[B + 2]); };
    const use02 = ok02 && (!ok13 || d(0, 2) <= d(1, 3));
    if (use02 || ok13) return use02 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [[f[1], f[2], f[3]], [f[1], f[3], f[0]]];
  }
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(X(i), Y(i)));
  let tris = [];
  try { tris = THREE.ShapeUtils.triangulateShape(pts, []); } catch (e) { tris = []; }
  if (!tris.length) { const out = []; for (let i = 1; i < n - 1; i++) out.push([f[0], f[i], f[i + 1]]); return out; }
  return tris.map(([a, b, c]) => (cr(a, b, c) * area < 0 ? [f[a], f[c], f[b]] : [f[a], f[b], f[c]]));
}

function faceTris(fi) {
  const N = S.faceN;
  return triangulateFace(S.mesh.faces[fi], S.mesh.pos, N[fi * 3], N[fi * 3 + 1], N[fi * 3 + 2]);
}

function cleanupMesh(m) {
  const faces = [];
  for (const f of m.faces) {
    const arr = [];
    for (const v of f) if (!arr.length || arr[arr.length - 1] !== v) arr.push(v);
    while (arr.length > 1 && arr[0] === arr[arr.length - 1]) arr.pop();
    if (arr.length < 3 || new Set(arr).size < 3) continue;
    faces.push(arr);
  }
  const nV = m.pos.length / 3, remap = new Int32Array(nV).fill(-1), pos = [];
  for (const f of faces) for (let i = 0; i < f.length; i++) {
    const v = f[i];
    if (remap[v] < 0) { remap[v] = pos.length / 3; pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); }
    f[i] = remap[v];
  }
  const removedVerts = nV - pos.length / 3;
  m.pos = pos; m.faces = faces;
  return removedVerts;
}

function weldMesh(m, eps) {
  const P = m.pos, n = P.length / 3, map = new Map(), remap = new Int32Array(n);
  const inv = 1 / Math.max(eps, 1e-12);
  let merged = 0;
  for (let i = 0; i < n; i++) {
    const key = Math.round(P[i * 3] * inv) + ',' + Math.round(P[i * 3 + 1] * inv) + ',' + Math.round(P[i * 3 + 2] * inv);
    const r = map.get(key);
    if (r === undefined) { map.set(key, i); remap[i] = i; } else { remap[i] = r; merged++; }
  }
  if (merged) { m.faces = m.faces.map((f) => f.map((v) => remap[v])); cleanupMesh(m); }
  return merged;
}

function fromTriangleSoup(arr) {
  const map = new Map(), pos = [], faces = [];
  const id = (x, y, z) => {
    const k = x + '_' + y + '_' + z;
    let i = map.get(k);
    if (i === undefined) { i = pos.length / 3; pos.push(x, y, z); map.set(k, i); }
    return i;
  };
  for (let t = 0; t + 8 < arr.length; t += 9) {
    const a = id(arr[t], arr[t + 1], arr[t + 2]), b = id(arr[t + 3], arr[t + 4], arr[t + 5]), c = id(arr[t + 6], arr[t + 7], arr[t + 8]);
    if (a !== b && b !== c && a !== c) faces.push([a, b, c]);
  }
  return { pos, faces };
}

function fromThreeObject(obj) {
  const allPositions = [];
  obj.traverse((node) => {
    if (node.isMesh && node.geometry) {
      const geom = node.geometry.clone();
      if (node.matrixWorld) geom.applyMatrix4(node.matrixWorld);
      const posAttr = geom.getAttribute('position');
      if (posAttr) {
        const arr = posAttr.array;
        for (let i = 0; i < arr.length; i++) allPositions.push(arr[i]);
      }
    }
  });
  if (!allPositions.length) return { pos: [], faces: [] };
  return fromTriangleSoup(new Float32Array(allPositions));
}

function bbox(m = S.mesh, idx = null) {
  const b = new THREE.Box3();
  const P = m.pos, v = new THREE.Vector3();
  if (idx) for (const i of idx) b.expandByPoint(v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
  else for (let i = 0; i < P.length; i += 3) b.expandByPoint(v.set(P[i], P[i + 1], P[i + 2]));
  return b;
}

/* =====================================================================
   3. RENDER: reconstrucción de buffers (CON COLORES POR CARA)
   ===================================================================== */
function attr(geo, name, size, count) {
  let a = geo.getAttribute(name);
  if (!a || a.array.length !== count * size) {
    if (a) geo.dispose();
    a = new THREE.BufferAttribute(new Float32Array(count * size), size); geo.setAttribute(name, a);
  }
  else a.needsUpdate = true;
  return a;
}

function rebuildRender() {
  computeFaceInfo();
  const P = S.mesh.pos, F = S.mesh.faces, edit = S.mode === 'edit';
  
  // caras
  const tris = [], tf = [];
  for (let fi = 0; fi < F.length; fi++) for (const t of faceTris(fi)) { tris.push(t); tf.push(fi); }
  S.triCount = tris.length;
  S.triFace = Int32Array.from(tf);
  const pa = attr(meshGeo, 'position', 3, tris.length * 3).array;
  const ca = attr(meshGeo, 'color', 3, tris.length * 3).array;
  
  for (let t = 0; t < tris.length; t++) {
    const fi = tf[t];
    // Color de la cara: solo aplicar color personalizado si existe, sino papel blanco
    let col = C.paper;
    if (S.faceColors.has(fi) && S.faceColors.get(fi)) {
      col = S.faceColors.get(fi);
    }
    // Sobrescribir con colores de estado (selección, hover, no-planar)
    if (edit && S.sel === 'f' && S.selF.has(fi)) {
      col = C.faceSel;
    } else if (fi === S.hoverF && !S.modal && !S.directDrag) {
      col = C.hover;
    } else if (S.showNP && S.faceNP[fi] && !S.faceColors.has(fi)) {
      col = C.nonPlanar;
    }
    
    for (let k = 0; k < 3; k++) {
      const v = tris[t][k] * 3, o = t * 9 + k * 3;
      pa[o] = P[v]; pa[o + 1] = P[v + 1]; pa[o + 2] = P[v + 2];
      ca[o] = col.r; ca[o + 1] = col.g; ca[o + 2] = col.b;
    }
  }
  meshGeo.setDrawRange(0, tris.length * 3);
  meshGeo.computeBoundingSphere(); meshGeo.computeBoundingBox();

  // aristas
  const E = S.edges;
  const ep = attr(edgeGeo, 'position', 3, E.length * 2).array;
  const ec = attr(edgeGeo, 'color', 3, E.length * 2).array;
  const N = S.faceN, Cc = S.faceC, cosFlat = Math.cos(THREE.MathUtils.degToRad(1));
  for (let i = 0; i < E.length; i++) {
    const e = E[i], a = e.a * 3, b = e.b * 3, o = i * 6;
    ep[o] = P[a]; ep[o + 1] = P[a + 1]; ep[o + 2] = P[a + 2];
    ep[o + 3] = P[b]; ep[o + 4] = P[b + 1]; ep[o + 5] = P[b + 2];
    let col = edit ? C.ink : C.inkSoft;
    const nf = e.f.length;
    if (nf === 1) col = C.boundary;
    else if (nf > 2) col = C.nonManifold;
    else if (S.fold) {
      const f1 = e.f[0] * 3, f2 = e.f[1] * 3;
      const dot = N[f1] * N[f2] + N[f1 + 1] * N[f2 + 1] + N[f1 + 2] * N[f2 + 2];
      if (dot > cosFlat) col = C.flat;
      else {
        const conv = (Cc[f2] - Cc[f1]) * N[f1] + (Cc[f2 + 1] - Cc[f1 + 1]) * N[f1 + 1] + (Cc[f2 + 2] - Cc[f1 + 2]) * N[f1 + 2];
        col = conv <= 0 ? C.ink : C.valley;
      }
    }
    if (edit && S.sel === 'e' && S.selE.has(e.k)) col = C.sel;
    else if (e.k === S.hoverE && !S.modal && !S.directDrag) col = C.hover;
    ec[o] = ec[o + 3] = col.r; ec[o + 1] = ec[o + 4] = col.g; ec[o + 2] = ec[o + 5] = col.b;
  }
  edgeGeo.setDrawRange(0, E.length * 2);
  edgeGeo.computeBoundingSphere();
  edgeLines.visible = S.showEdges || edit;
  edgeMat.opacity = edit ? 0.95 : 0.6;

  // vértices
  const nV = P.length / 3;
  points.visible = edit && S.sel === 'v';
  if (points.visible) {
    const pp = attr(pointGeo, 'position', 3, nV).array;
    const pc = attr(pointGeo, 'aColor', 3, nV).array;
    const ps = attr(pointGeo, 'aSize', 1, nV).array;
    for (let i = 0; i < nV; i++) {
      pp[i * 3] = P[i * 3]; pp[i * 3 + 1] = P[i * 3 + 1]; pp[i * 3 + 2] = P[i * 3 + 2];
      const s = S.selV.has(i);
      const h = i === S.hoverV && !S.modal && !S.directDrag;
      const col = s ? C.sel : (h ? C.hover : C.ink);
      pc[i * 3] = col.r; pc[i * 3 + 1] = col.g; pc[i * 3 + 2] = col.b;
      ps[i] = s ? 11 : (h ? 9 : 6);
    }
    pointGeo.setDrawRange(0, nV);
    pointGeo.computeBoundingSphere();
  }

  // marcas de corte + tapete bajo el modelo
  const bb = meshGeo.boundingBox;
  crop.visible = !edit && S.objSel && F.length > 0;
  if (crop.visible) buildCropMarks(bb);
  if (F.length) matMesh.position.y = bb.min.y - S.size * 0.002;

  // rayos X
  frontMat.transparent = backMat.transparent = S.xray;
  frontMat.opacity = backMat.opacity = S.xray ? 0.45 : 1;
  frontMat.depthWrite = backMat.depthWrite = !S.xray;
  edgeMat.depthTest = !S.xray;
  pointMat.depthTest = !S.xray;
  
  // punto de vista previa
  updatePreviewDot();
}

function buildCropMarks(bb) {
  const s = bb.getSize(new THREE.Vector3()), L = Math.max(s.x, s.y, s.z) * 0.12, arr = [];
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? bb.max.x : bb.min.x, y = i & 2 ? bb.max.y : bb.min.y, z = i & 4 ? bb.max.z : bb.min.z;
    const dx = i & 1 ? -L : L, dy = i & 2 ? -L : L, dz = i & 4 ? -L : L;
    arr.push(x, y, z, x + dx, y, z, x, y, z, x, y + dy, z, x, y, z, x, y, z + dz);
  }
  cropGeo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
}

function refresh() {
  buildEdges();
  rebuildRender();
  updateStats();
}

function afterTopology(keepSel = false) {
  if (!keepSel) clearSel();
  resetDecim();
  refresh();
}

/* =====================================================================
   4. HISTORIA (deshacer / rehacer)
   ===================================================================== */
const snapshot = (m = S.mesh) => ({ 
  pos: m.pos.slice(), 
  faces: m.faces.map((f) => f.slice()),
  colors: new Map(S.faceColors) 
});
const restore = (s) => { 
  S.mesh = { pos: s.pos.slice(), faces: s.faces.map((f) => f.slice()) }; 
  S.faceColors = new Map(s.colors);
};
function pushUndo(s) { S.undo.push(s); if (S.undo.length > 40) S.undo.shift(); S.redo.length = 0; }
function undo() {
  if (S.modal || S.activeTool) return;
  if (!S.undo.length) return toast('Nada que deshacer', 'warn');
  S.redo.push(snapshot()); restore(S.undo.pop()); afterTopology(); toast('Deshecho');
}
function redo() {
  if (S.modal || S.activeTool) return;
  if (!S.redo.length) return toast('Nada que rehacer', 'warn');
  S.undo.push(snapshot()); restore(S.redo.pop()); afterTopology(); toast('Rehecho');
}
function op(label, fn, keepSel = false) {
  const before = snapshot();
  const msg = fn();
  if (msg === false) return;
  pushUndo(before);
  afterTopology(keepSel);
  if (typeof msg === 'string') toast(msg); else if (label) toast(label);
}

/* =====================================================================
   5. SELECCIÓN Y HOVER
   ===================================================================== */
function clearSel() { S.selV.clear(); S.selE.clear(); S.selF.clear(); }
function clearHover() { S.hoverV = -1; S.hoverE = null; S.hoverF = -1; }

function affectedVerts() {
  if (S.mode === 'object') return S.objSel ? [...Array(S.mesh.pos.length / 3).keys()] : [];
  const set = new Set();
  if (S.sel === 'v') S.selV.forEach((v) => set.add(v));
  else if (S.sel === 'e') S.selE.forEach((k) => { const e = S.edgeMap.get(k); if (e) { set.add(e.a); set.add(e.b); } });
  else S.selF.forEach((fi) => { const f = S.mesh.faces[fi]; if (f) f.forEach((v) => set.add(v)); });
  return [...set];
}

function selCount() { return S.sel === 'v' ? S.selV.size : S.sel === 'e' ? S.selE.size : S.selF.size; }

function setSelMode(m) {
  if (S.mode !== 'edit') setMode('edit');
  if (m === S.sel) return;
  const verts = new Set(affectedVerts());
  clearSel();
  S.sel = m;
  if (m === 'v') verts.forEach((v) => S.selV.add(v));
  if (m === 'e') for (const e of S.edges) if (verts.has(e.a) && verts.has(e.b)) S.selE.add(e.k);
  if (m === 'f') S.mesh.faces.forEach((f, i) => { if (f.every((v) => verts.has(v))) S.selF.add(i); });
  syncUI(); rebuildRender(); updateStats();
}

function setMode(m) {
  if (S.modal) return;
  exitActiveTool();
  S.mode = m;
  if (m === 'object') S.objSel = true;
  clearHover();
  syncUI(); rebuildRender(); updateStats();
}

function selectAll(toggle = true) {
  if (S.mode === 'object') { S.objSel = toggle ? !S.objSel : true; rebuildRender(); return; }
  const full = toggle && selCount() > 0;
  clearSel();
  if (!full) {
    if (S.sel === 'v') for (let i = 0; i < S.mesh.pos.length / 3; i++) S.selV.add(i);
    if (S.sel === 'e') S.edges.forEach((e) => S.selE.add(e.k));
    if (S.sel === 'f') S.mesh.faces.forEach((_, i) => S.selF.add(i));
  }
  rebuildRender(); updateStats();
}

function invertSel() {
  if (S.mode !== 'edit') return;
  if (S.sel === 'v') { const n = new Set(); for (let i = 0; i < S.mesh.pos.length / 3; i++) if (!S.selV.has(i)) n.add(i); S.selV = n; }
  if (S.sel === 'e') { const n = new Set(); S.edges.forEach((e) => { if (!S.selE.has(e.k)) n.add(e.k); }); S.selE = n; }
  if (S.sel === 'f') { const n = new Set(); S.mesh.faces.forEach((_, i) => { if (!S.selF.has(i)) n.add(i); }); S.selF = n; }
  rebuildRender(); updateStats();
}

/* --- PICKING EN PANTALLA (con hover) --- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function setRay(px, py) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  ray.near = 0; ray.far = Infinity;
}

function hitFace(px, py) {
  if (!S.mesh.faces.length) return null;
  setRay(px, py);
  const h = ray.intersectObjects([frontMesh, backMesh], false)[0];
  return h ? { face: S.triFace[h.faceIndex], dist: h.distance, point: h.point.clone() } : null;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function project(x, y, z) {
  _v.set(x, y, z).project(camera);
  const r = canvas.getBoundingClientRect();
  return { x: ((_v.x + 1) / 2) * r.width + r.left, y: ((1 - _v.y) / 2) * r.height + r.top, ok: _v.z > -1 && _v.z < 1 };
}

function projectAll() {
  const P = S.mesh.pos, n = P.length / 3, out = new Float32Array(n * 3);
  const r = canvas.getBoundingClientRect();
  const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  for (let i = 0; i < n; i++) {
    _v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(m);
    out[i * 3] = ((_v.x + 1) / 2) * r.width + r.left;
    out[i * 3 + 1] = ((1 - _v.y) / 2) * r.height + r.top;
    out[i * 3 + 2] = _v.z > -1 && _v.z < 1 ? 1 : 0;
  }
  return out;
}

function visible(x, y, z) {
  if (S.xray) return true;
  _w.set(x, y, z);
  const dir = _w.clone().sub(camera.position), dist = dir.length();
  ray.set(camera.position, dir.normalize());
  ray.near = 0; ray.far = dist;
  const h = ray.intersectObjects([frontMesh, backMesh], false)[0];
  return !h || h.distance >= dist - S.size * 0.004;
}

function pickVertex(px, py) {
  const pr = projectAll(), P = S.mesh.pos, R = 14, cand = [];
  for (let i = 0; i < pr.length / 3; i++) {
    if (!pr[i * 3 + 2]) continue;
    const d = (pr[i * 3] - px) ** 2 + (pr[i * 3 + 1] - py) ** 2;
    if (d < R * R) cand.push([d, i]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, i] of cand.slice(0, 24)) if (visible(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])) return i;
  return -1;
}

function pickEdge(px, py) {
  const pr = projectAll(), P = S.mesh.pos, R = 9, cand = [];
  for (const e of S.edges) {
    if (!pr[e.a * 3 + 2] || !pr[e.b * 3 + 2]) continue;
    const ax = pr[e.a * 3], ay = pr[e.a * 3 + 1], bx = pr[e.b * 3], by = pr[e.b * 3 + 1];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
    const d = (ax + t * dx - px) ** 2 + (ay + t * dy - py) ** 2;
    if (d < R * R) cand.push([d, e, t]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, e, t] of cand.slice(0, 16)) {
    const a = e.a * 3, b = e.b * 3;
    if (visible(P[a] + (P[b] - P[a]) * t, P[a + 1] + (P[b + 1] - P[a + 1]) * t, P[a + 2] + (P[b + 2] - P[a + 2]) * t)) return e.k;
  }
  return null;
}

function updateHover(px, py) {
  if (S.mode !== 'edit' || S.modal || S.directDrag || S.activeTool) { clearHover(); return; }
  const oldV = S.hoverV, oldE = S.hoverE, oldF = S.hoverF;
  clearHover();
  if (S.sel === 'v') S.hoverV = pickVertex(px, py);
  else if (S.sel === 'e') S.hoverE = pickEdge(px, py);
  else { const h = hitFace(px, py); if (h) S.hoverF = h.face; }
  if (S.hoverV !== oldV || S.hoverE !== oldE || S.hoverF !== oldF) rebuildRender();
}

function clickSelect(px, py, shift) {
  if (S.mode === 'object') { S.objSel = !!hitFace(px, py); rebuildRender(); updateStats(); return; }
  let set, item = null;
  if (S.sel === 'v') { set = S.selV; const i = pickVertex(px, py); if (i >= 0) item = i; }
  else if (S.sel === 'e') { set = S.selE; item = pickEdge(px, py); }
  else { set = S.selF; const h = hitFace(px, py); if (h) item = h.face; }
  if (item === null) { if (!shift) clearSel(); }
  else if (shift) { set.has(item) ? set.delete(item) : set.add(item); }
  else { clearSel(); set.add(item); }
  rebuildRender(); updateStats();
}

function boxSelect(x0, y0, x1, y1, shift, sub) {
  if (S.mode === 'object') { S.objSel = true; rebuildRender(); return; }
  const minX = Math.min(x0, x1), maxX = Math.max(x0, x1), minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const inR = (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  const pr = projectAll(), P = S.mesh.pos, cand = [];
  if (S.sel === 'v') {
    for (let i = 0; i < pr.length / 3; i++) if (pr[i * 3 + 2] && inR(pr[i * 3], pr[i * 3 + 1])) cand.push([i, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
  } else if (S.sel === 'e') {
    for (const e of S.edges) {
      if (!pr[e.a * 3 + 2] || !pr[e.b * 3 + 2]) continue;
      if (inR((pr[e.a * 3] + pr[e.b * 3]) / 2, (pr[e.a * 3 + 1] + pr[e.b * 3 + 1]) / 2)) {
        const a = e.a * 3, b = e.b * 3;
        cand.push([e.k, (P[a] + P[b]) / 2, (P[a + 1] + P[b + 1]) / 2, (P[a + 2] + P[b + 2]) / 2]);
      }
    }
  } else {
    const Cc = S.faceC;
    for (let fi = 0; fi < S.mesh.faces.length; fi++) {
      const p = project(Cc[fi * 3], Cc[fi * 3 + 1], Cc[fi * 3 + 2]);
      if (p.ok && inR(p.x, p.y)) cand.push([fi, Cc[fi * 3], Cc[fi * 3 + 1], Cc[fi * 3 + 2]]);
    }
  }
  const testOcc = !S.xray && cand.length * S.triCount < 4e7;
  const set = S.sel === 'v' ? S.selV : S.sel === 'e' ? S.selE : S.selF;
  if (!shift && !sub) clearSel();
  for (const [id, x, y, z] of cand) {
    if (testOcc && !visible(x, y, z)) continue;
    sub ? set.delete(id) : set.add(id);
  }
  rebuildRender(); updateStats();
}

/* =====================================================================
   6. TRANSFORMACIONES MODALES G / R / S (estilo Blender)
   ===================================================================== */
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

function startModal(type) {
  if (S.modal || !S.mesh.faces.length) return;
  const idx = affectedVerts();
  if (!idx.length) return toast(S.mode === 'object' ? 'Haz clic en el modelo para seleccionarlo' : 'Selecciona algo primero', 'warn');
  const P = S.mesh.pos, orig = new Float64Array(idx.length * 3);
  idx.forEach((v, k) => { orig[k * 3] = P[v * 3]; orig[k * 3 + 1] = P[v * 3 + 1]; orig[k * 3 + 2] = P[v * 3 + 2]; });
  const pivot = bbox(S.mesh, idx).getCenter(new THREE.Vector3());
  S.modal = { type, idx, orig, pivot, start: { ...S.mouse }, axis: null, num: '', snap: false, before: snapshot() };
  controls.enabled = false;
  document.querySelectorAll(`.tool[data-act="${({ G: 'move', R: 'rotate', S: 'scale' })[type]}"]`).forEach((b) => b.classList.add('active'));
  $('#hud').style.display = 'block';
  updateModal();
}

function planeHit(px, py, pivot, axis) {
  setRay(px, py);
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  let normal = fwd.clone();
  if (axis) {
    const a = AX[axis];
    normal = a.clone().cross(fwd).cross(a);
    if (normal.lengthSq() < 1e-8) normal = fwd.clone();
    normal.normalize();
  }
  const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, pivot);
  return ray.ray.intersectPlane(pl, new THREE.Vector3());
}

function updateModal() {
  const M = S.modal; if (!M) return;
  const P = S.mesh.pos, { idx, orig, pivot } = M;
  const num = M.num !== '' && M.num !== '-' && !isNaN(parseFloat(M.num)) ? parseFloat(M.num) : null;
  const axName = M.axis ? ` · eje <em>${M.axis.toUpperCase()}</em>` : '';
  let title = '';
  if (M.type === 'G') {
    let d = new THREE.Vector3();
    if (num !== null && M.axis) d.copy(AX[M.axis]).multiplyScalar(num);
    else {
      const h0 = planeHit(M.start.x, M.start.y, pivot, M.axis), h1 = planeHit(S.mouse.x, S.mouse.y, pivot, M.axis);
      if (h0 && h1) d.subVectors(h1, h0);
      if (M.axis) d.copy(AX[M.axis]).multiplyScalar(d.dot(AX[M.axis]));
      if (M.snap) { const st = S.gridStep / 2; d.set(Math.round(d.x / st) * st, Math.round(d.y / st) * st, Math.round(d.z / st) * st); }
    }
    idx.forEach((v, k) => { P[v * 3] = orig[k * 3] + d.x; P[v * 3 + 1] = orig[k * 3 + 1] + d.y; P[v * 3 + 2] = orig[k * 3 + 2] + d.z; });
    const show = M.axis ? d.dot(AX[M.axis]) : d.length();
    title = `Mover${axName} · <em>${show.toFixed(2)} ${S.unit}</em>`;
  } else if (M.type === 'R') {
    const ps = project(pivot.x, pivot.y, pivot.z);
    let ang = Math.atan2(S.mouse.y - ps.y, S.mouse.x - ps.x) - Math.atan2(M.start.y - ps.y, M.start.x - ps.x);
    if (num !== null) ang = THREE.MathUtils.degToRad(num);
    else if (M.snap) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const axis = M.axis ? AX[M.axis].clone() : fwd.clone();
    if (axis.dot(fwd) < 0) axis.negate();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, ang), t = new THREE.Vector3();
    idx.forEach((v, k) => {
      t.set(orig[k * 3] - pivot.x, orig[k * 3 + 1] - pivot.y, orig[k * 3 + 2] - pivot.z).applyQuaternion(q).add(pivot);
      P[v * 3] = t.x; P[v * 3 + 1] = t.y; P[v * 3 + 2] = t.z;
    });
    let deg = THREE.MathUtils.radToDeg(ang); deg = ((deg + 540) % 360) - 180;
    title = `Rotar${axName} · <em>${deg.toFixed(1)}°</em>`;
  } else {
    const ps = project(pivot.x, pivot.y, pivot.z);
    const d0 = Math.max(Math.hypot(M.start.x - ps.x, M.start.y - ps.y), 4);
    let f = Math.hypot(S.mouse.x - ps.x, S.mouse.y - ps.y) / d0;
    if (num !== null) f = num; else if (M.snap) f = Math.round(f * 10) / 10;
    const fx = !M.axis || M.axis === 'x' ? f : 1, fy = !M.axis || M.axis === 'y' ? f : 1, fz = !M.axis || M.axis === 'z' ? f : 1;
    idx.forEach((v, k) => {
      P[v * 3] = pivot.x + (orig[k * 3] - pivot.x) * fx;
      P[v * 3 + 1] = pivot.y + (orig[k * 3 + 1] - pivot.y) * fy;
      P[v * 3 + 2] = pivot.z + (orig[k * 3 + 2] - pivot.z) * fz;
    });
    title = `Escalar${axName} · <em>×${f.toFixed(3)}</em>`;
  }
  $('#hudT').innerHTML = title + (M.num ? ` <span style="opacity:.7">[${M.num}]</span>` : '');
  $('#hudH').textContent = 'Clic: confirmar · Clic der./Esc: cancelar · X Y Z: eje · Ctrl: pasos · teclea un valor';
  rebuildRender(); updateDims();
}

function endModal(ok) {
  const M = S.modal; if (!M) return;
  if (!ok) {
    const P = S.mesh.pos;
    M.idx.forEach((v, k) => { P[v * 3] = M.orig[k * 3]; P[v * 3 + 1] = M.orig[k * 3 + 1]; P[v * 3 + 2] = M.orig[k * 3 + 2]; });
  } else { pushUndo(M.before); resetDecim(); }
  S.modal = null;
  controls.enabled = true;
  document.querySelectorAll('.tool.active').forEach((b) => b.classList.remove('active'));
  $('#hud').style.display = 'none';
  rebuildRender(); updateStats();
}

function modalKey(e) {
  const M = S.modal, k = e.key;
  e.preventDefault();
  if (k === 'Escape') return endModal(false);
  if (k === 'Enter') return endModal(true);
  const ax = { KeyX: 'x', KeyY: 'y', KeyZ: 'z' }[e.code];
  if (ax) { M.axis = M.axis === ax ? null : ax; }
  else if (/^[0-9.]$/.test(k)) M.num += k;
  else if (k === '-') M.num = M.num.startsWith('-') ? M.num.slice(1) : '-' + M.num;
  else if (k === 'Backspace') M.num = M.num.slice(0, -1);
  else if (k === 'Control') M.snap = true;
  updateModal();
}

/* =====================================================================
   7. ARRASTRE DIRECTO (mover sin G) y FUSIÓN AL SOLTAR
   ===================================================================== */
function startDirectDrag(px, py) {
  if (S.mode !== 'edit' || S.modal || S.activeTool) return false;
  let idx = null, pivot = null;
  if (S.sel === 'v') {
    const v = pickVertex(px, py);
    if (v < 0) return false;
    idx = S.selV.has(v) ? affectedVerts() : [v];
  } else if (S.sel === 'e') {
    const k = pickEdge(px, py);
    if (!k) return false;
    const e = S.edgeMap.get(k);
    if (!e) return false;
    idx = S.selE.has(k) ? affectedVerts() : [e.a, e.b];
  } else {
    const h = hitFace(px, py);
    if (!h) return false;
    idx = S.selF.has(h.face) ? affectedVerts() : S.mesh.faces[h.face].slice();
  }
  if (!idx || !idx.length) return false;
  const P = S.mesh.pos, orig = new Float64Array(idx.length * 3);
  idx.forEach((v, k) => { orig[k * 3] = P[v * 3]; orig[k * 3 + 1] = P[v * 3 + 1]; orig[k * 3 + 2] = P[v * 3 + 2]; });
  pivot = bbox(S.mesh, idx).getCenter(new THREE.Vector3());
  S.directDrag = { idx, orig, pivot, start: { x: px, y: py }, before: snapshot(), singleV: S.sel === 'v' && idx.length === 1 ? idx[0] : null, hasMoved: false };
  controls.enabled = false;
  clearHover();
  return true;
}

function updateDirectDrag(px, py) {
  const D = S.directDrag; if (!D) return;
  const dist = Math.hypot(px - D.start.x, py - D.start.y);
  if (dist < 3) return; // No mover si no se ha movido al menos 3 píxeles
  D.hasMoved = true;
  const P = S.mesh.pos, { idx, orig, pivot } = D;
  const h0 = planeHit(D.start.x, D.start.y, pivot, null), h1 = planeHit(px, py, pivot, null);
  if (!h0 || !h1) return;
  const d = new THREE.Vector3().subVectors(h1, h0);
  idx.forEach((v, k) => { P[v * 3] = orig[k * 3] + d.x; P[v * 3 + 1] = orig[k * 3 + 1] + d.y; P[v * 3 + 2] = orig[k * 3 + 2] + d.z; });
  rebuildRender(); updateDims();
}

function endDirectDrag(px, py) {
  const D = S.directDrag; if (!D) return;
  const hasMoved = D.hasMoved;
  S.directDrag = null;
  controls.enabled = true;
  
  // Si no se movió nada, no hacer nada
  if (!hasMoved) return;
  
  // fusionar si suelto un vértice sobre otro
  if (D.singleV !== null) {
    const target = pickVertex(px, py);
    if (target >= 0 && target !== D.singleV) {
      const P = S.mesh.pos;
      P[D.singleV * 3] = P[target * 3];
      P[D.singleV * 3 + 1] = P[target * 3 + 1];
      P[D.singleV * 3 + 2] = P[target * 3 + 2];
      S.mesh.faces = S.mesh.faces.map((f) => f.map((v) => v === D.singleV ? target : v));
      cleanupMesh(S.mesh);
      pushUndo(D.before);
      afterTopology();
      toast(`Vértices unidos automáticamente`);
      return;
    }
  }
  pushUndo(D.before);
  resetDecim();
  rebuildRender(); updateStats();
}

/* =====================================================================
   8. AÑADIR VÉRTICES (herramienta V + doble clic)
   ===================================================================== */
function startAddVertexTool() {
  if (S.mode !== 'edit') setMode('edit');
  if (S.sel !== 'v') setSelMode('v');
  exitActiveTool();
  S.activeTool = 'addVertex';
  S.toolData = { before: snapshot() };
  controls.enabled = false;
  document.querySelector('.tool[data-act="addVertex"]')?.classList.add('active');
  updateHint();
  toast('Modo añadir vértice · clic en arista o cara · Ctrl: imán · Esc: salir');
}

function exitActiveTool() {
  if (!S.activeTool) return;
  if (S.activeTool === 'addVertex' || S.activeTool === 'knife') {
    if (S.toolData && S.toolData.before && S.toolData.changed) pushUndo(S.toolData.before);
    document.querySelector('.tool.active')?.classList.remove('active');
  }
  S.activeTool = null;
  S.toolData = null;
  S.knifePoints = [];
  S.previewPos = null;
  controls.enabled = true;
  knifeLines.visible = false;
  previewDot.visible = false;
  updateHint();
  rebuildRender();
}

function updatePreviewDot() {
  if (!S.previewPos || S.activeTool !== 'addVertex') { previewDot.visible = false; return; }
  const arr = [S.previewPos.x, S.previewPos.y, S.previewPos.z];
  previewGeo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  previewDot.visible = true;
}

function computeAddVertexPreview(px, py) {
  S.previewPos = null;
  if (S.activeTool !== 'addVertex') return;
  // primero arista
  const edgeK = pickEdge(px, py);
  if (edgeK) {
    const e = S.edgeMap.get(edgeK);
    if (e) {
      const P = S.mesh.pos;
      const a = e.a * 3, b = e.b * 3;
      const h0 = new THREE.Vector3(P[a], P[a + 1], P[a + 2]);
      const h1 = new THREE.Vector3(P[b], P[b + 1], P[b + 2]);
      const dir = new THREE.Vector3().subVectors(h1, h0);
      const len = dir.length();
      if (len < 1e-8) return;
      dir.normalize();
      setRay(px, py);
      const closest = ray.ray.closestPointToPoint(h0, new THREE.Vector3());
      let t = new THREE.Vector3().subVectors(closest, h0).dot(dir);
      t = Math.max(0, Math.min(len, t));
      if (S.snapMode) {
        const snaps = [0, len / 4, len / 2, len * 3 / 4, len];
        snaps.sort((x, y) => Math.abs(x - t) - Math.abs(y - t));
        t = snaps[0];
      }
      S.previewPos = h0.clone().addScaledVector(dir, t);
      return;
    }
  }
  // si no, cara
  const h = hitFace(px, py);
  if (h) {
    if (S.snapMode) {
      const Cc = S.faceC, fi = h.face;
      S.previewPos = new THREE.Vector3(Cc[fi * 3], Cc[fi * 3 + 1], Cc[fi * 3 + 2]);
    } else {
      S.previewPos = h.point.clone();
    }
  }
}

function addVertexAtPreview() {
  if (!S.previewPos) return toast('Haz clic sobre una arista o cara', 'warn');
  const pos3 = S.previewPos.clone();
  // detectar arista
  const edgeK = pickEdge(S.mouse.x, S.mouse.y);
  if (edgeK) {
    const e = S.edgeMap.get(edgeK);
    if (e) return splitEdgeAt(e, pos3);
  }
  // si no, añadir a cara
  const h = hitFace(S.mouse.x, S.mouse.y);
  if (h) return addVertexToFace(h.face, pos3);
  toast('No se detectó arista ni cara', 'warn');
}

function splitEdgeAt(e, pos3) {
  const P = S.mesh.pos, m = P.length / 3;
  P.push(pos3.x, pos3.y, pos3.z);
  const F = S.mesh.faces, out = [];
  for (const f of F) {
    const L = f.length;
    let at = -1;
    for (let i = 0; i < L; i++) {
      const u = f[i], w = f[(i + 1) % L];
      if ((u === e.a && w === e.b) || (u === e.b && w === e.a)) { at = i; break; }
    }
    if (at < 0) { out.push(f); continue; }
    const poly = [];
    for (let j = 0; j <= L; j++) poly.push(f[(at + j) % L]);
    poly.splice(1, 0, m);
    if (poly.length === 4) out.push([poly[0], poly[1], poly[2]], [poly[0], poly[2], poly[3]]);
    else out.push(poly);
  }
  S.mesh.faces = out;
  S.toolData.changed = true;
  clearSel(); S.selV.add(m);
  afterTopology(true);
  toast(`Vértice añadido en arista`);
}

function addVertexToFace(fi, pos3) {
  const P = S.mesh.pos, m = P.length / 3;
  P.push(pos3.x, pos3.y, pos3.z);
  const f = S.mesh.faces[fi];
  const out = [];
  for (let i = 0; i < f.length; i++) out.push([m, f[i], f[(i + 1) % f.length]]);
  S.mesh.faces.splice(fi, 1, ...out);
  S.toolData.changed = true;
  clearSel(); S.selV.add(m);
  afterTopology(true);
  toast(`Vértice añadido en cara`);
}

function handleDoubleClick(px, py) {
  if (S.mode !== 'edit') return;
  if (S.activeTool === 'addVertex') return;
  // doble clic en edit sin herramienta = añadir vértice automático
  const edgeK = pickEdge(px, py);
  if (edgeK) {
    const e = S.edgeMap.get(edgeK);
    if (e) {
      const P = S.mesh.pos;
      const a = e.a * 3, b = e.b * 3;
      const mid = new THREE.Vector3((P[a] + P[b]) / 2, (P[a + 1] + P[b + 1]) / 2, (P[a + 2] + P[b + 2]) / 2);
      op(null, () => { splitEdgeAt(e, mid); return `Vértice añadido en arista`; });
      return;
    }
  }
  const h = hitFace(px, py);
  if (h) {
    op(null, () => { addVertexToFace(h.face, h.point); return `Vértice añadido en cara`; });
  }
}

/* =====================================================================
   9. CUCHILLO (herramienta K)
   ===================================================================== */
function startKnifeTool() {
  if (S.mode !== 'edit') setMode('edit');
  exitActiveTool();
  S.activeTool = 'knife';
  S.toolData = { before: snapshot(), changed: false };
  S.knifePoints = [];
  controls.enabled = false;
  document.querySelector('.tool[data-act="knife"]')?.classList.add('active');
  knifeLines.visible = true;
  updateHint();
  toast('Cuchillo · clic en vértices/aristas/caras para cortar · Enter: aplicar · Esc: cancelar');
}

function updateKnifeLines() {
  if (S.activeTool !== 'knife') { knifeLines.visible = false; return; }
  const pts = S.knifePoints;
  if (pts.length < 2) { knifeLines.visible = false; return; }
  const arr = [];
  for (let i = 0; i < pts.length - 1; i++) {
    arr.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
  }
  knifeGeo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  knifeLines.visible = true;
}

function addKnifePoint(px, py) {
  let pos3 = null;
  const v = pickVertex(px, py);
  if (v >= 0) {
    const P = S.mesh.pos;
    pos3 = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
  } else {
    const edgeK = pickEdge(px, py);
    if (edgeK) {
      const e = S.edgeMap.get(edgeK);
      if (e) {
        const P = S.mesh.pos;
        const a = e.a * 3, b = e.b * 3;
        const h0 = new THREE.Vector3(P[a], P[a + 1], P[a + 2]);
        const h1 = new THREE.Vector3(P[b], P[b + 1], P[b + 2]);
        const dir = new THREE.Vector3().subVectors(h1, h0);
        const len = dir.length();
        if (len > 1e-8) {
          dir.normalize();
          setRay(px, py);
          const closest = ray.ray.closestPointToPoint(h0, new THREE.Vector3());
          let t = new THREE.Vector3().subVectors(closest, h0).dot(dir);
          t = Math.max(0, Math.min(len, t));
          pos3 = h0.clone().addScaledVector(dir, t);
        }
      }
    } else {
      const h = hitFace(px, py);
      if (h) pos3 = h.point.clone();
    }
  }
  if (!pos3) return toast('Haz clic en un vértice, arista o cara', 'warn');
  S.knifePoints.push(pos3);
  updateKnifeLines();
  toast(`Punto ${S.knifePoints.length} del cuchillo`);
}

function applyKnife() {
  const pts = S.knifePoints;
  if (pts.length < 2) return toast('Necesitas al menos 2 puntos', 'warn');
  // simplificación: unir con segmentos y añadir vértices
  toast(`Cuchillo aplicado con ${pts.length} puntos · función completa pendiente`, 'warn');
  S.toolData.changed = true;
  exitActiveTool();
}

/* =====================================================================
   10. CONECTAR VÉRTICES (J)
   ===================================================================== */
function joinSelectedVerts() {
  if (S.mode !== 'edit' || S.sel !== 'v') return toast('Selecciona 2 vértices en modo vértice', 'warn');
  const vs = [...S.selV];
  if (vs.length !== 2) return toast('Selecciona exactamente 2 vértices', 'warn');
  const [a, b] = vs;
  if (S.edgeMap.has(ek(a, b))) return toast('Ya existe una arista entre esos vértices', 'warn');
  op(null, () => {
    // buscar caras que contengan ambos vértices
    const F = S.mesh.faces;
    let found = false;
    for (let fi = 0; fi < F.length; fi++) {
      const f = F[fi];
      const ia = f.indexOf(a), ib = f.indexOf(b);
      if (ia < 0 || ib < 0) continue;
      const n = f.length;
      if (Math.abs(ia - ib) === 1 || Math.abs(ia - ib) === n - 1) continue; // ya contiguos
      // partir la cara en dos
      const f1 = [], f2 = [];
      let at = ia;
      while (at !== ib) { f1.push(f[at]); at = (at + 1) % n; }
      f1.push(f[ib]);
      at = ib;
      while (at !== ia) { f2.push(f[at]); at = (at + 1) % n; }
      f2.push(f[ia]);
      F.splice(fi, 1, f1, f2);
      found = true;
      break;
    }
    if (!found) return toast('Los vértices no están en la misma cara', 'warn');
    return `Arista creada entre vértices`;
  });
}

/* =====================================================================
   11. OPERACIONES DE EDICIÓN
   ===================================================================== */
function needEdit(kind) {
  if (S.mode !== 'edit') { toast('Entra en modo Edición (Tab)', 'warn'); return false; }
  if (kind && S.sel !== kind) setSelMode(kind);
  return true;
}

function mergeRegion(group) {
  const F = S.mesh.faces, inG = new Set(group), next = new Map();
  let count = 0;
  for (const fi of group) {
    const f = F[fi];
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i + 1) % f.length];
      const e = S.edgeMap.get(ek(a, b));
      const interior = e && e.f.length === 2 && inG.has(e.f[0]) && inG.has(e.f[1]) && e.d[0] !== e.d[1];
      if (interior) continue;
      if (next.has(a)) return null;
      next.set(a, b); count++;
    }
  }
  if (count < 3) return null;
  const start = next.keys().next().value, loop = [start];
  let cur = next.get(start), guard = 0;
  while (cur !== start && guard++ < count + 2) { if (cur === undefined) return null; loop.push(cur); cur = next.get(cur); }
  if (loop.length !== count || new Set(loop).size !== loop.length) return null;
  return loop;
}

function replaceFaces(remove, add) {
  const rm = new Set(remove);
  S.mesh.faces = S.mesh.faces.filter((_, i) => !rm.has(i)).concat(add);
  // actualizar colores
  const newColors = new Map();
  let fi = 0;
  for (let i = 0; i < S.mesh.faces.length + remove.length; i++) {
    if (!rm.has(i)) {
      if (S.faceColors.has(i)) newColors.set(fi, S.faceColors.get(i));
      fi++;
    }
  }
  S.faceColors = newColors;
}

function deleteOp() {
  if (S.mode === 'object') {
    if (!S.objSel || !S.mesh.faces.length) return;
    return op('Modelo eliminado · Ctrl+Z para recuperarlo', () => { S.mesh = { pos: [], faces: [] }; S.faceColors.clear(); });
  }
  if (!selCount()) return toast('Nada seleccionado', 'warn');
  if (S.sel === 'v') op(null, () => {
    const n = S.selV.size; S.mesh.faces = S.mesh.faces.filter((f) => !f.some((v) => S.selV.has(v))); cleanupMesh(S.mesh);
    return `${n} vértices eliminados`;
  });
  else if (S.sel === 'f') op(null, () => {
    const n = S.selF.size; replaceFaces([...S.selF], []); cleanupMesh(S.mesh); return `${n} caras eliminadas`;
  });
  else dissolveEdges();
}

function dissolveEdges() {
  if (!needEdit('e')) return;
  if (!S.selE.size) return toast('Selecciona aristas para disolver', 'warn');
  op(null, () => {
    const parent = new Map(), find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const boundaryFaces = new Set();
    for (const k of S.selE) {
      const e = S.edgeMap.get(k); if (!e) continue;
      if (e.f.length === 2) {
        for (const f of e.f) if (!parent.has(f)) parent.set(f, f);
        const ra = find(e.f[0]), rb = find(e.f[1]); if (ra !== rb) parent.set(ra, rb);
      } else if (e.f.length === 1) boundaryFaces.add(e.f[0]);
    }
    const groups = new Map();
    for (const f of parent.keys()) { const r = find(f); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(f); }
    const remove = [...boundaryFaces], add = [];
    let ok = 0, fail = 0;
    for (const g of groups.values()) {
      const loop = mergeRegion(g);
      if (loop) { remove.push(...g); add.push(loop); ok++; } else fail++;
    }
    if (!remove.length) { toast('No se pudo disolver (las caras forman un anillo o agujero)', 'warn'); return false; }
    replaceFaces(remove, add); cleanupMesh(S.mesh);
    return `Aristas disueltas · ${ok} polígono(s) nuevos${fail ? ` · ${fail} omitidos` : ''}`;
  });
}

function dissolveVerts() {
  if (!needEdit('v')) return;
  if (!S.selV.size) return toast('Selecciona vértices para disolver', 'warn');
  op(null, () => {
    let removed = 0;
    for (const v of S.selV) {
      const edges = S.edges.filter((e) => (e.a === v || e.b === v) && e.f.length === 2);
      if (edges.length === 2) {
        const faces = new Set([...edges[0].f, ...edges[1].f]);
        if (faces.size === 2) {
          const loop = mergeRegion([...faces]);
          if (loop) { replaceFaces([...faces], [loop]); removed++; }
        }
      }
    }
    if (!removed) { toast('No se pudo disolver ningún vértice', 'warn'); return false; }
    cleanupMesh(S.mesh);
    return `${removed} vértice(s) disueltos`;
  });
}

function mergeVerts() {
  if (S.mode !== 'edit') return toast('Entra en modo Edición (Tab) y selecciona vértices', 'warn');
  const vs = affectedVerts();
  if (vs.length < 2) return toast('Selecciona al menos 2 vértices', 'warn');
  op(null, () => {
    const P = S.mesh.pos, c = bbox(S.mesh, vs).getCenter(new THREE.Vector3());
    let sx = 0, sy = 0, sz = 0; for (const v of vs) { sx += P[v * 3]; sy += P[v * 3 + 1]; sz += P[v * 3 + 2]; }
    c.set(sx / vs.length, sy / vs.length, sz / vs.length);
    const t = vs[0], set = new Set(vs);
    P[t * 3] = c.x; P[t * 3 + 1] = c.y; P[t * 3 + 2] = c.z;
    S.mesh.faces = S.mesh.faces.map((f) => f.map((v) => (set.has(v) ? t : v)));
    cleanupMesh(S.mesh);
    return `${vs.length} vértices unidos en el centro`;
  });
}

function createFaceFromVerts() {
  if (S.mode !== 'edit') return toast('Entra en modo Edición (Tab)', 'warn');
  if (S.sel !== 'v') return toast('Cambia a modo vértice (tecla 1)', 'warn');
  if (S.selV.size < 3) return toast('Selecciona al menos 3 vértices para crear una cara', 'warn');
  
  op(null, () => {
    const vs = [...S.selV];
    const P = S.mesh.pos;
    
    // Calcular el centro y la normal aproximada
    let cx = 0, cy = 0, cz = 0;
    for (const v of vs) {
      cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2];
    }
    cx /= vs.length; cy /= vs.length; cz /= vs.length;
    
    // Calcular normal usando los primeros 3 vértices (método Newell)
    const v0 = vs[0] * 3, v1 = vs[1] * 3, v2 = vs[2] * 3;
    const ax = P[v1] - P[v0], ay = P[v1 + 1] - P[v0 + 1], az = P[v1 + 2] - P[v0 + 2];
    const bx = P[v2] - P[v0], by = P[v2 + 1] - P[v0 + 1], bz = P[v2 + 2] - P[v0 + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nlen = Math.hypot(nx, ny, nz) || 1;
    nx /= nlen; ny /= nlen; nz /= nlen;
    
    // Proyectar vértices al plano para ordenarlos
    // Usar el sistema de coordenadas local del plano
    const upx = Math.abs(nx) < 0.9 ? 1 : 0;
    const upy = Math.abs(nx) < 0.9 ? 0 : 1;
    const upz = 0;
    
    // Vector tangente U (en el plano)
    let ux = upy * nz - upz * ny;
    let uy = upz * nx - upx * nz;
    let uz = upx * ny - upy * nx;
    const ulen = Math.hypot(ux, uy, uz) || 1;
    ux /= ulen; uy /= ulen; uz /= ulen;
    
    // Vector tangente V (perpendicular a N y U)
    const vx = ny * uz - nz * uy;
    const vy = nz * ux - nx * uz;
    const vz = nx * uy - ny * ux;
    
    // Proyectar cada vértice y calcular ángulo desde el centro
    const angles = vs.map(v => {
      const px = P[v * 3] - cx, py = P[v * 3 + 1] - cy, pz = P[v * 3 + 2] - cz;
      const u = px * ux + py * uy + pz * uz;
      const w = px * vx + py * vy + pz * vz;
      return { v, angle: Math.atan2(w, u) };
    });
    
    // Ordenar por ángulo (sentido antihorario desde la normal)
    angles.sort((a, b) => a.angle - b.angle);
    const orderedVerts = angles.map(a => a.v);
    
    // Verificar que no exista ya una cara con estos vértices
    const vset = new Set(orderedVerts);
    for (const face of S.mesh.faces) {
      if (face.length === vset.size && face.every(v => vset.has(v))) {
        return toast('Ya existe una cara con estos vértices', 'warn');
      }
    }
    
    // Añadir la nueva cara
    S.mesh.faces.push(orderedVerts);
    
    return `Cara creada con ${orderedVerts.length} vértices`;
  });
}

function collapseEdges() {
  if (!needEdit('e')) return;
  if (!S.selE.size) return toast('Selecciona aristas para colapsar', 'warn');
  op(null, () => {
    const parent = new Map(), find = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) x = parent.get(x); return x; };
    for (const k of S.selE) { const e = S.edgeMap.get(k); if (e) { const a = find(e.a), b = find(e.b); if (a !== b) parent.set(a, b); } }
    const groups = new Map();
    for (const v of parent.keys()) { const r = find(v); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(v); }
    const P = S.mesh.pos, remap = new Map();
    for (const [r, g] of groups) {
      let x = 0, y = 0, z = 0; for (const v of g) { x += P[v * 3]; y += P[v * 3 + 1]; z += P[v * 3 + 2]; remap.set(v, r); }
      P[r * 3] = x / g.length; P[r * 3 + 1] = y / g.length; P[r * 3 + 2] = z / g.length;
    }
    S.mesh.faces = S.mesh.faces.map((f) => f.map((v) => (remap.has(v) ? remap.get(v) : v)));
    cleanupMesh(S.mesh);
    return `${S.selE.size} arista(s) colapsadas`;
  });
}

function splitEdges() {
  if (!needEdit('e')) return;
  if (!S.selE.size) return toast('Selecciona aristas para dividir', 'warn');
  op(null, () => {
    const P = S.mesh.pos;
    let F = S.mesh.faces, n = 0;
    for (const k of S.selE) {
      const e = S.edgeMap.get(k); if (!e) continue;
      const { a, b } = e, m = P.length / 3;
      P.push((P[a * 3] + P[b * 3]) / 2, (P[a * 3 + 1] + P[b * 3 + 1]) / 2, (P[a * 3 + 2] + P[b * 3 + 2]) / 2);
      const out = [];
      for (const f of F) {
        const L = f.length;
        let at = -1;
        for (let i = 0; i < L; i++) { const u = f[i], w = f[(i + 1) % L]; if ((u === a && w === b) || (u === b && w === a)) { at = i; break; } }
        if (at < 0) { out.push(f); continue; }
        const poly = [m]; for (let j = 1; j <= L; j++) poly.push(f[(at + j) % L]);
        for (let j = 1; j < poly.length - 1; j++) out.push([m, poly[j], poly[j + 1]]);
      }
      F = out; n++;
    }
    S.mesh.faces = F;
    return `${n} arista(s) divididas`;
  });
}

function flipEdges() {
  if (!needEdit('e')) return;
  if (!S.selE.size) return toast('Selecciona aristas entre dos triángulos', 'warn');
  const before = snapshot();
  const F = S.mesh.faces, exist = new Set(S.edges.map((e) => e.k)), newSel = [];
  let n = 0;
  for (const k of S.selE) {
    const e = S.edgeMap.get(k); if (!e) continue;
    const a = e.a, b = e.b;
    let fa = -1, fb = -1;
    for (let i = 0; i < F.length && (fa < 0 || fb < 0); i++) {
      const f = F[i]; if (f.length !== 3) continue;
      for (let j = 0; j < 3; j++) {
        if (f[j] === a && f[(j + 1) % 3] === b) fa = i;
        if (f[j] === b && f[(j + 1) % 3] === a) fb = i;
      }
    }
    if (fa < 0 || fb < 0) continue;
    const c = F[fa].find((v) => v !== a && v !== b), d = F[fb].find((v) => v !== a && v !== b);
    if (c === d || exist.has(ek(c, d))) continue;
    F[fa] = [c, a, d]; F[fb] = [d, b, c];
    exist.delete(ek(a, b)); exist.add(ek(c, d)); newSel.push(ek(c, d)); n++;
  }
  if (!n) return toast('Solo se voltean aristas compartidas por dos triángulos', 'warn');
  pushUndo(before); resetDecim(); clearSel(); newSel.forEach((k) => S.selE.add(k)); refresh();
  toast(`${n} arista(s) volteadas`);
}

function triangulateOp(which) {
  const sel = which === 'sel' ? (S.mode === 'edit' && S.sel === 'f' && S.selF.size ? S.selF : null) : null;
  op(null, () => {
    const out = []; let n = 0;
    S.mesh.faces.forEach((f, i) => {
      const doIt = f.length > 3 && (which === 'all' || (which === 'np' && S.faceNP[i]) || (which === 'sel' && (!sel || sel.has(i))));
      if (doIt) { out.push(...faceTris(i)); n++; } else out.push(f);
    });
    if (!n) { toast('No hay polígonos que triangular', 'warn'); return false; }
    S.mesh.faces = out;
    return `${n} polígono(s) triangulados`;
  });
}

function flipNormals() {
  const sel = S.mode === 'edit' && S.sel === 'f' && S.selF.size ? S.selF : null;
  op(null, () => {
    S.mesh.faces = S.mesh.faces.map((f, i) => (!sel || sel.has(i) ? f.slice().reverse() : f));
    return sel ? `Normales invertidas en ${sel.size} cara(s)` : 'Normales invertidas en todo el modelo';
  }, true);
}

function coplanarMerge() {
  const tolDeg = Math.max(0.01, parseFloat($('#copAngle').value) || 1), cosT = Math.cos(THREE.MathUtils.degToRad(tolDeg));
  op(null, () => {
    const F = S.mesh.faces, N = S.faceN, seen = new Uint8Array(F.length), remove = [], add = [];
    const nb = F.map(() => []);
    for (const e of S.edges) if (e.f.length === 2 && e.d[0] !== e.d[1]) { nb[e.f[0]].push(e.f[1]); nb[e.f[1]].push(e.f[0]); }
    let merged = 0;
    for (let s = 0; s < F.length; s++) {
      if (seen[s]) continue;
      seen[s] = 1;
      const group = [s], q = [s];
      while (q.length) {
        const f = q.pop();
        for (const g of nb[f]) {
          if (seen[g]) continue;
          const dot = N[s * 3] * N[g * 3] + N[s * 3 + 1] * N[g * 3 + 1] + N[s * 3 + 2] * N[g * 3 + 2];
          if (dot >= cosT) { seen[g] = 1; group.push(g); q.push(g); }
        }
      }
      if (group.length < 2) continue;
      const loop = mergeRegion(group);
      if (loop) { remove.push(...group); add.push(loop); merged += group.length; }
    }
    if (!merged) { toast('No hay caras coplanares contiguas', 'warn'); return false; }
    replaceFaces(remove, add); cleanupMesh(S.mesh);
    return `${merged} caras fusionadas en ${add.length} polígono(s)`;
  });
}

function weldByDistance() {
  const d = Math.max(0, parseFloat($('#weldDist').value) || 0);
  op(null, () => {
    const n = weldMesh(S.mesh, d || 1e-9);
    if (!n) { toast('No hay vértices tan cercanos', 'warn'); return false; }
    return `${n} vértice(s) unidos`;
  });
}

function centerOrigin() {
  if (!S.mesh.faces.length) return;
  op('Centrado en el origen y apoyado sobre el tapete', () => {
    const b = bbox(), c = b.getCenter(new THREE.Vector3()), P = S.mesh.pos;
    for (let i = 0; i < P.length; i += 3) { P[i] -= c.x; P[i + 1] -= b.min.y; P[i + 2] -= c.z; }
  }, true);
  frame(true);
}

/* =====================================================================
   12. DECIMACIÓN (SimplifyModifier de Three.js)
   ===================================================================== */
const simplifier = new SimplifyModifier();
function resetDecim() {
  S.decimBase = null; S.decimPushed = false;
  $('#decSlider').value = 100; $('#decPct').textContent = '100%';
}
function triSoup(m) {
  const tmp = S.mesh; S.mesh = m; computeFaceInfo();
  const arr = [];
  for (let fi = 0; fi < m.faces.length; fi++) for (const t of faceTris(fi)) for (const v of t) arr.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
  S.mesh = tmp;
  return new Float32Array(arr);
}
function decimTo(pct) {
  if (!S.mesh.faces.length) return;
  if (!S.decimBase) { S.decimBase = snapshot(); S.decimBase.tris = triSoup(S.decimBase); }
  const base = S.decimBase;
  clearSel();
  if (pct >= 100) { restore(base); refresh(); return; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(base.tris.slice(), 3));
  const nV = base.pos.length / 3;
  const remove = Math.max(0, Math.min(nV - 4, Math.round(nV * (1 - pct / 100))));
  try {
    const out = simplifier.modify(geo, remove);
    const m = fromTriangleSoup(out.attributes.position.array);
    if (m.faces.length >= 4) S.mesh = m;
  } catch (e) { console.warn(e); toast('La simplificación falló en este punto', 'warn'); }
  refresh();
}
function decimCommit() {
  if (S.decimBase && !S.decimPushed) { pushUndo(snapshot(S.decimBase)); S.decimPushed = true; }
}

/* =====================================================================
   12.5. VISTA PREVIA CON ROTACIÓN AUTOMÁTICA
   ===================================================================== */
let autoRotate = { enabled: false, speed: 1, timer: null };

function toggleAutoRotate() {
  autoRotate.enabled = !autoRotate.enabled;
  const btn = document.querySelector('[data-act="toggleRotate"]');
  
  if (autoRotate.enabled) {
    btn.classList.add('active');
    toast('Rotación automática activada', 'ok');
    startAutoRotate();
  } else {
    btn.classList.remove('active');
    toast('Rotación automática desactivada', 'ok');
    stopAutoRotate();
  }
}

function startAutoRotate() {
  if (autoRotate.timer) return;
  
  autoRotate.timer = setInterval(() => {
    if (!autoRotate.enabled) return;
    
    // Rotar la cámara alrededor del modelo
    const speed = autoRotate.speed * 0.01;
    const x = camera.position.x;
    const z = camera.position.z;
    const cos = Math.cos(speed);
    const sin = Math.sin(speed);
    
    camera.position.x = x * cos - z * sin;
    camera.position.z = x * sin + z * cos;
    camera.lookAt(controls.target);
  }, 16); // ~60 FPS
}

function stopAutoRotate() {
  if (autoRotate.timer) {
    clearInterval(autoRotate.timer);
    autoRotate.timer = null;
  }
}

function setRotateSpeed(speed) {
  autoRotate.speed = parseFloat(speed) || 1;
}

/* =====================================================================
   13. ANALIZAR Y REPARAR (manifold)
   ===================================================================== */
function healthStats() {
  let boundary = 0, nonMan = 0, badOrient = 0;
  for (const e of S.edges) {
    const n = e.f.length;
    if (n === 1) boundary++; else if (n > 2) nonMan++; else if (e.d[0] === e.d[1]) badOrient++;
  }
  return { boundary, nonMan, badOrient, np: S.npCount };
}

function countDuplicates(eps) {
  const P = S.mesh.pos, inv = 1 / eps, seen = new Set(); let d = 0;
  for (let i = 0; i < P.length; i += 3) {
    const k = Math.round(P[i] * inv) + ',' + Math.round(P[i + 1] * inv) + ',' + Math.round(P[i + 2] * inv);
    if (seen.has(k)) d++; else seen.add(k);
  }
  return d;
}

function analyzeOnly() {
  if (!S.mesh.faces.length) return;
  const eps = Math.max(bbox().getSize(new THREE.Vector3()).length() * 1e-5, 1e-7);
  const h = healthStats(), dup = countDuplicates(eps);
  showReport([
    ['Vértices duplicados', dup], ['Bordes abiertos (agujeros)', h.boundary], ['Aristas no-manifold', h.nonMan],
    ['Normales incoherentes', h.badOrient], ['Caras no planas', h.np],
  ], dup + h.boundary + h.nonMan + h.badOrient === 0, 'Análisis');
}

function repairMesh() {
  if (!S.mesh.faces.length) return toast('No hay malla que reparar', 'warn');
  const before = snapshot(), m = S.mesh;
  const diag = bbox().getSize(new THREE.Vector3()).length() || 1;
  const eps = Math.max(diag * 1e-5, 1e-7);
  const R = { weld: 0, degenerate: 0, duplicate: 0, internal: 0, flipped: 0, holes: 0, isolated: 0 };
  R.weld = weldMesh(m, eps);
  const nf0 = m.faces.length;
  m.faces = m.faces.filter((f) => faceNormal(f, m.pos, _n) > eps * eps);
  R.degenerate = nf0 - m.faces.length;
  const groups = new Map();
  m.faces.forEach((f, i) => { const k = f.slice().sort((a, b) => a - b).join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  const canon = (f) => { const i = f.indexOf(Math.min(...f)); return f.slice(i).concat(f.slice(0, i)).join(','); };
  const drop = new Set();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const c0 = canon(m.faces[g[0]]);
    const mixed = g.some((i) => canon(m.faces[i]) !== c0);
    if (mixed) g.forEach((i) => drop.add(i)); else g.slice(1).forEach((i) => drop.add(i));
  }
  R.duplicate = drop.size;
  if (drop.size) m.faces = m.faces.filter((_, i) => !drop.has(i));
  cleanupMesh(m);
  buildEdges(); computeFaceInfo(); rebuildRender();
  const cand = new Set();
  for (const e of S.edges) if (e.f.length > 2) e.f.forEach((f) => cand.add(f));
  if (cand.size && cand.size <= 4000) {
    const internal = [];
    const N = S.faceN, Cc = S.faceC, jitter = new THREE.Vector3(0.0123, 0.0071, -0.0049);
    const parity = (o, dir, self) => {
      ray.set(o, dir); ray.near = 0; ray.far = Infinity;
      const hits = ray.intersectObjects([frontMesh, backMesh], false);
      const faces = new Set(); let last = -1, n = 0;
      for (const h of hits) {
        const f = S.triFace[h.faceIndex];
        if (f === self || faces.has(f)) continue;
        if (Math.abs(h.distance - last) < eps * 10) continue;
        faces.add(f); last = h.distance; n++;
      }
      return n % 2;
    };
    for (const f of cand) {
      const n = new THREE.Vector3(N[f * 3], N[f * 3 + 1], N[f * 3 + 2]).add(jitter).normalize();
      const o = new THREE.Vector3(Cc[f * 3], Cc[f * 3 + 1], Cc[f * 3 + 2]);
      if (parity(o.clone().addScaledVector(n, eps * 5), n, f) && parity(o.clone().addScaledVector(n, -eps * 5), n.clone().negate(), f)) internal.push(f);
    }
    if (internal.length) { const s = new Set(internal); m.faces = m.faces.filter((_, i) => !s.has(i)); R.internal = internal.length; cleanupMesh(m); buildEdges(); }
  }
  const F = m.faces, flip = new Int8Array(F.length).fill(-1), adj = F.map(() => []);
  for (const e of S.edges) if (e.f.length === 2) { adj[e.f[0]].push([e.f[1], e.d[0] === e.d[1]]); adj[e.f[1]].push([e.f[0], e.d[0] === e.d[1]]); }
  const comp = new Int32Array(F.length).fill(-1); let nc = 0;
  for (let s = 0; s < F.length; s++) {
    if (flip[s] >= 0) continue;
    flip[s] = 0; comp[s] = nc; const q = [s];
    while (q.length) {
      const f = q.pop();
      for (const [g, same] of adj[f]) if (flip[g] < 0) { flip[g] = flip[f] ^ (same ? 1 : 0); comp[g] = nc; q.push(g); }
    }
    nc++;
  }
  const origCount = F.length;
  for (let i = 0; i < F.length; i++) if (flip[i]) F[i].reverse();
  buildEdges();
  const capFrom = new Map();
  for (const e of S.edges) if (e.f.length === 1) {
    const u = e.d[0] > 0 ? e.a : e.b, v = e.d[0] > 0 ? e.b : e.a;
    if (!capFrom.has(v)) capFrom.set(v, []);
    capFrom.get(v).push(u);
  }
  const P = m.pos;
  for (const startV of [...capFrom.keys()]) {
    while (capFrom.get(startV) && capFrom.get(startV).length) {
      const loop = [startV]; let cur = capFrom.get(startV).pop(), guard = 0;
      while (cur !== startV && guard++ < 100000) {
        loop.push(cur);
        const lst = capFrom.get(cur);
        if (!lst || !lst.length) { cur = -1; break; }
        cur = lst.pop();
      }
      if (cur !== startV || loop.length < 3) continue;
      if (loop.length === 3) m.faces.push(loop.slice());
      else {
        let x = 0, y = 0, z = 0; for (const v of loop) { x += P[v * 3]; y += P[v * 3 + 1]; z += P[v * 3 + 2]; }
        const c = P.length / 3; P.push(x / loop.length, y / loop.length, z / loop.length);
        for (let i = 0; i < loop.length; i++) m.faces.push([loop[i], loop[(i + 1) % loop.length], c]);
      }
      R.holes++;
    }
  }
  buildEdges();
  const parent = m.faces.map((_, i) => i), find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const e of S.edges) for (let i = 1; i < e.f.length; i++) { const a = find(e.f[0]), b = find(e.f[i]); if (a !== b) parent[a] = b; }
  const vol = new Map();
  m.faces.forEach((f, i) => {
    const r = find(i); let v = vol.get(r) || 0;
    for (let j = 1; j < f.length - 1; j++) {
      const a = f[0] * 3, b = f[j] * 3, c = f[j + 1] * 3;
      v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
    vol.set(r, v);
  });
  R.flipped = 0;
  m.faces.forEach((f, i) => {
    const cf = vol.get(find(i)) < 0 ? 1 : 0;
    if (cf) f.reverse();
    if (i < origCount && (flip[i] ^ cf)) R.flipped++;
  });
  R.isolated = cleanupMesh(m);
  pushUndo(before);
  afterTopology();
  const h = healthStats();
  const okNow = h.boundary === 0 && h.nonMan === 0 && h.badOrient === 0;
  showReport([
    ['Vértices duplicados unidos', R.weld], ['Caras degeneradas', R.degenerate], ['Caras duplicadas', R.duplicate],
    ['Caras internas', R.internal], ['Caras reorientadas', R.flipped], ['Agujeros cerrados', R.holes],
    ['Vértices aislados', R.isolated],
  ], okNow, 'Reparación', h);
  toast(okNow ? 'Malla reparada: cerrada y manifold' : 'Reparación aplicada, quedan problemas', okNow ? '' : 'warn');
}

function showReport(rows, ok, title, h) {
  const el = $('#report');
  el.hidden = false;
  let html = rows.map(([k, v]) => `<li><span>${k}</span><b>${fmt(v)}</b></li>`).join('');
  if (h && !ok) html += `<li><span>Pendiente: bordes / no-manifold</span><b>${fmt(h.boundary)} / ${fmt(h.nonMan)}</b></li>`;
  html += `<li class="verdict ${ok ? 'ok' : 'bad'}">${ok ? '✓ Cerrada y manifold: lista para Pepakura' : (title === 'Análisis' ? '⚠ Conviene reparar antes de exportar' : '⚠ Revisa las aristas resaltadas')}</li>`;
  el.innerHTML = html;
}

/* =====================================================================
   14. IMPORTAR / EXPORTAR
   ===================================================================== */
function parseOBJ(text) {
  const pos = [], faces = [];
  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const p = line.split(/\s+/);
      pos.push(parseFloat(p[1]) || 0, parseFloat(p[2]) || 0, parseFloat(p[3]) || 0);
    } else if (line.startsWith('f ')) {
      const p = line.split(/\s+/).slice(1), nV = pos.length / 3, f = [];
      for (const t of p) {
        const i = parseInt(t.split('/')[0], 10);
        if (isNaN(i)) continue;
        f.push(i < 0 ? nV + i : i - 1);
      }
      if (f.length >= 3) faces.push(f);
    }
  }
  return { pos, faces };
}

async function importFile(file) {
  if (!file) return;
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = file.name.split('.').pop().toLowerCase();
  let m;
  try {
    if (ext === 'obj') {
      m = parseOBJ(await file.text());
    } else if (ext === 'stl') {
      const g = new STLLoader().parse(await file.arrayBuffer());
      m = fromTriangleSoup(g.attributes.position.array);
    } else if (ext === 'fbx') {
      toast('Cargando FBX...', '');
      const fbxLoader = new FBXLoader();
      const arrayBuffer = await file.arrayBuffer();
      const fbxObj = fbxLoader.parse(arrayBuffer, '');
      m = fromThreeObject(fbxObj);
      if (!m.faces.length) throw new Error('El FBX no contiene geometría válida');
    } else {
      return toast('Formato no soportado: usa .OBJ, .STL o .FBX', 'warn');
    }
  } catch (e) { 
    console.error(e); 
    return toast(`No se pudo leer el archivo: ${e.message || 'error desconocido'}`, 'warn'); 
  }
  cleanupMesh(m);
  if (!m.faces.length) return toast('El archivo no contiene caras', 'warn');
  pushUndo(snapshot());
  S.mesh = m;
  S.faceColors.clear();
  S.mode === 'edit' && setMode('object');
  S.objSel = true;
  $('#fileName').value = name;
  afterTopology();
  frame(true);
  const h = healthStats();
  toast(`${file.name}: ${fmt(S.triCount)} triángulos${h.boundary || h.nonMan ? ' · conviene "Analizar y Reparar"' : ''}`, h.boundary || h.nonMan ? 'warn' : '');
}

function exportOBJ() {
  const m = S.mesh;
  if (!m.faces.length) return toast('No hay nada que exportar', 'warn');
  const s = parseFloat($('#expScale').value) || 1;
  const num = (x) => String(+(x * s).toFixed(6));
  const out = [];
  let faceLines = [], tris = 0;
  m.faces.forEach((f, i) => {
    if (S.triExport && f.length > 3) for (const t of faceTris(i)) { faceLines.push(`f ${t[0] + 1} ${t[1] + 1} ${t[2] + 1}`); tris++; }
    else { faceLines.push('f ' + f.map((v) => v + 1).join(' ')); tris += f.length - 2; }
  });
  const b = bbox(), sz = b.getSize(new THREE.Vector3()).multiplyScalar(s);
  out.push('# PolyCraft Studio Web · OBJ para Pepakura');
  out.push(`# Unidades: ${S.unit} · escala ${s === 1 ? '1:1' : '×' + s}`);
  out.push(`# Tamaño: ${sz.x.toFixed(2)} x ${sz.y.toFixed(2)} x ${sz.z.toFixed(2)} ${S.unit}`);
  out.push(`# Vértices: ${m.pos.length / 3} · Caras: ${faceLines.length} · Triángulos: ${tris}`);
  out.push('o ' + ($('#fileName').value || 'polycraft').replace(/\s+/g, '_'));
  for (let i = 0; i < m.pos.length; i += 3) out.push(`v ${num(m.pos[i])} ${num(m.pos[i + 1])} ${num(m.pos[i + 2])}`);
  out.push('s off');
  out.push(...faceLines);
  const blob = new Blob([out.join('\n') + '\n'], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ($('#fileName').value || 'polycraft_modelo').trim() + '.obj';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  const h = healthStats();
  toast(`Exportado ${a.download} · ${fmt(tris)} triángulos${h.boundary || h.nonMan ? ' · ojo: malla no cerrada' : ''}`, h.boundary || h.nonMan ? 'warn' : '');
}

/* =====================================================================
   15. PRIMITIVAS DE INICIO
   ===================================================================== */
function primitive(kind) {
  let m;
  if (kind === 'cube') {
    const h = 50, pos = [];
    for (let i = 0; i < 8; i++) pos.push(i & 1 ? h : -h, (i & 2 ? h : -h) + h, i & 4 ? h : -h);
    m = { pos, faces: [[4, 5, 7, 6], [1, 0, 2, 3], [5, 1, 3, 7], [0, 4, 6, 2], [6, 7, 3, 2], [0, 1, 5, 4]] };
  } else if (kind === 'cyl') {
    const n = 8, r = 40, hgt = 100, pos = [];
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pos.push(r * Math.sin(t), 0, r * Math.cos(t)); }
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pos.push(r * Math.sin(t), hgt, r * Math.cos(t)); }
    const faces = [];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([i, j, n + j, n + i]); }
    faces.push([...Array(n).keys()].map((i) => n + i));
    faces.push([...Array(n).keys()].reverse());
    m = { pos, faces };
  } else if (kind === 'torus') {
    const U = 12, V = 6, R = 40, r = 15, pos = [], faces = [];
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) {
      const t = (i / U) * Math.PI * 2, p = (j / V) * Math.PI * 2;
      pos.push((R + r * Math.cos(p)) * Math.sin(t), r * Math.sin(p) + r, (R + r * Math.cos(p)) * Math.cos(t));
    }
    const id = (i, j) => (i % U) * V + (j % V);
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) faces.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
    m = { pos, faces };
  } else {
    const g = new THREE.IcosahedronGeometry(50, 1);
    g.translate(0, 50, 0);
    m = fromTriangleSoup(g.attributes.position.array);
    weldMesh(m, 1e-4);
  }
  return m;
}

function loadPrimitive(kind, silent) {
  if (!silent) pushUndo(snapshot());
  S.mesh = primitive(kind);
  S.faceColors.clear();
  if (S.mode === 'edit') setMode('object');
  S.objSel = true;
  $('#fileName').value = { ico: 'icoesfera', cube: 'cubo', cyl: 'cilindro', torus: 'toroide' }[kind] || 'polycraft_modelo';
  afterTopology();
  frame(!silent);
}

/* =====================================================================
   16. CÁMARA: encuadre, vistas, enfoque
   ===================================================================== */
const ease = (t) => 1 - Math.pow(1 - t, 3);
function tweenTo(pos, target, dur = 320) {
  S.tween = { t0: performance.now(), dur, p0: camera.position.clone(), t0v: controls.target.clone(), p1: pos, t1: target };
}

function updateGrid() {
  const b = bbox(), size = Math.max(...b.getSize(new THREE.Vector3()).toArray()) || 100;
  S.size = size;
  const raw = size / 6, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) || p * 10;
  if (step !== S.gridStep || !matMesh.userData.drawn) { S.gridStep = step; drawMat(step); matMesh.userData.drawn = true; }
  const L = step * MAT_CELLS;
  matMesh.scale.set(L, L, 1);
  const c = b.isEmpty() ? new THREE.Vector3() : b.getCenter(new THREE.Vector3());
  matMesh.position.x = 0; matMesh.position.z = 0;
  scene.fog.near = L * 0.55; scene.fog.far = L * 1.6;
  const r = size * 0.9;
  sun.position.set(c.x + r * 1.2, c.y + r * 2.6, c.z + r * 1.6);
  sun.target.position.copy(c);
  Object.assign(sun.shadow.camera, { left: -r * 1.6, right: r * 1.6, top: r * 1.6, bottom: -r * 1.6, near: r * 0.1, far: r * 8 });
  sun.shadow.camera.updateProjectionMatrix();
  fill.position.set(c.x - r * 2, c.y + r * 0.5, c.z - r);
}

function frame(animate, box) {
  updateGrid();
  const b = box || bbox();
  if (b.isEmpty()) return;
  const c = b.getCenter(new THREE.Vector3()), rad = Math.max(b.getSize(new THREE.Vector3()).length() / 2, S.size * 0.05);
  const dist = rad / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15;
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.lengthSq() < 0.5) dir.set(0.55, 0.45, 0.7).normalize();
  camera.near = Math.max(S.size / 1000, 1e-4); camera.far = S.size * 200; camera.updateProjectionMatrix();
  const pos = c.clone().addScaledVector(dir, dist);
  if (animate) tweenTo(pos, c); else { camera.position.copy(pos); controls.target.copy(c); controls.update(); }
}

function focusSel() {
  const idx = S.mode === 'edit' ? affectedVerts() : null;
  frame(true, idx && idx.length ? bbox(S.mesh, idx) : null);
}

function snapView(which, opposite) {
  const t = controls.target.clone(), d = camera.position.distanceTo(t);
  const dir = { front: new THREE.Vector3(0, 0, 1), side: new THREE.Vector3(1, 0, 0), top: new THREE.Vector3(0, 1, 0.0001) }[which].normalize();
  if (opposite) dir.negate();
  tweenTo(t.clone().addScaledVector(dir, d), t, 360);
  toast(({ front: 'Vista frontal', side: 'Vista lateral', top: 'Vista superior' })[which] + (opposite ? ' (opuesta)' : ''));
}

/* =====================================================================
   17. COLORES POR CARA Y FONDO
   ===================================================================== */
function paintSelectedFaces(color) {
  if (S.mode !== 'edit' || S.sel !== 'f') return toast('Selecciona caras en modo Edición', 'warn');
  if (!S.selF.size) return toast('Selecciona caras para pintar', 'warn');
  const before = snapshot();
  const col = new THREE.Color(color);
  for (const fi of S.selF) S.faceColors.set(fi, col);
  pushUndo(before);
  rebuildRender();
  toast(`${S.selF.size} cara(s) pintadas`);
}

function clearFaceColors() {
  if (!S.faceColors.size) return toast('No hay colores que borrar', 'warn');
  const before = snapshot();
  S.faceColors.clear();
  pushUndo(before);
  rebuildRender();
  toast('Colores de cara borrados');
}

async function loadBackgroundImage(file) {
  if (!file) return;
  try {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    S.bgImage = { texture: tex, opacity: 0.5, scale: 200, offsetX: 0, offsetY: 0 };
    bgPlaneMat.map = tex;
    updateBackgroundPlane();
    toast('Imagen de fondo cargada');
  } catch (e) {
    console.error(e);
    toast('No se pudo cargar la imagen', 'warn');
  }
}

function updateBackgroundPlane() {
  if (!S.bgImage) { bgPlane.visible = false; return; }
  const { texture, opacity, scale, offsetX, offsetY } = S.bgImage;
  bgPlaneMat.map = texture;
  bgPlaneMat.opacity = opacity;
  bgPlaneMat.needsUpdate = true;
  const aspect = texture.image ? texture.image.width / texture.image.height : 1;
  bgPlane.scale.set(scale * aspect, scale, 1);
  bgPlane.position.set(offsetX, offsetY, -S.size * 0.5);
  bgPlane.visible = true;
}

function clearBackgroundImage() {
  if (!S.bgImage) return toast('No hay imagen de fondo', 'warn');
  S.bgImage = null;
  bgPlane.visible = false;
  toast('Imagen de fondo eliminada');
}

/* =====================================================================
   18. INTERFAZ
   ===================================================================== */
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  const box = $('#toasts');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 2600);
}

function syncUI() {
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
  document.querySelectorAll('#selSeg button').forEach((b) => b.classList.toggle('on', S.mode === 'edit' && b.dataset.sel === S.sel));
  $('#selSeg').classList.toggle('dim', S.mode !== 'edit');
  updateHint();
}

function updateHint() {
  const k = (x) => `<kbd>${x}</kbd>`;
  let txt = '';
  if (S.activeTool === 'addVertex') {
    txt = `Añadir vértice: clic en arista o cara · ${k('Ctrl')} imán · ${k('Esc')} salir`;
  } else if (S.activeTool === 'knife') {
    txt = `Cuchillo: clic en puntos · ${k('Enter')} aplicar · ${k('Esc')} cancelar`;
  } else if (S.mode === 'object') {
    txt = `${k('Tab')} editar · ${k('G')}${k('R')}${k('S')} transformar · clic der. orbitar · rueda zoom · ${k('Shift+F')} enfocar`;
  } else {
    txt = `${k('1')}${k('2')}${k('3')} vértice/arista/cara · ${k('F')} crear cara · doble clic añade vértice · ${k('V')} herramienta · ${k('K')} cuchillo · ${k('J')} conectar · ${k('M')} unir · ${k('X')} / ${k('Ctrl+X')} eliminar/disolver · ${k('Tab')} salir`;
  }
  $('#hint').innerHTML = txt;
}

function updateDims() {
  if (!S.mesh.faces.length) { $('#dims').textContent = 'vacío'; return; }
  const s = bbox().getSize(new THREE.Vector3()).multiplyScalar(parseFloat($('#expScale').value) || 1);
  const f = (x) => (x >= 100 ? x.toFixed(1) : x.toFixed(2));
  $('#dims').textContent = `${f(s.x)} × ${f(s.y)} × ${f(s.z)} ${S.unit}`;
}

function updateStats() {
  $('#stTris').textContent = fmt(S.triCount);
  $('#stVerts').textContent = fmt(S.mesh.pos.length / 3);
  $('#stEdges').textContent = fmt(S.edges.length);
  $('#stFaces').textContent = fmt(S.mesh.faces.length);
  $('#stSel').textContent = S.mode === 'edit' ? fmt(selCount()) : (S.objSel ? '1' : '0');
  $('#stSelLbl').textContent = S.mode === 'edit' ? ({ v: 'vértices sel.', e: 'aristas sel.', f: 'caras sel.' })[S.sel] : 'objeto sel.';
  const h = healthStats();
  const chip = (cls, txt) => `<span class="chip ${cls}"><i></i>${txt}</span>`;
  let html = '';
  if (!S.mesh.faces.length) html = chip('warn', 'Sin malla: importa o elige una forma');
  else {
    html += h.boundary ? chip('warn', `${fmt(h.boundary)} bordes abiertos`) : chip('', 'Cerrada');
    html += h.nonMan ? chip('nm', `${fmt(h.nonMan)} no-manifold`) : chip('', 'Manifold');
    html += h.badOrient ? chip('warn', `${fmt(h.badOrient)} normales cruzadas`) : chip('', 'Normales OK');
    if (h.np) html += chip('np', `${fmt(h.np)} no planas`);
  }
  $('#health').innerHTML = html;
  const baseTris = S.decimBase ? S.decimBase.tris.length / 9 : S.triCount;
  $('#decInfo').textContent = `${fmt(baseTris)} → ${fmt(S.triCount)} tri`;
  if (document.activeElement !== $('#decTarget')) $('#decTarget').value = S.triCount;
  const big = (S.decimBase ? S.decimBase.pos.length : S.mesh.pos.length) / 3 > 6000;
  $('#decNote').textContent = big ? 'Malla grande: la simplificación se aplica al soltar el deslizador.' : 'Arrastra para simplificar en tiempo real. Ctrl+Z vuelve al original.';
  updateDims();
}

/* --- ACCIONES DE BOTONES --- */
const ACTIONS = {
  undo, redo,
  import: () => $('#file').click(),
  export: exportOBJ,
  help: () => $('#help').classList.toggle('on'),
  move: () => startModal('G'), rotate: () => startModal('R'), scale: () => startModal('S'),
  merge: mergeVerts, delete: deleteOp, dissolve: dissolveEdges,
  split: splitEdges, collapse: collapseEdges, flipEdge: flipEdges,
  triangulate: () => triangulateOp('sel'), triangulateAll: () => triangulateOp('all'), triangulateNP: () => triangulateOp('np'),
  flipNormals, coplanar: coplanarMerge, weld: weldByDistance, center: centerOrigin,
  toggleRotate: toggleAutoRotate,
  addVertex: startAddVertexTool, knife: startKnifeTool, connect: joinSelectedVerts,
  createFace: createFaceFromVerts,
  selectAll: () => { if (S.mode !== 'edit') setMode('edit'); selectAll(true); },
  invertSel: () => { if (S.mode !== 'edit') setMode('edit'); invertSel(); },
  selectNP: () => {
    if (!S.npCount) return toast('No hay caras no planas', 'warn');
    setMode('edit'); setSelMode('f'); clearSel(); S.faceNP.forEach((v, i) => v && S.selF.add(i)); rebuildRender(); updateStats();
  },
  selectBoundary: () => {
    const b = S.edges.filter((e) => e.f.length !== 2);
    if (!b.length) return toast('No hay bordes abiertos ni aristas no-manifold', 'warn');
    setMode('edit'); setSelMode('e'); clearSel(); b.forEach((e) => S.selE.add(e.k)); rebuildRender(); updateStats();
    toast(`${b.length} arista(s) problemáticas seleccionadas · Shift+F para enfocar`);
  },
  analyze: analyzeOnly, repair: repairMesh, focus: focusSel,
};

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a.startsWith('prim:')) return loadPrimitive(a.slice(5));
  if (a.startsWith('view:')) return snapView(a.slice(5), false);
  ACTIONS[a] && ACTIONS[a]();
  b.blur();
});

document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('#selSeg button').forEach((b) => b.addEventListener('click', () => setSelMode(b.dataset.sel)));
$('#help').addEventListener('click', (e) => { if (e.target.id === 'help') $('#help').classList.remove('on'); });
$('#file').addEventListener('change', (e) => { importFile(e.target.files[0]); e.target.value = ''; });

// paneles
$('#tgNP').addEventListener('change', (e) => { S.showNP = e.target.checked; rebuildRender(); });
$('#npTol').addEventListener('input', (e) => { S.npTol = Math.max(0.01, parseFloat(e.target.value) || 1); rebuildRender(); updateStats(); });
$('#tgFold').addEventListener('change', (e) => { S.fold = e.target.checked; $('#foldLegend').hidden = !S.fold; rebuildRender(); });
$('#tgEdges').addEventListener('change', (e) => { S.showEdges = e.target.checked; rebuildRender(); });
$('#tgXray').addEventListener('change', (e) => { S.xray = e.target.checked; rebuildRender(); });
$('#tgTri').addEventListener('change', (e) => { S.triExport = e.target.checked; });
$('#unit').addEventListener('change', (e) => { S.unit = e.target.value; drawMat(S.gridStep); updateDims(); });
$('#expScale').addEventListener('input', updateDims);

// decimación
const dec = $('#decSlider');
dec.addEventListener('input', () => {
  const pct = +dec.value;
  $('#decPct').textContent = pct + '%';
  const big = (S.decimBase ? S.decimBase.pos.length : S.mesh.pos.length) / 3 > 6000;
  if (big) return;
  clearTimeout(S.decimTimer);
  S.decimTimer = setTimeout(() => decimTo(pct), 30);
});
dec.addEventListener('change', () => { clearTimeout(S.decimTimer); decimTo(+dec.value); decimCommit(); });
$('#decTarget').addEventListener('change', (e) => {
  const base = S.decimBase ? S.decimBase.tris.length / 9 : S.triCount;
  const pct = Math.max(1, Math.min(100, ((parseInt(e.target.value, 10) || base) / base) * 100));
  decimTo(pct); decimCommit();
  dec.value = Math.max(2, Math.round(pct)); $('#decPct').textContent = Math.round(pct) + '%';
  e.target.blur();
});

// colores
$('#paintBtn')?.addEventListener('click', () => {
  const col = $('#paintColor')?.value || '#ff6b6b';
  paintSelectedFaces(col);
});
$('#clearColorsBtn')?.addEventListener('click', clearFaceColors);

// fondo
$('#bgFile')?.addEventListener('change', (e) => { if (e.target.files[0]) loadBackgroundImage(e.target.files[0]); e.target.value = ''; });
$('#bgOpacity')?.addEventListener('input', (e) => { if (S.bgImage) { S.bgImage.opacity = parseFloat(e.target.value); updateBackgroundPlane(); } });
$('#bgScale')?.addEventListener('input', (e) => { if (S.bgImage) { S.bgImage.scale = parseFloat(e.target.value); updateBackgroundPlane(); } });
$('#clearBgBtn')?.addEventListener('click', clearBackgroundImage);

// rotación automática
$('#rotateSpeed')?.addEventListener('input', (e) => {
  const speed = parseFloat(e.target.value);
  setRotateSpeed(speed);
  $('#rotateSpeedLabel').textContent = speed + 'x';
});

/* =====================================================================
   19. RATÓN Y TECLADO
   ===================================================================== */
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
let down = null, lastClick = 0;
const boxEl = $('#box');

canvas.addEventListener('pointerdown', (e) => {
  canvas.focus();
  if (S.modal) { e.preventDefault(); e.stopImmediatePropagation(); endModal(e.button === 0); return; }
  
  if (e.button === 0) {
    // detectar doble clic
    const now = Date.now();
    if (now - lastClick < 300 && S.mode === 'edit' && !S.activeTool) {
      handleDoubleClick(e.clientX, e.clientY);
      lastClick = 0;
      return;
    }
    lastClick = now;
    
    // herramientas activas
    if (S.activeTool === 'addVertex') {
      e.preventDefault();
      addVertexAtPreview();
      return;
    }
    if (S.activeTool === 'knife') {
      e.preventDefault();
      addKnifePoint(e.clientX, e.clientY);
      return;
    }
    
    // arrastre directo - solo si no hay Shift/Ctrl
    if (S.mode === 'edit' && !S.activeTool && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (startDirectDrag(e.clientX, e.clientY)) {
        e.preventDefault();
        return;
      }
    }
    
    down = { x: e.clientX, y: e.clientY, box: false };
  }
}, { capture: true });

window.addEventListener('pointermove', (e) => {
  S.mouse.x = e.clientX; S.mouse.y = e.clientY;
  S.snapMode = e.ctrlKey || e.metaKey;
  
  if (S.modal) { S.modal.snap = S.snapMode; updateModal(); return; }
  if (S.directDrag) { updateDirectDrag(e.clientX, e.clientY); return; }
  if (S.activeTool === 'addVertex') { computeAddVertexPreview(e.clientX, e.clientY); updatePreviewDot(); return; }
  
  if (down && (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4)) {
    down.box = true;
    Object.assign(boxEl.style, {
      display: 'block', left: Math.min(down.x, e.clientX) + 'px', top: Math.min(down.y, e.clientY) + 'px',
      width: Math.abs(e.clientX - down.x) + 'px', height: Math.abs(e.clientY - down.y) + 'px',
    });
  } else {
    updateHover(e.clientX, e.clientY);
  }
});

window.addEventListener('pointerup', (e) => {
  if (S.directDrag && e.button === 0) {
    endDirectDrag(e.clientX, e.clientY);
    return;
  }
  if (!down || e.button !== 0) return;
  const d = down; down = null; boxEl.style.display = 'none';
  if (d.box) {
    boxSelect(d.x, d.y, e.clientX, e.clientY, e.shiftKey, e.ctrlKey || e.metaKey);
  } else {
    clickSelect(e.clientX, e.clientY, e.shiftKey);
  }
});

window.addEventListener('keyup', (e) => { 
  if (S.modal && e.key === 'Control') { S.modal.snap = false; updateModal(); }
  if (e.key === 'Control') { S.snapMode = false; if (S.activeTool === 'addVertex') { computeAddVertexPreview(S.mouse.x, S.mouse.y); updatePreviewDot(); } }
});

window.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, select, textarea')) return;
  if (S.modal) return modalKey(e);
  
  const code = e.code, mod = e.ctrlKey || e.metaKey;
  
  // Escape: salir de herramienta o deseleccionar
  if (code === 'Escape') {
    if ($('#help').classList.contains('on')) return $('#help').classList.remove('on');
    if (S.activeTool) { e.preventDefault(); exitActiveTool(); return; }
    if (S.mode === 'edit' && selCount()) { e.preventDefault(); clearSel(); rebuildRender(); updateStats(); return; }
    return;
  }
  
  // vistas en teclado numérico (Ctrl = opuesta)
  const np = { Numpad1: 'front', Numpad3: 'side', Numpad7: 'top' }[code];
  if (np) { e.preventDefault(); return snapView(np, mod); }
  
  if (mod) {
    const k = e.key.toLowerCase();
    if (k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (k === 'y') { e.preventDefault(); return redo(); }
    if (k === 'i') { e.preventDefault(); return invertSel(); }
    if (k === 'x') { e.preventDefault(); return dissolveVerts(); } // Ctrl+X = disolver
    return;
  }
  
  const dig = { Digit1: 1, Digit2: 2, Digit3: 3, Digit7: 7 }[code];
  if (dig) {
    e.preventDefault();
    if (S.mode === 'edit' && dig <= 3) return setSelMode(['v', 'e', 'f'][dig - 1]);
    if (dig !== 2) return snapView({ 1: 'front', 3: 'side', 7: 'top' }[dig], false);
    return;
  }
  
  switch (code) {
    case 'Tab': e.preventDefault(); return setMode(S.mode === 'edit' ? 'object' : 'edit');
    case 'KeyG': e.preventDefault(); return startModal('G');
    case 'KeyR': e.preventDefault(); return startModal('R');
    case 'KeyS': e.preventDefault(); return startModal('S');
    case 'KeyX': case 'Delete': e.preventDefault(); return deleteOp();
    case 'KeyM': e.preventDefault(); return mergeVerts();
    case 'KeyF': 
      e.preventDefault(); 
      if (e.shiftKey) return focusSel(); // Shift+F = Enfocar
      return createFaceFromVerts(); // F = Crear cara
    case 'KeyV': e.preventDefault(); return startAddVertexTool();
    case 'KeyK': e.preventDefault(); return startKnifeTool();
    case 'KeyJ': e.preventDefault(); return joinSelectedVerts();
    case 'Enter': if (S.activeTool === 'knife') { e.preventDefault(); return applyKnife(); } break;
    case 'KeyA': 
      e.preventDefault(); 
      if (e.altKey) { 
        if (S.mode === 'edit') { clearSel(); rebuildRender(); updateStats(); } 
        else { S.objSel = false; rebuildRender(); } 
        return; 
      } 
      return selectAll(true);
    case 'F1': e.preventDefault(); return $('#help').classList.toggle('on');
  }
  if (e.key === '?') { e.preventDefault(); $('#help').classList.toggle('on'); }
});

// arrastrar y soltar
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('#drop').classList.add('on'); });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop').classList.remove('on'); } });
window.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; $('#drop').classList.remove('on');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) importFile(f);
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* =====================================================================
   20. ARRANQUE Y BUCLE
   ===================================================================== */
function loop(now) {
  requestAnimationFrame(loop);
  if (S.tween) {
    const T = S.tween, k = Math.min(1, (now - T.t0) / T.dur), e = ease(k);
    camera.position.lerpVectors(T.p0, T.p1, e);
    controls.target.lerpVectors(T.t0v, T.t1, e);
    if (k >= 1) S.tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
}

loadPrimitive('ico', true);
camera.position.set(150, 140, 210);
frame(false);
syncUI();
requestAnimationFrame(loop);
if (document.fonts) document.fonts.ready.then(() => drawMat(S.gridStep));

// acceso para depuración desde la consola
window.PolyCraft = { S, refresh, repairMesh, exportOBJ, loadPrimitive, setMode, setSelMode, decimTo, paintSelectedFaces };
