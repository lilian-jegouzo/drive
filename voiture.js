/* DRIVE · la voiture en 3D, pilotée par le défilement.
   Un grand SUV sans marque (modèle 3D libre de droits, logos retirés, habitacle noir).
   La caméra suit un trajet : extérieur, entrée par la vitre conducteur, siège conducteur,
   siège arrière gauche (intervieweur), siège arrière droit (invité). */
import * as THREE from 'three';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';
import {MeshoptDecoder} from './assets/vendor/meshopt_decoder.module.js';
import {EXRLoader} from './assets/vendor/EXRLoader.js';
import {Reflector} from './assets/vendor/Reflector.js';

const conteneur = document.getElementById('voiture3d');
const trajet = document.getElementById('trajet');
const etapes = [...document.querySelectorAll('.etape')];
const fiches = [...document.querySelectorAll('.fiche')];
const jauge = document.querySelector('.jauge span');
const params = new URLSearchParams(location.search);

/* ---------- Moteur ---------- */
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:params.has('capture')}); }
catch (e) { document.body.classList.add('sans-3d'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
conteneur.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ffffff');

// Studio photo pour les reflets : grand plafond lumineux, murs clairs, sol sombre, bandeaux fins.
// Sur une carrosserie noire, cela dessine la ligne d'horizon claire / sombre des photos de voitures.
const env = new THREE.Scene(); env.background = new THREE.Color('#101012');
const lm = k => new THREE.MeshBasicMaterial({color:new THREE.Color(1,1,1).multiplyScalar(k), side:THREE.DoubleSide});
const panneau = (w,h,k,pos) => {const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),lm(k));m.position.set(...pos);m.lookAt(0,pos[1] > 5 ? 0 : pos[1],0);env.add(m);};
panneau(14,10,2.2,[0,7,0]);
panneau(22,4,1.1,[0,3.2,9]); panneau(22,4,1.1,[0,3.2,-9]); panneau(22,4,.9,[-9,3.2,0]); panneau(22,4,.9,[9,3.2,0]);
panneau(22,.25,5,[0,1.25,8.9]); panneau(22,.25,5,[0,1.25,-8.9]); panneau(22,.18,4,[-8.9,1.6,0]); panneau(22,.18,4,[8.9,1.6,0]);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(env, .02).texture;
// Puis un vrai studio photo (HDRI Poly Haven, domaine public) dès qu'il est chargé
new EXRLoader().load(window.DRIVE_HDRI || 'assets/hdri/studio.exr', t => {
  t.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(t).texture; t.dispose();
  scene.environmentIntensity = 1;
});

const camera = new THREE.PerspectiveCamera(36, 1, .03, 100);

// Lumières
const ciel = new THREE.HemisphereLight(0xffffff, 0xd8d8d8, .9); scene.add(ciel);
const soleil = new THREE.DirectionalLight(0xffffff, 2.4); soleil.position.set(-3, 8, 4);
soleil.castShadow = true; soleil.shadow.mapSize.set(2048, 2048); soleil.shadow.radius = 8; soleil.shadow.bias = -.0004;
Object.assign(soleil.shadow.camera, {left:-6, right:6, top:6, bottom:-6, near:1, far:24}); scene.add(soleil);
const habitacle = new THREE.PointLight(0xfff4e8, 2.2, 3.2, 2); habitacle.position.set(.3, 1.62, 0); scene.add(habitacle);
const projecteur = new THREE.SpotLight(0xffffff, 0, 3.5, .55, .6, 1.5); scene.add(projecteur); scene.add(projecteur.target);

// Sol de studio brillant : un miroir voilé de blanc, puis les ombres douces par-dessus
const miroir = new Reflector(new THREE.CircleGeometry(18, 64), {textureWidth:1024, textureHeight:1024, color:0x9a9a9a, clipBias:.003});
miroir.rotation.x = -Math.PI/2; scene.add(miroir);
const voile = new THREE.Mesh(new THREE.CircleGeometry(19, 64), new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-8, // pas de scintillement avec le miroir au loin
  vertexShader:'varying vec2 v; void main(){ v = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader:'varying vec2 v; void main(){ float d = length(v * vec2(.55, 1.)); gl_FragColor = vec4(1., 1., 1., mix(.86, 1., smoothstep(1.8, 5., d))); }'
}));
voile.rotation.x = -Math.PI/2; voile.position.y = .001; scene.add(voile);
const sol = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({opacity:.28, polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-16}));
sol.rotation.x = -Math.PI/2; sol.position.y = .002; sol.receiveShadow = true; scene.add(sol);

