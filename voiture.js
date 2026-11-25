/* DRIVE · la voiture en 3D, pilotée par le défilement.
   Un SUV sans marque, modélisé ici en code (aucun fichier 3D à charger).
   La caméra suit un trajet : extérieur, entrée par la vitre conducteur, siège conducteur,
   siège arrière gauche (intervieweur), siège arrière droit (invité). */
import * as THREE from 'three';
import {RoundedBoxGeometry} from './assets/vendor/RoundedBoxGeometry.js';
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
  transparent:true, depthWrite:false,
  vertexShader:'varying vec2 v; void main(){ v = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader:'varying vec2 v; void main(){ float d = length(v * vec2(.55, 1.)); gl_FragColor = vec4(1., 1., 1., mix(.86, 1., smoothstep(1.8, 5., d))); }'
}));
voile.rotation.x = -Math.PI/2; voile.position.y = .001; scene.add(voile);
const sol = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({opacity:.28}));
sol.rotation.x = -Math.PI/2; sol.position.y = .002; sol.receiveShadow = true; scene.add(sol);

/* ---------- Matières ---------- */
const P = o => new THREE.MeshPhysicalMaterial(o);
const peinture = P({color:'#0c0c0e', metalness:.55, roughness:.3, clearcoat:1, clearcoatRoughness:.04});
const chrome = P({color:'#ffffff', metalness:1, roughness:.07});
const chromeSombre = P({color:'#8a8a90', metalness:1, roughness:.18});
const vitreExt = P({color:'#050507', metalness:.2, roughness:.03, clearcoat:1, clearcoatRoughness:.02, transparent:true, opacity:1});
const vitreInt = new THREE.MeshBasicMaterial({color:'#9aa0a6', transparent:true, opacity:.14, side:THREE.BackSide, depthWrite:false});
const garniture = P({color:'#111113', roughness:.9, side:THREE.BackSide, envMapIntensity:.3});
const cuir = P({color:'#0d0d0e', roughness:.5, clearcoat:.25, clearcoatRoughness:.5, sheen:.3, sheenRoughness:.5, sheenColor:new THREE.Color('#444'), envMapIntensity:.45});
const cuirClair = P({color:'#19191b', roughness:.6, clearcoat:.15, envMapIntensity:.4});
const surpiqure = P({color:'#3a3a3e', metalness:.3, roughness:.5, envMapIntensity:.4});
const plastique = P({color:'#141416', roughness:.45, clearcoat:.4});
const pneu = P({color:'#0b0b0c', roughness:.8, envMapIntensity:.3});
const ecranMat = P({color:'#050506', roughness:.05, clearcoat:1, emissive:new THREE.Color('#0e1a2a'), emissiveIntensity:.6});
const ledBlanc = new THREE.MeshBasicMaterial({color:'#ffffff'});
const ledRouge = new THREE.MeshBasicMaterial({color:'#e0202b'});
const tapis = P({color:'#18181a', roughness:1, envMapIntensity:.3});

const voiture = new THREE.Group(); scene.add(voiture);
const ajoute = (geo, mat, x, y, z, ombre = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = ombre; voiture.add(m); return m; };
const boite = (w, h, d, r = .03, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w/2-.001, h/2-.001, d/2-.001));

