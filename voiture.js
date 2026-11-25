/* DRIVE · la voiture en 3D, pilotée par le défilement.
   Un SUV sans marque (modèle 3D libre de droits, logos retirés, plaques DRIVE).
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
const habitacle = new THREE.PointLight(0xfff4e8, 2.2, 3.2, 2); habitacle.position.set(.7, 1.45, 0); scene.add(habitacle);
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
const peinture = P({color:'#0b0b0d', metalness:.6, roughness:.32, clearcoat:1, clearcoatRoughness:.03, vertexColors:true}); // ombres de contact cuites dans les sommets
const vitre = P({color:'#0b0c0e', metalness:.1, roughness:.02, clearcoat:1, clearcoatRoughness:.02, transparent:true, opacity:.86, side:THREE.DoubleSide, depthWrite:false});
// Les ombres de contact (cuites dans les couleurs de sommets) assombrissent aussi les reflets :
// sans cela, les joints de portes et les plis des sièges brilleraient comme des surfaces exposées.
const occlusion = m => { m.vertexColors = true; m.onBeforeCompile = sh => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
  { float aoS = clamp(vColor.r, 0., 1.); reflectedLight.indirectDiffuse *= aoS; reflectedLight.indirectSpecular *= aoS * aoS;
  #if defined( USE_CLEARCOAT )
  clearcoatSpecularIndirect *= aoS * aoS;
  #endif
  }`);
}; m.customProgramCacheKey = () => 'ao-sommets'; return m; };
occlusion(peinture);
const voiture = new THREE.Group(); scene.add(voiture);
const places = {conducteur:{x:.1, z:.43}, interview:{x:.92, z:.45}, invite:{x:.92, z:-.45}}; // centres des sièges (repère de la voiture)
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
      if (n.startsWith('Blue paint')) return peinture;
      if (n === 'Glass'){ vitres.push(o); o.castShadow = false; o.renderOrder = 3; return vitre; }
      if (n === 'Grates'){ mt.transparent = false; mt.alphaTest = .5; mt.side = THREE.DoubleSide; }
      if (n === 'Interior'){ mt.side = THREE.DoubleSide; mt.envMapIntensity = .5; mt.roughness = 1.6; } // cuir satiné, pas vernis
      if (n === 'Lights'){ mt.emissiveMap = mt.map; mt.emissive = new THREE.Color(.2, .2, .2); }
      if (n === 'Wheel') mt.color.setScalar(.55);
      if (o.geometry.attributes.color && mt !== peinture) occlusion(mt);
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
  {de:0,   a:.05, pos:V(-4.75, 1.45, 4.05), vise:V(.1, .7, 0),    decale:1},  // extérieur, trois-quarts avant
  {de:.15, a:.2,  pos:V(5.2, 2.15, 6.2),   vise:V(.25, .72, 0),   decale:1.2},  // trois-quarts arrière
  {de:.29, a:.29, pos:V(-.1, 1.3, 2.2),    vise:V(-.05, 1.0, .2), decale:0},  // devant la vitre conducteur
  {de:.37, a:.48, pos:V(-.6, 1.32, -.18),  vise:V(.2, 1.0, .43), decale:0, siege:'conducteur'}, // depuis le pare-brise, comme la caméra du tournage
  {de:.525, a:.525, pos:V(.15, 1.45, 0),   vise:V(1.0, .9, 0),    decale:0},                     // entre les sièges avant
  {de:.58, a:.68, pos:V(.5, 1.38, -.32),   vise:V(1.15, 1.0, .42),  decale:0, siege:'interview'},  // en diagonale, vers Raphaël
  {de:.79, a:1,   pos:V(.5, 1.38, .32),    vise:V(1.15, 1.0, -.42), decale:0, siege:'invite'}       // en diagonale, vers la place de l'invité
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
function recul(p){ const a = camera.aspect, k = a >= 1.75 ? 0 : .45 * (1.75 - Math.max(a, 1.2)) + 1.1 * Math.max(0, 1.2 - a); return 1 + k * (1 - lisse(Math.min(1, Math.max(0, (p - .2) / .09)))); }

/* ---------- Fiches posées sur les sièges ---------- */
const ancres = {conducteur:V(.32, 1.3, .43), interview:V(1.18, 1.24, .45), invite:V(1.18, 1.24, -.45)};
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
    const pl = places[siegeVise]; lumiere.set(pl.x + .1, 1.55, pl.z);
    projecteur.position.copy(lumiere); projecteur.target.position.set(pl.x + .15, .7, pl.z);
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