/* ---------- La voiture : modèle 3D (sans logos, plaques DRIVE, intérieur noir) ---------- */
const P = o => new THREE.MeshPhysicalMaterial(o);
const peinture = P({color:'#0b0b0d', metalness:.6, roughness:.32, clearcoat:1, clearcoatRoughness:.03});
const vitre = P({color:'#0b0c0e', metalness:.1, roughness:.02, clearcoat:1, clearcoatRoughness:.02, transparent:true, opacity:.86, side:THREE.DoubleSide, depthWrite:false});
// Matières « de près » : un seul correctif de shader qui ajoute
//  - les ombres de contact cuites dans les couleurs de sommets (elles assombrissent aussi les reflets,
//    sinon les joints de portes et les plis des sièges brilleraient comme des surfaces exposées) ;
//  - un relief fin calculé à la volée : grain du cuir dans l'habitacle, paillettes sous le vernis de la peinture.
//    Le relief s'efface de lui-même quand il devient plus petit qu'un pixel (pas de scintillement).
const GLSL_BRUIT = `
varying vec3 vPosM;
float h3(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bruit(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 relief(vec3 n, float h, float k){ vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition); float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(dy, n), r2 = cross(n, dx); float det = dot(dx, r1); vec3 g = sign(det) * (hx * r1 + hy * r2) * k;
  return normalize(abs(det) * n - g); }
`;
function matiere(m, {ao = true, grain = 0, freq = 160, paillettes = 0} = {}){
  if (ao) m.vertexColors = true;
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec3 vPosM;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vPosM = (modelMatrix * vec4(transformed, 1.)).xyz;');
    let f = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_BRUIT);
    f = f.replace('#include <roughnessmap_fragment>', `
      vec3 qD = vPosM * ${freq.toFixed(1)};
      float hD = .65 * bruit(qD) + .35 * bruit(qD * 2.37 + 7.1); hD = hD * hD;
      float pxD = length(fwidth(qD)); float kD = 1. - smoothstep(.25, .7, pxD);
      #include <roughnessmap_fragment>
      ${grain ? 'roughnessFactor = clamp(roughnessFactor * mix(1.12, .86, hD * kD), .04, 1.);' : ''}`);
    if (grain) f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      normal = relief(normal, hD, ${grain.toFixed(4)} * kD * (1. - metalnessFactor));`);
    if (paillettes) f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 c = floor(vPosM * 2600.); vec3 r = vec3(h3(c), h3(c + 31.7), h3(c + 77.3)) - .5;
        float kP = 1. - smoothstep(.2, .6, length(fwidth(vPosM * 2600.)));
        normal = normalize(normal + r * ${paillettes.toFixed(3)} * kP); }`);
    if (ao) f = f.replace('#include <aomap_fragment>', `#include <aomap_fragment>
      { float aoS = clamp(vColor.r, 0., 1.); reflectedLight.indirectDiffuse *= aoS; reflectedLight.indirectSpecular *= aoS * aoS;
      #if defined( USE_CLEARCOAT )
      clearcoatSpecularIndirect *= aoS * aoS;
      #endif
      }`);
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => `detail-${ao}-${grain}-${freq}-${paillettes}`;
  return m;
}
matiere(peinture, {ao:false, paillettes:.35});