// Retire d'une géométrie les triangles qui vérifient un test (pour ouvrir l'habitacle)
function sansFaces(geo, test){
  const g = geo.index ? geo.toNonIndexed() : geo; const p = g.attributes.position, nr = g.attributes.normal; const garde = [], normales = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3){
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i+1); c.fromBufferAttribute(p, i+2);
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)).normalize();
    if (!test((a.x+b.x+c.x)/3, (a.y+b.y+c.y)/3, (a.z+b.z+c.z)/3, n)) for (let k = 0; k < 9; k++){ garde.push(p.array[i*3+k]); normales.push(nr.array[i*3+k]); }
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(garde, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3)); return out;
}
// Surface lissée « lofting » : une suite de sections en super-ellipse le long de la voiture.
// section(x) renvoie {yb, yt, hw} (bas, haut, demi-largeur) ; forme(x, y, z) peut retoucher chaque point.
function loft(x0, x1, N, M, section, n, forme){
  const pos = [], idx = [];
  for (let i = 0; i <= N; i++){
    const x = x0 + (x1 - x0) * i / N, s = section(x), yc = (s.yt + s.yb)/2, hh = (s.yt - s.yb)/2;
    for (let j = 0; j <= M; j++){
      const t = 2*Math.PI*j/M, c = Math.cos(t), sn = Math.sin(t);
      let z = s.hw * Math.sign(c) * Math.pow(Math.abs(c), 2/n), y = yc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2/n);
      const r = forme ? forme(x, y, z, s) : null; if (r){ y = r[0]; z = r[1]; }
      pos.push(x, y, z);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++){
    const a = i*(M+1)+j, b = a+M+1; idx.push(a, b, a+1, b, b+1, a+1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

function deformer(geo, f){ const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, f(p.getX(i), p.getY(i), p.getZ(i))); p.needsUpdate = true; }
const lisse = t => t*t*(3 - 2*t);

/* ---------- Carrosserie (dimensions d'un SUV moyen : 4,74 m × 1,90 m × 1,64 m) ---------- */
const AV = -1.47, AR = 1.42, RA = .49, YC = .4; // essieux, rayon des passages de roue, hauteur des moyeux
const borne = (v, a, b) => Math.min(b, Math.max(a, v));
const arrondi = (u, m) => Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(u)), m)), 1/m);
// Profil de la caisse vu de côté : capot, ligne de caisse, hayon
function hautCaisse(x){
  if (x < -1.95) return .72 + .18 * lisse(borne((x + 2.37) / .42, 0, 1));
  if (x < -.8) return .9 + .12 * lisse((x + 1.95) / 1.15);
  if (x < 2.1) return 1.02 + .02 * (x + .8) / 2.9;
  return 1.04 - .1 * lisse((x - 2.1) / .27);
}
{
  const L0 = -2.37, L1 = 2.37, xc = (L0 + L1)/2, demi = (L1 - L0)/2;
  const section = x => {
    const f = arrondi((x - xc)/demi, 9), fp = 1 - .07 * lisse(borne((Math.abs(x - xc) - 1.6)/.77, 0, 1));
    const yb = .36, yt = hautCaisse(x), yc = (yb + yt)/2, hh = (yt - yb)/2 * (.35 + .65*f);
    return {yb:yc - hh*1.0 + (yt - yb)/2 * 0, yt:yc + hh, hw:.95 * fp * (.3 + .7*f)};
  };
  const geo = loft(L0, L1, 220, 96, section, 5, (x, y, z, s) => {
    // flanc légèrement bombé à l'épaule, rentré en bas
    const v = (y - (s.yt + s.yb)/2) / ((s.yt - s.yb)/2 || 1);
    z *= 1 - .05 * Math.max(0, v) ** 3 - .035 * Math.max(0, -v) ** 2;
    // passages de roue découpés dans les flancs
    for (const ax of [AV, AR]){
      const dx = x - ax;
      if (Math.abs(dx) < RA && Math.abs(z) > .58){ const ya = YC + Math.sqrt(RA*RA - dx*dx); if (y < ya) y = ya; }
    }
    return [y, z];
  });
  const ouvert = sansFaces(geo, (x, y, z, n) => n.y > .55 && x > -.76 && x < 2.08 && y > .9 && Math.abs(z) < .8); // habitacle ouvert
  ajoute(ouvert, peinture, 0, 0, 0);
  voiture.add(new THREE.Mesh(ouvert, garniture)); // parois intérieures
}
{ // Pavillon vitré : pare-brise incliné, toit, lunette arrière ; flancs rentrés vers le toit
  const haut = x => {
    if (x < -.1) return .98 + .62 * Math.pow(lisse(borne((x + .86) / .76, 0, 1)), .9);
    if (x < 1.72) return 1.6 + .02 * Math.sin(Math.PI * (x + .1) / 1.82);
    return 1.6 - .53 * lisse(borne((x - 1.72) / .44, 0, 1));
  };
  const geo = loft(-.86, 2.16, 160, 72, x => ({yb:.9, yt:Math.max(.905, haut(x)), hw:.8}), 6, (x, y, z) => {
    const k = borne((y - 1.0) / .62, 0, 1); return [y, z * (1 - .22 * k)];
  });
  const g2 = sansFaces(geo, (x, y, z, n) => n.y < -.5);
  const ext = new THREE.Mesh(g2, vitreExt); voiture.add(ext);
  const int = new THREE.Mesh(g2, vitreInt); int.renderOrder = 2; voiture.add(int);
}
// Toit couleur caisse, barres de toit et jonc chromé sous les vitres
ajoute(boite(1.66, .04, 1.18, .02), peinture, .86, 1.615, 0);
for (const z of [-.56, .56]) ajoute(boite(1.6, .03, .04, .014), chrome, .88, 1.65, z);
for (const z of [-.8, .8]) ajoute(boite(2.86, .022, .014, .006), chrome, .64, 1.02, z, false);
// Bandeau chromé de bas de vitre arrière et becquet
ajoute(boite(.22, .025, 1.1, .012), peinture, 1.8, 1.6, 0);
// Rétroviseurs
for (const z of [-1, 1]){ ajoute(boite(.22, .13, .17, .05), peinture, -.6, 1.12, z*1.0); ajoute(boite(.06, .05, .16, .02), plastique, -.58, 1.07, z*.88); }
// Face avant : calandre sans logo, phares à bandeau LED
ajoute(boite(.05, .26, 1.0, .05), plastique, -2.39, .58, 0, false);
for (let i = 0; i < 7; i++) ajoute(boite(.012, .008, .9, .004), chromeSombre, -2.415, .48 + i*.033, 0, false);
for (const z of [-.66, .66]) ajoute(boite(.06, .08, .36, .03), ledBlanc, -2.36, .79, z, false);
ajoute(boite(.02, .012, 1.66, .005), ledBlanc, -2.37, .86, 0, false);
// Arrière : feu en bandeau continu
ajoute(boite(.02, .04, 1.46, .01), ledRouge, 2.345, .86, 0, false);
for (const z of [-.45, .45]) ajoute(boite(.04, .04, .14, .02), chrome, 2.3, .42, z, false);
// Bas de caisse et passages de roue foncés
for (const z of [-.9, .9]) ajoute(boite(1.9, .05, .03, .015), chromeSombre, -.03, .42, z, false);
// Poignées chromées
for (const z of [-.955, .955]) for (const x of [-.1, .95]) ajoute(boite(.2, .025, .02, .01), chrome, x, .86, z, false);

