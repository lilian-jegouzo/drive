/* DRIVE · le mot DRIVE en 3D, chrome sur fond blanc. Glisser pour tourner autour (ordinateur). */
import * as THREE from 'three';
import {OrbitControls} from './assets/vendor/OrbitControls.js';

const hero = document.querySelector('.hero');
const stage = document.getElementById('scene');
const D = window.DRIVE || {};
const vitesse = D.logo !== 'droit';
const matiere = D.matiere === 'bicolore' ? 'bicolore' : 'chrome';
const params = new URLSearchParams(location.search);
const fige = params.has('fige') || matchMedia('(prefers-reduced-motion: reduce)').matches;

async function demarrer(){
  const glyphes = await (await fetch('assets/glyphes-archivo.json')).json();
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:params.has('fige')});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xffffff, 0);
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Studio de reflets : boîtes à lumière et bandeaux, pour un chrome contrasté
  const env = new THREE.Scene(); env.background = new THREE.Color('#030303');
  const lm = k => new THREE.MeshBasicMaterial({color:new THREE.Color(1,1,1).multiplyScalar(k), side:THREE.DoubleSide});
  const panneau = (w,h,k,pos,look=[0,0,0]) => {const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),lm(k));m.position.set(...pos);m.lookAt(...look);env.add(m);};
  panneau(8,3,3.2,[0,6,0]);panneau(14,2.4,1.7,[0,2.7,6]);panneau(.6,7,5,[-5,1,1.5]);panneau(.6,7,5,[5,1,1.5]);
  panneau(10,.35,6,[0,1.4,6]);panneau(10,.2,4,[0,-.4,6]);panneau(4,4,1.4,[-3,2,-5]);panneau(12,2,.25,[0,-3,0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, .02).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(.8, .3, 7);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.enableZoom = false;
  controls.minPolarAngle = Math.PI*.32; controls.maxPolarAngle = Math.PI*.56;
  controls.minAzimuthAngle = -.9; controls.maxAzimuthAngle = .9; controls.target.set(0,.5,0);
  // Sur téléphone, on laisse le doigt faire défiler la page
  if (matchMedia('(pointer: coarse)').matches) controls.enabled = false;

  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3,6,5); key.castShadow = true;
  key.shadow.mapSize.set(2048,2048); Object.assign(key.shadow.camera,{left:-5,right:5,top:4,bottom:-2}); key.shadow.radius = 6; scene.add(key);
  const balayage = new THREE.PointLight(0xffffff, 30, 12, 2); balayage.position.set(-4,1.2,2.2); scene.add(balayage);
  const contre = new THREE.DirectionalLight(0xffffff, 1.2); contre.position.set(-4,3,-4); scene.add(contre);
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(40,40), new THREE.ShadowMaterial({opacity:.2}));
  sol.rotation.x = -Math.PI/2; sol.receiveShadow = true; scene.add(sol);

  const P = o => new THREE.MeshPhysicalMaterial(o);
  const mats = matiere === 'bicolore'
    ? [P({color:'#ffffff',metalness:1,roughness:.06}), P({color:'#0E0E10',metalness:.3,roughness:.4,clearcoat:1})]
    : [P({color:'#ffffff',metalness:1,roughness:.07}), P({color:'#ffffff',metalness:1,roughness:.12})];

  const formes = L => {
    const pick = ccw => {const sp=new THREE.ShapePath();for(const c of L.c){sp.moveTo(c[0][0],c[0][1]);for(let i=1;i<c.length;i++)sp.lineTo(c[i][0],c[i][1]);}return sp.toShapes(ccw);};
    const a=pick(false), b=pick(true), t=s=>s.reduce((n,x)=>n+x.holes.length,0);
    return t(a)>=t(b)?a:b;
  };
  const mot = new THREE.Group(); let x = 0;
  const penche = new THREE.Matrix4().makeShear(0,0,.22,0,0,0); // même angle que le D vitesse
  for (const L of glyphes){
    const geo = new THREE.ExtrudeGeometry(formes(L), {depth:.5,bevelEnabled:true,bevelThickness:.06,bevelSize:.03,bevelSegments:8,curveSegments:4});
    if (vitesse) geo.applyMatrix4(penche);
    const m = new THREE.Mesh(geo, mats); m.position.x = x; m.castShadow = m.receiveShadow = true; mot.add(m); x += L.adv + .02;
  }
  const boite = new THREE.Box3().setFromObject(mot); const w = boite.max.x - boite.min.x;
  mot.children.forEach(m => m.position.x -= boite.min.x + w/2);
  mot.position.z = -.25; scene.add(mot);
  // Le mot occupe environ 80 % de la largeur visible
  const ajuste = () => {
    const visH = 2*camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const visW = visH*camera.aspect;
    const s = Math.min(.72*visW/w, .55*visH);
    mot.scale.setScalar(s); mot.position.y = .045*s; controls.target.y = .5*s;
  };

  const taille = () => {
    const W = stage.clientWidth, H = stage.clientHeight;
    renderer.setSize(W, H, false); camera.aspect = W/H; camera.fov = W < 700 ? 40 : 30; camera.updateProjectionMatrix(); ajuste();
  };
  addEventListener('resize', taille); taille();

  // On ne dessine que lorsque le haut de page est visible
  let visible = true;
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(stage);
  const horloge = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const t = horloge.getElapsedTime();
    if (!fige){ balayage.position.x = Math.sin(t*.6)*4.2; mot.rotation.y = Math.sin(t*.35)*.12; }
    controls.update(); renderer.render(scene, camera);
  });
  hero.classList.add('pret');
  window.__pret = true;
}
demarrer().catch(e => { console.warn('3D indisponible, affichage du titre simple.', e); window.__pret = true; });