// Écrans de bord : l'écran central et le combiné d'instruments, dessinés aux couleurs de DRIVE.
// Les deux dalles sont plus larges que leur texture (2,7:1 pour 2:1) : on dessine dans un repère élargi.
function ecranTexture(type){
  const W = 1024, H = 512, LW = 1382, kx = W / LW;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.flipY = false;
  const police = (p, t) => `${p} ${t}px Archivo, "Helvetica Neue", Arial, sans-serif`;
  const jauge = (cx, cy, R, v, txt, unite, accent) => {
    g.strokeStyle = '#23272e'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    for (let i = 0; i <= 40; i++){ const a = Math.PI * (.75 + 1.5 * i / 40), l = i % 5 ? 16 : 34;
      g.strokeStyle = i % 5 ? '#555c66' : '#e8eaee'; g.lineWidth = i % 5 ? 3 : 6; g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); g.lineTo(cx + Math.cos(a) * (R - 10 - l), cy + Math.sin(a) * (R - 10 - l)); g.stroke(); }
    g.strokeStyle = accent; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, R - 4, Math.PI * .75, Math.PI * (.75 + 1.5 * v)); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = police('800', 128); g.fillText(txt, cx, cy + 40);
    g.font = police('500', 34); g.fillStyle = '#9aa0a8'; g.fillText(unite, cx, cy + 96); g.textAlign = 'left';
  };
  const titre = (x, y, t) => { g.save(); g.fillStyle = '#fff'; g.font = police('900', t); try { g.fontStretch = 'expanded'; } catch (e) {}
    g.transform(1, 0, -.22, 1, y * .22, 0); g.fillText('DRIVE', x, y); g.restore(); };
  const dessiner = () => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.setTransform(kx, 0, 0, 1, 0, 0);
    if (type === 'Ecran'){
      // carte : rues fines, itinéraire blanc
      const fond = g.createLinearGradient(0, 0, 0, H); fond.addColorStop(0, '#0d0f13'); fond.addColorStop(1, '#050608'); g.fillStyle = fond; g.fillRect(24, 24, 740, H - 48);
      g.save(); g.beginPath(); g.rect(24, 24, 740, H - 48); g.clip(); g.lineCap = 'round';
      let sd = 7; const r = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
      g.strokeStyle = '#1d2129'; for (let i = 0; i < 30; i++){ g.lineWidth = 3 + r() * 8; g.beginPath(); const x = r() * 760, y = r() * H; g.moveTo(x - 360, y - 220 * (r() - .5)); g.lineTo(x + 360, y + 220 * (r() - .5)); g.stroke(); }
      g.strokeStyle = '#fff'; g.lineWidth = 11; g.beginPath(); g.moveTo(110, H - 30); g.bezierCurveTo(230, 380, 220, 290, 400, 250); g.bezierCurveTo(560, 215, 520, 110, 690, 50); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(400, 250, 19, 0, 7); g.fill(); g.restore();
      // panneau droit : enregistrement du podcast
      titre(812, 120, 84);
      g.font = police('500', 32); g.fillStyle = '#9aa0a8'; g.fillText('Le podcast en voiture', 814, 170);
      g.fillStyle = '#e5322d'; g.beginPath(); g.arc(830, 238, 13, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = police('700', 36); g.fillText('REC  00:42:17', 858, 251);
      g.fillStyle = '#1d2129'; g.fillRect(814, 284, 520, 3);
      [['Conducteur', 'Lilian'], ['Interview', 'Raphaël'], ['Invité', 'Votre place']].forEach(([a, b], i) => {
        g.font = police('500', 30); g.fillStyle = '#7d838c'; g.fillText(a, 814, 342 + i * 62);
        g.font = police('700', 34); g.fillStyle = '#fff'; g.fillText(b, 1010, 342 + i * 62);
      });
    } else {
      // combiné : puissance à gauche, vitesse à droite, DRIVE au centre
      jauge(300, 262, 215, .18, '18', '% puissance', '#5fb3ff');
      jauge(1082, 262, 215, .32, '50', 'km/h', '#fff');
      titre(600, 230, 64);
      g.textAlign = 'center'; g.font = police('600', 30); g.fillStyle = '#9aa0a8'; g.fillText('REC 00:42:17', 691, 290); g.textAlign = 'left';
    }
    tex.needsUpdate = true;
  };
  dessiner(); document.fonts && document.fonts.load('900 64px Archivo').then(dessiner, () => {});
  return tex;
}