// Plaques « DRIVE »
function plaque(){
  const c = document.createElement('canvas'); c.width = 520; c.height = 120; const g = c.getContext('2d');
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 520, 120); g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(5, 5, 510, 110);
  g.fillStyle = '#111'; try { g.fontStretch = 'expanded'; } catch (e) {}
  g.font = '900 78px Archivo, Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.setTransform(1, 0, -.22, 1, 13, 0); g.fillText('DRIVE', 260, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const plaques = [];
for (const [x, ry, y] of [[-2.405, -Math.PI/2, .5], [2.345, Math.PI/2, .62]]){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.52, .12), new THREE.MeshStandardMaterial({roughness:.4}));
  m.position.set(x, y, 0); m.rotation.y = ry; voiture.add(m); plaques.push(m);
}
const peindrePlaques = () => { const t = plaque(); plaques.forEach(m => { m.material.map = t; m.material.needsUpdate = true; }); };
document.fonts && document.fonts.load('900 78px Archivo').then(peindrePlaques, peindrePlaques); peindrePlaques();

/* ---------- Roues ---------- */
function roue(){
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 16; i++){ const a = -Math.PI/2 + Math.PI*i/16; prof.push(new THREE.Vector2(.3 + .07*Math.cos(a) + .0, .125*Math.sin(a))); }
  const flanc = new THREE.LatheGeometry([new THREE.Vector2(.26, -.12), ...prof, new THREE.Vector2(.26, .12)], 64);
  flanc.rotateX(Math.PI/2); const p = new THREE.Mesh(flanc, pneu); p.castShadow = true; g.add(p);
  const jante = new THREE.Mesh(new THREE.CylinderGeometry(.262, .262, .2, 48), chromeSombre); jante.rotation.x = Math.PI/2; g.add(jante);
  const fond = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .21, 48), plastique); fond.rotation.x = Math.PI/2; g.add(fond);
  for (let i = 0; i < 10; i++){ // 5 doubles branches
    const b = new THREE.Mesh(boite(.035, .22, .03, .012), chrome); const a = (i >> 1) * (Math.PI*2/5) + (i % 2 ? .13 : -.13);
    b.position.set(Math.sin(a)*.12, Math.cos(a)*.12, .095); b.rotation.z = -a; g.add(b);
  }
  const moyeu = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .03, 32), chrome); moyeu.rotation.x = Math.PI/2; moyeu.position.z = .105; g.add(moyeu);
  return g;
}
for (const x of [AV, AR]) for (const s of [-1, 1]){
  const r = roue(); r.scale.setScalar(1.08); r.position.set(x, YC, s*.81); if (s < 0) r.rotation.y = Math.PI; voiture.add(r);
  // fond de passage de roue
  const pr = new THREE.Mesh(new THREE.CylinderGeometry(.46, .46, .3, 40, 1, true, Math.PI*.5 - 1.3, 2.6), new THREE.MeshStandardMaterial({color:'#0a0a0a', side:THREE.BackSide}));
  pr.rotation.x = Math.PI/2; pr.rotation.y = 0; pr.position.set(x, YC + .02, s*.8); voiture.add(pr);
}

