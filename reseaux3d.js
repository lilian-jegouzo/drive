/* DRIVE · les logos des réseaux en 3D chrome, en temps réel.
   Un seul moteur 3D dessine les 4 logos, chacun dans sa case.
   Survol : le logo suit la souris. Glisser : il tourne sur lui-même, puis revient de face.
   Si la 3D ne démarre pas, les images PNG restent affichées. */
import * as THREE from 'three';
import {SVGLoader} from './assets/vendor/SVGLoader.js';

const grille = document.querySelector('.reseaux');
const cartes = [...document.querySelectorAll('.reseau[data-reseau]')];
const fige = new URLSearchParams(location.search).has('fige') || matchMedia('(prefers-reduced-motion: reduce)').matches;

async function demarrer(){
  if (!grille || !cartes.length) return;
  const formes = await (await fetch('assets/logos/reseaux-formes.json')).json();

  const canvas = document.createElement('canvas');
  canvas.className = 'reseaux-3d'; canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0xffffff, 0); renderer.setScissorTest(true);
  grille.appendChild(canvas);

  // Même studio de reflets que le DRIVE du haut de page
  const env = new THREE.Scene(); env.background = new THREE.Color('#030303');
  const lm = k => new THREE.MeshBasicMaterial({color:new THREE.Color(1,1,1).multiplyScalar(k), side:THREE.DoubleSide});
  const panneau = (w,h,k,pos) => {const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),lm(k));m.position.set(...pos);m.lookAt(0,0,0);env.add(m);};
  panneau(8,3,3.2,[0,6,0]);panneau(14,2.4,1.7,[0,2.7,6]);panneau(.6,7,5,[-5,1,1.5]);panneau(.6,7,5,[5,1,1.5]);
  panneau(10,.35,6,[0,1.4,6]);panneau(10,.2,4,[0,-.4,6]);panneau(4,4,1.4,[-3,2,-5]);panneau(12,2,.25,[0,-3,0]);
  const envTex = new THREE.PMREMGenerator(renderer).fromScene(env, .02).texture;
  const mats = [new THREE.MeshPhysicalMaterial({color:'#fff',metalness:1,roughness:.07}), new THREE.MeshPhysicalMaterial({color:'#fff',metalness:1,roughness:.12})];
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100); camera.position.set(0, 0, 5.2);

  const logos = cartes.map((carte, i) => {
    const nom = carte.dataset.reseau;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="${nom==='linkedin'?'evenodd':'nonzero'}" d="${formes[nom]}"/></svg>`;
    const shapes = new SVGLoader().parse(svg).paths.flatMap(p => SVGLoader.createShapes(p));
    const geo = new THREE.ExtrudeGeometry(shapes, {depth:3.8, bevelEnabled:true, bevelThickness:.48, bevelSize:.24, bevelSegments:6, curveSegments:24});
    geo.scale(1,-1,1); geo.computeBoundingBox();
    const b = geo.boundingBox; geo.translate(-(b.min.x+b.max.x)/2, -(b.min.y+b.max.y)/2, -(b.min.z+b.max.z)/2);
    geo.computeBoundingBox(); const bb = geo.boundingBox; const m = Math.max(bb.max.x-bb.min.x, bb.max.y-bb.min.y);
    geo.scale(2/m, 2/m, 2/m); geo.computeVertexNormals();
    const scene = new THREE.Scene(); scene.environment = envTex;
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3,6,5); scene.add(key);
    const balayage = new THREE.PointLight(0xffffff, 18, 10, 2); balayage.position.set(-3,1,2.5); scene.add(balayage);
    const mesh = new THREE.Mesh(geo, mats); scene.add(mesh);
    const l = {carte, scene, mesh, balayage, i, survol:false, px:0, py:0, tour:0, vitesse:0, glisse:null, bouge:false};

    // Interactions
    carte.addEventListener('pointerenter', () => { l.survol = true; });
    carte.addEventListener('pointerleave', () => { l.survol = false; });
    carte.addEventListener('pointermove', e => {
      const r = carte.getBoundingClientRect();
      l.px = (e.clientX - r.left) / r.width - .5; l.py = (e.clientY - r.top) / r.height - .5;
      if (l.glisse){
        const dx = e.clientX - l.glisse.x; l.glisse.x = e.clientX;
        if (Math.abs(e.clientX - l.glisse.x0) > 6) l.bouge = true;
        l.tour += dx * .012; l.vitesse = dx * .012;
      }
    });
    carte.addEventListener('pointerdown', e => { l.glisse = {x:e.clientX, x0:e.clientX}; l.bouge = false; l.vitesse = 0; });
    addEventListener('pointerup', () => { l.glisse = null; });
    carte.addEventListener('pointercancel', () => { l.glisse = null; });
    // Un glissement ne doit pas ouvrir le lien
    carte.addEventListener('click', e => { if (l.bouge){ e.preventDefault(); l.bouge = false; } });
    carte.addEventListener('dragstart', e => e.preventDefault());
    return l;
  });

  const taille = () => {
    const r = grille.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
  };
  new ResizeObserver(taille).observe(grille); taille();

  let visible = false;
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }, {rootMargin:'100px'}).observe(grille);
  const horloge = new THREE.Clock();
  let premier = true;
  renderer.setAnimationLoop(() => {
    if (!visible && !premier) return;
    const t = horloge.getElapsedTime();
    const G = grille.getBoundingClientRect(), H = G.height;
    renderer.setScissor(0, 0, G.width, H); renderer.setViewport(0, 0, G.width, H); renderer.clear();
    for (const l of logos){
      const img = l.carte.querySelector('img').getBoundingClientRect();
      const cote = img.height * 1.25;
      const x = img.left + img.width/2 - G.left - cote/2, y = img.top + img.height/2 - G.top - cote/2;
      // Rotation : rebond libre après un glissement, retour progressif de face
      if (!l.glisse){
        l.tour += l.vitesse; l.vitesse *= .94;
        // on ramène l'angle entre -π et π (même orientation), puis le logo revient doucement de face
        while (l.tour > Math.PI){ l.tour -= 2*Math.PI; l.mesh.rotation.y -= 2*Math.PI; }
        while (l.tour < -Math.PI){ l.tour += 2*Math.PI; l.mesh.rotation.y += 2*Math.PI; }
        if (Math.abs(l.vitesse) < .004) l.tour *= .95;
      }
      const auto = fige ? 0 : Math.sin(t*.5 + l.i*1.3) * .16;
      const cibleY = (l.survol ? l.px * 1.1 : auto) - .2 + l.tour;
      const cibleX = l.survol ? l.py * .7 : .06 + (fige ? 0 : Math.sin(t*.4 + l.i) * .05);
      l.mesh.rotation.y += (cibleY - l.mesh.rotation.y) * (l.glisse ? 1 : .12);
      l.mesh.rotation.x += (cibleX - l.mesh.rotation.x) * .12;
      if (!fige) l.balayage.position.x = Math.sin(t*.6 + l.i) * 3.5;
      renderer.setScissor(x, H - y - cote, cote, cote); renderer.setViewport(x, H - y - cote, cote, cote);
      camera.aspect = 1; camera.updateProjectionMatrix();
      renderer.render(l.scene, camera);
    }
    if (premier){ grille.classList.add('reseaux-pret'); premier = false; }
  });
  window.__reseauxPret = true;
}
demarrer().catch(e => { console.warn('Logos 3D indisponibles, images conservées.', e); window.__reseauxPret = true; });