const voiture = new THREE.Group(); scene.add(voiture);
const places = {conducteur:{x:-.12, z:.36}, interview:{x:.72, z:.43}, invite:{x:.72, z:-.45}}; // centres des sièges (repère de la voiture)
const vitres = [];
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(window.DRIVE_GLB || 'assets/modeles/voiture.glb', gltf => {
  const m = gltf.scene;
  m.rotation.y = -Math.PI/2; // l'avant vers -x, le conducteur côté +z
  m.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nouv = mats.map(mt => {
      const n = mt.name || '';
      if (n.startsWith('bodypaint')) return peinture;
      if (n.startsWith('IntWindows') || n.startsWith('ExtWindowsGlass_0')){ vitres.push(o); o.castShadow = false; o.renderOrder = 3; return vitre; }
      if (n.startsWith('ExtWindowsGlass')){ mt.depthWrite = false; o.castShadow = false; o.renderOrder = 2; return mt; } // optiques
      if (n.startsWith('interiordfs_0') || n.startsWith('interiordfs_1')){ o.castShadow = false;
        const t = ecranTexture(n.startsWith('interiordfs_0') ? 'Ecran' : 'Compteurs'), src = mt.map || mt.emissiveMap || mt.normalMap;
        // l'image remplit exactement la dalle : on recale les coordonnées de texture (compressées, et parfois hors de 0-1)
        const uv = o.geometry.attributes.uv, R = src ? src.repeat : new THREE.Vector2(1, 1), O = src ? src.offset : new THREE.Vector2();
        let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (let i = 0; i < uv.count; i++){ const u = uv.getX(i) * R.x + O.x, v = uv.getY(i) * R.y + O.y; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
        t.repeat.set(R.x / (u1 - u0), R.y / (v1 - v0)); t.offset.set((O.x - u0) / (u1 - u0), (O.y - v0) / (v1 - v0));
        return new THREE.MeshPhysicalMaterial({color:'#000', emissive:'#fff', emissiveIntensity:.95, emissiveMap:t, roughness:.08, clearcoat:1, clearcoatRoughness:.03, envMapIntensity:.5}); }
      if (/^(interiordfs\.|plastic5_18|leather02_weave_32|leather02_weave_2\.)/.test(n)){ o.visible = false; return mt; } // vitre noire et pictos posés devant les écrans d'origine
      if (n.startsWith('Tire')){ mt.envMapIntensity = .6; }
      const cuir = /^(plastic5_2\.|plastic5_17|plastic5_12|ptn_leather|leather02_weave_(0|10|8|12|14|15|20)\.)/.test(n);
      if (o.geometry.attributes.color) matiere(mt); // ombres de contact de l'habitacle
      if (cuir){ mt.envMapIntensity = .55; }
      return mt;
    });
    o.material = Array.isArray(o.material) ? nouv : nouv[0];
  });
  voiture.add(m);
  // posée au sol, centrée entre les essieux
  m.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(m, true);
  m.position.y -= bb.min.y; m.position.x -= (bb.min.x + bb.max.x)/2; m.position.z -= (bb.min.z + bb.max.z)/2;
  window.__voiturePrete = true;
}, undefined, e => { console.error(e); document.body.classList.add('sans-3d'); });

/* ---------- Trajet de la caméra ---------- */
// Chaque étape : [début, fin] du palier, position de la caméra, point regardé.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const paliers = [
  {de:0,   a:.05, pos:V(-5.3, 1.6, 4.5),   vise:V(.1, .88, 0),    decale:1},  // extérieur, trois-quarts avant
  {de:.15, a:.2,  pos:V(6.0, 2.4, 6.9),    vise:V(.25, .88, 0),   decale:1.2},  // trois-quarts arrière
  {de:.29, a:.29, pos:V(-.05, 1.5, 2.1),   vise:V(-.05, 1.25, .2), decale:0},  // devant la vitre conducteur
  {de:.37, a:.48, pos:V(-.45, 1.6, -.15),  vise:V(.15, 1.05, .36), decale:0, siege:'conducteur'}, // depuis le pare-brise, comme la caméra du tournage
  {de:.525, a:.525, pos:V(-.05, 1.6, 0),   vise:V(.9, 1.0, 0),    decale:0},                     // entre les sièges avant
  {de:.58, a:.68, pos:V(.45, 1.62, -.35),  vise:V(.85, 1.05, .43),  decale:0, siege:'interview'},  // en diagonale, vers Raphaël
  {de:.79, a:1,   pos:V(.45, 1.62, .35),   vise:V(.85, 1.05, -.45), decale:0, siege:'invite'}       // en diagonale, vers la place de l'invité
];
const pos = new THREE.Vector3(), vise = new THREE.Vector3();
let decale = 1;
function cameraA(p){
  for (let i = 0; i < paliers.length; i++){
    const k = paliers[i];
    if (p <= k.a || i === paliers.length - 1){
      if (p >= k.de || i === 0){ pos.copy(k.pos); vise.copy(k.vise); decale = k.decale; return k; }
      const prev = paliers[i-1], t = lisse((p - prev.a) / (k.de - prev.a));
      pos.lerpVectors(prev.pos, k.pos, t); vise.lerpVectors(prev.vise, k.vise, t); decale = prev.decale + (k.decale - prev.decale)*t; return null;
    }
  }
}
// Vers l'extérieur, la caméra recule sur écran étroit pour garder la voiture entière
function recul(p){ const a = camera.aspect, k = a >= 1.75 ? 0 : .3 * (1.75 - Math.max(a, 1.2)) + .72 * Math.max(0, 1.2 - a); return 1 + k * (1 - lisse(Math.min(1, Math.max(0, (p - .2) / .09)))); }