/* ---------- Habitacle ---------- */
ajoute(boite(2.9, .06, 1.72, .02), tapis, .62, .4, 0, false);
ajoute(boite(.36, .26, 1.6, .08), plastique, -.55, .9, 0);           // planche de bord
ajoute(boite(.04, .15, 1.1, .02), ecranMat, -.4, 1.1, -.08, false); // grand écran (sans marque)
ajoute(boite(.95, .24, .24, .06), plastique, .02, .56, 0);          // console centrale
ajoute(boite(.3, .03, .2, .01), chromeSombre, -.12, .69, 0, false);
// Volant (conduite à gauche : côté z positif quand la voiture regarde vers -x)
const volant = new THREE.Group();
volant.add(new THREE.Mesh(new THREE.TorusGeometry(.185, .024, 18, 72), cuir));
const moyeuV = new THREE.Mesh(new THREE.CylinderGeometry(.065, .075, .05, 32), plastique); moyeuV.rotation.x = Math.PI/2; volant.add(moyeuV);
for (const a of [0, Math.PI, -Math.PI/2]){ const b = new THREE.Mesh(boite(.13, .035, .025, .012), chromeSombre); b.position.set(Math.cos(a)*.11, Math.sin(a)*.11, 0); b.rotation.z = a; volant.add(b); }
volant.position.set(-.33, 1.0, .4);
volant.rotation.order = 'YXZ'; volant.rotation.y = Math.PI/2; volant.rotation.x = -.42; // face au conducteur, incliné
volant.traverse(o => { if (o.isMesh) o.castShadow = true; }); voiture.add(volant);
const colonne = ajoute(new THREE.CylinderGeometry(.03, .045, .32, 16), plastique, -.47, .93, .4, false); colonne.rotation.z = Math.PI/2 - .42;
// Aérateurs chromés et contre-portes
for (const z of [-.55, -.2, .2, .55]) ajoute(new THREE.CylinderGeometry(.035, .035, .03, 24).rotateZ(Math.PI/2), chromeSombre, -.37, .98, z, false);
for (const z of [-.8, .8]) for (const x of [.15, 1.2]) {
  ajoute(boite(.7, .05, .08, .02), cuirClair, x, .9, z, false);           // accoudoir de porte
  ajoute(boite(.6, .012, .012, .005), chromeSombre, x, .97, z*.985, false); // filet chromé
}
// Sièges : chaque place est un groupe, pour pouvoir la mettre en lumière
function siege(largeur, arriere, accoudoir){
  const g = new THREE.Group(), incl = arriere ? -.26 : -.2;
  const m = (geo, mat, x, y, z, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  // assise : coussin central et bourrelets latéraux plus hauts
  m(boite(.5, .12, largeur*.64, .05, 4), cuirClair, 0, 0, 0);
  for (const s of [-1, 1]) m(boite(.52, .16, largeur*.2, .07, 4), cuir, 0, .02, s*largeur*.4);
  m(boite(.5, .1, largeur*.98, .04, 3), cuir, 0, -.07, 0);
  if (accoudoir){ // place du milieu : dossier rabattu en accoudoir, avec porte-gobelets chromés
    const ac = new THREE.Mesh(boite(.5, .1, largeur*.7, .04, 3), cuir); ac.position.set(.06, .14, 0); ac.castShadow = true; g.add(ac);
    for (const z of [-.06, .06]){ const c = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .012, 24), chromeSombre); c.position.set(-.08, .196, z); g.add(c); }
    const dossier = new THREE.Mesh(boite(.14, .3, largeur*.98, .05, 3), cuir); dossier.position.set(.33, .2, 0); dossier.rotation.z = -.26; g.add(dossier);
    return g;
  }
  // dossier incliné : partie centrale, maintiens latéraux, surpiqûres
  const dos = new THREE.Group(); dos.position.set(.29, .06, 0); dos.rotation.z = incl; g.add(dos);
  const d = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; dos.add(o); return o; };
  d(boite(.12, .6, largeur*.66, .05, 4), cuirClair, 0, .3, 0);
  for (const s of [-1, 1]) d(boite(.18, .58, largeur*.2, .07, 4), cuir, -.025, .3, s*largeur*.4);
  for (let i = 0; i < 4; i++) d(boite(.005, .006, largeur*.6, .002), surpiqure, -.061, .14 + i*.11, 0);
  d(boite(.14, .62, largeur*.98, .05, 3), cuir, .03, .3, 0);
  // appuie-tête et ses tiges
  d(boite(.11, .19, .27, .045, 3), cuir, .02, .77, 0);
  for (const s of [-1, 1]) d(new THREE.CylinderGeometry(.007, .007, .12, 8), chromeSombre, .03, .63, s*.07);
  return g;
}
const places = {
  conducteur: siege(.52, false), passager: siege(.52, false),
  interview: siege(.5, true), milieu: siege(.38, true, true), invite: siege(.5, true)
};
places.conducteur.position.set(.18, .6, .4); places.passager.position.set(.18, .6, -.4);
places.interview.position.set(1.22, .6, .44); places.milieu.position.set(1.24, .6, 0); places.invite.position.set(1.22, .6, -.44);
places.milieu.scale.set(1, .96, 1);
Object.values(places).forEach(p => voiture.add(p));
// Tablette arrière
ajoute(boite(.45, .03, 1.5, .01), plastique, 1.95, 1.02, 0, false);