/* ---------- Fiches posées sur les sièges ---------- */
const ancres = {conducteur:V(.15, 1.45, .36), interview:V(.95, 1.4, .43), invite:V(.95, 1.4, -.45)};
const tmp = new THREE.Vector3(), decalage = new THREE.Vector3();
function placerFiches(p){
  const W = conteneur.clientWidth, H = conteneur.clientHeight, mobile = W <= 820;
  for (const f of fiches){
    const vue = p >= +f.dataset.de && p < +f.dataset.a; f.classList.toggle('vue', vue);
    if (!vue || mobile) continue;
    tmp.copy(ancres[f.dataset.siege]).applyMatrix4(voiture.matrixWorld).project(camera);
    const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
    const fw = f.offsetWidth, fh = f.offsetHeight;
    let fx = Math.min(Math.max(16, x - 40), W - fw - 16);
    let fy = Math.min(Math.max(76, y - fh - 70), H - fh - 16);
    f.style.transform = `translate(${fx}px, ${fy}px)`;
    f.style.setProperty('--px', Math.min(Math.max(12, x - fx), fw - 12) + 'px');
    f.style.setProperty('--trait-h', Math.max(0, y - (fy + fh)) + 'px');
  }
}

/* ---------- Boucle ---------- */
function taille(){
  const W = conteneur.clientWidth, H = conteneur.clientHeight;
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}
addEventListener('resize', taille); taille();

const progresCible = () => {
  const r = trajet.getBoundingClientRect(), course = trajet.offsetHeight - innerHeight;
  return Math.min(1, Math.max(0, -r.top / course));
};
let p = progresCible();
const lumiere = new THREE.Vector3();
const lisse = t => t*t*(3 - 2*t);
renderer.setAnimationLoop(() => {
  const cible = progresCible();
  p += (cible - p) * (params.has('capture') ? 1 : .085);
  if (Math.abs(cible - p) < .0004) p = cible;
  const k = cameraA(p);
  if (params.has('cam')){ const c = params.get('cam').split(',').map(Number); pos.set(c[0], c[1], c[2]); vise.set(c[3], c[4], c[5]); decale = 0; }
  const f = recul(p);
  if (f !== 1) pos.sub(vise).multiplyScalar(f).add(vise);
  // Champ de vision : serré dehors, large dans l'habitacle
  const dedans = lisse(Math.min(1, Math.max(0, (p - .27) / .1)));
  const fov = (camera.aspect < 1 ? 50 : 36) + dedans * (camera.aspect < 1 ? 22 : 20);
  if (Math.abs(camera.fov - fov) > .01){ camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.position.copy(pos); camera.lookAt(vise);
  // À l'extérieur, la voiture se décale pour laisser la place au texte (à droite sur ordinateur, en bas sur téléphone)
  // (on déplace la caméra latéralement plutôt que de décaler la projection, pour garder le reflet du sol juste)
  if (decale > 0){
    const dir = tmp.subVectors(vise, pos), dist = dir.length(); dir.normalize();
    const demiH = dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const droite = decalage.crossVectors(dir, camera.up).normalize();
    if (camera.aspect >= 1) droite.multiplyScalar(-.34 * demiH * camera.aspect * decale);
    else droite.crossVectors(droite, dir).normalize().multiplyScalar(.3 * demiH * decale);
    camera.position.add(droite); vise.add(droite); camera.lookAt(vise);
  }
  // Les vitres s'effacent à l'approche pour laisser voir l'habitacle
  const fondu = lisse(Math.min(1, Math.max(0, (p - .2) / .1)));
  vitre.opacity = .86 - .8 * fondu;
  ciel.intensity = .9 - .55 * lisse(Math.min(1, Math.max(0, (p - .26) / .1)));
  // Mise en lumière du siège visé
  let siegeVise = null, force = 0;
  for (const s of paliers) if (s.siege){ const d = Math.min(Math.abs(p - (s.de + s.a)/2) - (s.a - s.de)/2, 1); const f2 = 1 - Math.min(1, Math.max(0, d) / .06); if (f2 > force){ force = f2; siegeVise = s.siege; } }
  if (siegeVise){
    const pl = places[siegeVise]; lumiere.set(pl.x + .1, 1.75, pl.z);
    projecteur.position.copy(lumiere); projecteur.target.position.set(pl.x + .15, .85, pl.z);
  }
  projecteur.intensity = 5 * force;
  miroir.visible = voile.visible = p < .33;
  habitacle.intensity = 1.2 * lisse(Math.min(1, Math.max(0, (p - .22) / .1)));
  etapes.forEach(e => e.classList.toggle('vue', p >= +e.dataset.de && p < +e.dataset.a));
  placerFiches(p);
  if (jauge) jauge.style.transform = `scaleY(${p})`;
  renderer.render(scene, camera);
});
window.__debug = {sol, voile, miroir, scene, voiture};