/* ---------- Trajet de la caméra ---------- */
// Chaque étape : [début, fin] du palier, position de la caméra, point regardé.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const paliers = [
  {de:0,   a:.05, pos:V(-5.4, 1.55, 4.6),  vise:V(.1, .78, 0),    decale:1},  // extérieur, trois-quarts avant
  {de:.15, a:.2,  pos:V(4.9, 2.1, 5.9),    vise:V(.25, .8, 0),    decale:1},  // trois-quarts arrière
  {de:.29, a:.29, pos:V(-.05, 1.36, 2.3),  vise:V(.1, 1.0, .2),   decale:0},  // devant la vitre conducteur
  {de:.37, a:.48, pos:V(-.3, 1.34, -.74), vise:V(.16, .86, .4),  decale:0, siege:'conducteur'},
  {de:.57, a:.68, pos:V(.74, 1.36, -.12),  vise:V(1.3, .84, .44),  decale:0, siege:'interview'},
  {de:.78, a:1,   pos:V(.74, 1.36, .12),   vise:V(1.3, .84, -.44), decale:0, siege:'invite'}
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
function recul(p){ const a = camera.aspect; return a >= 1.2 ? 1 : 1 + (1.2 - a) * .9 * (1 - lisse(Math.min(1, Math.max(0, (p - .2) / .09)))); }

/* ---------- Fiches posées sur les sièges ---------- */
const ancres = {conducteur:V(.62, 1.42, .4), interview:V(1.66, 1.4, .44), invite:V(1.66, 1.4, -.44)};
const tmp = new THREE.Vector3();
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
  const W = conteneur.clientWidth, H = conteneur.clientHeight;
  if (W / H >= 1) camera.setViewOffset(W, H, -W * .17 * decale, 0, W, H); else camera.setViewOffset(W, H, 0, -H * .14 * decale, W, H);
  // Les vitres s'effacent à l'approche pour laisser voir l'habitacle
  const fondu = lisse(Math.min(1, Math.max(0, (p - .2) / .1)));
  vitreExt.opacity = 1 - .85 * fondu; vitreExt.depthWrite = fondu < .05;
  ciel.intensity = .9 - .55 * lisse(Math.min(1, Math.max(0, (p - .26) / .1)));
  // Mise en lumière du siège visé
  let siegeVise = null, force = 0;
  for (const s of paliers) if (s.siege){ const d = Math.min(Math.abs(p - (s.de + s.a)/2) - (s.a - s.de)/2, 1); const f2 = 1 - Math.min(1, Math.max(0, d) / .06); if (f2 > force){ force = f2; siegeVise = s.siege; } }
  if (siegeVise){
    const pl = places[siegeVise]; lumiere.set(pl.position.x + .1, 1.55, pl.position.z);
    projecteur.position.copy(lumiere); projecteur.target.position.set(pl.position.x + .15, .7, pl.position.z);
  }
  projecteur.intensity = 9 * force;
  miroir.visible = voile.visible = p < .33;
  habitacle.intensity = 2.2 * lisse(Math.min(1, Math.max(0, (p - .22) / .1)));
  etapes.forEach(e => e.classList.toggle('vue', p >= +e.dataset.de && p < +e.dataset.a));
  placerFiches(p);
  if (jauge) jauge.style.transform = `scaleY(${p})`;
  renderer.render(scene, camera);
});
window.__voiturePrete = true;
