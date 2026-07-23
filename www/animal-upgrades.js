'use strict';

// Animaux harmonisés, sons individuels, cochons et commerce de poules.
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const SYSTEM_KEY = 'elevage.systems.v1';
  const CHICKEN_KEY = 'elevage.chickens.v2';
  const PIG_KEY = 'elevage.pigs.v1';
  const MAX_HENS = 12;
  const MAX_PIGS = 6;
  const pigPen = { x: 3, z: -12, w: 4.1, d: 3.15 };
  const pigs = [];
  const knownFarmGroups = new Set();
  const animatedFarmAnimals = [];
  const tmpWorld = new THREE.Vector3();
  const tmpProjected = new THREE.Vector3();
  const raycasterUpgrade = new THREE.Raycaster();
  const pointerUpgrade = new THREE.Vector2();
  let pointerDownX = 0;
  let pointerDownY = 0;
  let pendingTappedBird = null;
  let lastUpgradeFrame = performance.now();
  let tradeRefreshTimer = 0;

  const BREEDS = {
    red: { name: 'Poule rousse', color: 0xB5824A, cost: 85, sell: 45, scale: 1, description: 'Fermière équilibrée' },
    white: { name: 'Poule blanche', color: 0xF5EFE0, cost: 110, sell: 60, scale: 1.04, description: 'Grande poule claire' },
    black: { name: 'Poule noire', color: 0x2E2A1E, cost: 140, sell: 75, scale: 0.98, description: 'Plumage sombre' },
    sussex: { name: 'Poule Sussex', color: 0xEFE9D9, cost: 175, sell: 95, scale: 1.08, description: 'Blanche au cou noir', accent: 0x302B27 },
    dwarf: { name: 'Poule naine', color: 0xD8A04D, cost: 125, sell: 68, scale: 0.76, description: 'Plus petite et vive', crest: true }
  };

  const DEFAULT_BREEDS = ['red', 'white', 'red', 'sussex', 'white', 'black'];

  function makeMaterial(color, roughness = 0.84) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: false });
  }

  function makeMesh(geometry, material, position, scale, rotation) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveSystemCoins() {
    const economy = window.farmEconomyState;
    if (!economy) return;
    const saved = readJson(SYSTEM_KEY, {});
    saved.coins = Math.max(0, Math.floor(economy.coins));
    localStorage.setItem(SYSTEM_KEY, JSON.stringify(saved));
  }

  function coins() {
    return window.farmEconomyState ? Number(window.farmEconomyState.coins) || 0 : 0;
  }

  function changeCoins(amount) {
    if (!window.farmEconomyState) return false;
    window.farmEconomyState.coins = Math.max(0, coins() + amount);
    saveSystemCoins();
    return true;
  }

  function status(message) {
    if (typeof setFarmStatus === 'function') setFarmStatus(message);
  }

  function addEye(parent, side, y, z, size = 0.05) {
    const white = makeMesh(new THREE.SphereGeometry(size, 9, 7), makeMaterial(0xFFFDF5, 0.24), [side, y, z]);
    parent.add(white);
    const pupil = makeMesh(new THREE.SphereGeometry(size * 0.53, 8, 6), makeMaterial(0x17120F, 0.18), [side, y, z + size * 0.83]);
    parent.add(pupil);
    const shine = makeMesh(new THREE.SphereGeometry(size * 0.17, 6, 5), makeMaterial(0xFFFFFF, 0.12), [side - size * 0.12, y + size * 0.16, z + size * 1.28]);
    parent.add(shine);
  }

  function removeChildren(group) {
    while (group.children.length) group.remove(group.children[group.children.length - 1]);
  }

  function geometryRadius(mesh) {
    const p = mesh && mesh.geometry && mesh.geometry.parameters;
    return p && typeof p.radius === 'number' ? p.radius : null;
  }

  function classifyLegacyGroup(group) {
    if (!group || !group.isGroup || group.userData.bird || group.userData.farmAnimal) return null;
    const directMeshes = group.children.filter(child => child.isMesh);
    const radii = directMeshes.map(geometryRadius).filter(value => value !== null);
    const boxCount = directMeshes.filter(child => child.geometry && child.geometry.type === 'BoxGeometry').length;
    const childGroups = group.children.filter(child => child.isGroup);
    if (childGroups.length >= 4 && radii.some(radius => Math.abs(radius - 0.72) < 0.04)) return 'cow';
    if (radii.some(radius => Math.abs(radius - 0.65) < 0.04) && radii.filter(radius => Math.abs(radius - 0.32) < 0.04).length >= 4) return 'sheep';
    if (radii.some(radius => Math.abs(radius - 0.33) < 0.04) && radii.some(radius => Math.abs(radius - 0.19) < 0.04) && boxCount >= 1) return 'duck';
    return null;
  }

  function restyleSheep(group) {
    const wool = makeMaterial(0xF3EBDD, 0.94);
    const face = makeMaterial(0x55473D, 0.88);
    const hoof = makeMaterial(0x342A24, 0.9);
    const pink = makeMaterial(0xC99683, 0.75);
    removeChildren(group);
    group.add(makeMesh(new THREE.SphereGeometry(0.62, 11, 9), wool, [0, 0.72, 0], [1.15, 0.83, 1.27]));
    [[-0.38,0.88,-0.22,0.34],[0,0.98,-0.28,0.37],[0.39,0.87,-0.2,0.34],[-0.35,0.88,0.23,0.32],[0.03,1.02,0.22,0.36],[0.4,0.86,0.23,0.32]].forEach(([x,y,z,radius]) => {
      group.add(makeMesh(new THREE.SphereGeometry(radius, 9, 7), wool, [x, y, z]));
    });
    const head = new THREE.Group();
    head.position.set(0, 0.87, 0.73);
    head.add(makeMesh(new THREE.SphereGeometry(0.29, 10, 8), face, [0,0,0], [0.86,0.98,0.82]));
    head.add(makeMesh(new THREE.SphereGeometry(0.17, 9, 7), pink, [0,-0.09,0.22], [1,0.62,0.68]));
    [-1,1].forEach(side => {
      head.add(makeMesh(new THREE.SphereGeometry(0.12,8,6), face, [side*0.27,0.06,-0.01], [1.35,0.42,0.62], [0,0,side*0.24]));
      addEye(head, side*0.095, 0.05, 0.225, 0.047);
    });
    group.add(head);
    const legs = [];
    [[-0.28,0.34],[0.28,0.34],[-0.28,-0.36],[0.28,-0.36]].forEach(([x,z]) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x,0.52,z);
      legGroup.add(makeMesh(new THREE.CylinderGeometry(0.05,0.058,0.42,6), face, [0,-0.21,0]));
      legGroup.add(makeMesh(new THREE.CylinderGeometry(0.068,0.074,0.11,6), hoof, [0,-0.46,0.02]));
      group.add(legGroup);
      legs.push(legGroup);
    });
    group.add(makeMesh(new THREE.SphereGeometry(0.13,8,6), wool, [0,0.8,-0.72], [0.8,1.1,0.8]));
    group.userData.farmAnimal = { type:'sheep', group, legs, head };
    group.userData.lastFarmPosition = group.position.clone();
    animatedFarmAnimals.push(group.userData.farmAnimal);
  }

  function restyleDuck(group) {
    const variant = Array.from(group.uuid).reduce((sum,char) => sum + char.charCodeAt(0), 0) % 2;
    const feather = makeMaterial(variant ? 0xF0E5C8 : 0x9A704B, 0.84);
    const wingMat = makeMaterial(variant ? 0xD5C49E : 0x755137, 0.86);
    const orange = makeMaterial(0xE7A13A, 0.66);
    removeChildren(group);
    group.add(makeMesh(new THREE.SphereGeometry(0.34,11,9), feather, [0,0.31,0], [0.92,0.76,1.25]));
    group.add(makeMesh(new THREE.SphereGeometry(0.25,10,8), feather, [0,0.35,0.28], [0.85,0.92,0.8]));
    const head = new THREE.Group();
    head.position.set(0,0.58,0.29);
    head.add(makeMesh(new THREE.SphereGeometry(0.2,10,8), feather, [0,0,0]));
    head.add(makeMesh(new THREE.SphereGeometry(0.13,9,7), orange, [0,-0.035,0.2], [1.2,0.38,0.8]));
    [-1,1].forEach(side => addEye(head, side*0.075, 0.045, 0.15, 0.04));
    group.add(head);
    [-1,1].forEach(side => group.add(makeMesh(new THREE.SphereGeometry(0.22,9,7), wingMat, [side*0.25,0.34,-0.02], [0.4,0.9,1.12], [0,side*0.32,0])));
    [-1,0,1].forEach(index => group.add(makeMesh(new THREE.ConeGeometry(0.055,0.27,5), wingMat, [index*0.055,0.39+Math.abs(index)*0.025,-0.37], null, [-1.18,0,index*0.18])));
    const legs = [];
    [-0.09,0.09].forEach(x => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x,0.2,0);
      legGroup.add(makeMesh(new THREE.CylinderGeometry(0.018,0.022,0.18,5), orange, [0,-0.09,0]));
      legGroup.add(makeMesh(new THREE.SphereGeometry(0.075,7,5), orange, [0,-0.2,0.04], [1.15,0.18,0.75]));
      group.add(legGroup);
      legs.push(legGroup);
    });
    group.userData.farmAnimal = { type:'duck', group, legs, head };
    group.userData.lastFarmPosition = group.position.clone();
    animatedFarmAnimals.push(group.userData.farmAnimal);
  }

  function markCow(group) {
    const legGroups = group.children.filter(child => child.isGroup && child.children.some(grandchild => grandchild.isMesh && grandchild.geometry && grandchild.geometry.type === 'CylinderGeometry'));
    const head = group.children.find(child => child.isGroup && child !== legGroups[0] && child.children.length >= 5) || null;
    group.userData.farmAnimal = { type:'cow', group, legs:legGroups, head };
  }

  function scanAndRestyleAnimals() {
    scene.children.forEach(group => {
      if (!group || !group.isGroup || knownFarmGroups.has(group.uuid) || group.userData.bird || group.userData.farmAnimal) return;
      const type = classifyLegacyGroup(group);
      if (!type) return;
      knownFarmGroups.add(group.uuid);
      if (type === 'sheep') restyleSheep(group);
      else if (type === 'duck') restyleDuck(group);
      else if (type === 'cow') markCow(group);
    });
  }

  function makeSign(text,x,y,z) {
    const canvas = document.createElement('canvas'); canvas.width=320; canvas.height=96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle='#6B4A32'; ctx.fillRect(5,10,310,76);
    ctx.strokeStyle='#D9B36C'; ctx.lineWidth=8; ctx.strokeRect(5,10,310,76);
    ctx.fillStyle='#FFF4D7'; ctx.font='700 40px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,160,48);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(canvas), transparent:true }));
    sprite.position.set(x,y,z); sprite.scale.set(2.6,0.78,1); scene.add(sprite);
  }

  function buildPigPen() {
    const side = (ax,az,bx,bz) => {
      const segments = Math.max(2, Math.round(Math.hypot(bx-ax,bz-az)/1.8));
      for (let i=0;i<segments;i+=1) {
        const t0=i/segments, t1=(i+1)/segments;
        const x0=ax+(bx-ax)*t0, z0=az+(bz-az)*t0, x1=ax+(bx-ax)*t1, z1=az+(bz-az)*t1;
        fencePost(x0,z0); fenceRail(x0,z0,x1,z1,0.35); fenceRail(x0,z0,x1,z1,0.82);
      }
      fencePost(bx,bz);
    };
    side(pigPen.x-pigPen.w,pigPen.z-pigPen.d,pigPen.x+pigPen.w,pigPen.z-pigPen.d);
    side(pigPen.x+pigPen.w,pigPen.z-pigPen.d,pigPen.x+pigPen.w,pigPen.z+pigPen.d);
    side(pigPen.x+pigPen.w,pigPen.z+pigPen.d,pigPen.x-pigPen.w,pigPen.z+pigPen.d);
    side(pigPen.x-pigPen.w,pigPen.z+pigPen.d,pigPen.x-pigPen.w,pigPen.z-pigPen.d);
    makeSign('COCHONS',pigPen.x,1.65,pigPen.z-pigPen.d-0.15);
    const mud = makeMesh(new THREE.CircleGeometry(1.45,24), makeMaterial(0x76533E,0.98), [pigPen.x+1.25,0.045,pigPen.z+0.3]);
    mud.rotation.x=-Math.PI/2; scene.add(mud);
  }

  function randomPigTarget() {
    return new THREE.Vector3(pigPen.x+(Math.random()*2-1)*(pigPen.w-0.75),0,pigPen.z+(Math.random()*2-1)*(pigPen.d-0.75));
  }

  function makePig() {
    const group = new THREE.Group();
    const pink=makeMaterial(0xE6A292,0.82), lightPink=makeMaterial(0xF0B5A5,0.76), dark=makeMaterial(0x5A3B36,0.86);
    group.add(makeMesh(new THREE.SphereGeometry(0.58,11,9),pink,[0,0.61,0],[0.92,0.75,1.3]));
    group.add(makeMesh(new THREE.SphereGeometry(0.38,10,8),pink,[0,0.7,0.62],[0.96,0.92,0.82]));
    const head = new THREE.Group(); head.position.set(0,0.75,0.83);
    head.add(makeMesh(new THREE.SphereGeometry(0.32,10,8),pink,[0,0,0],[0.95,0.95,0.82]));
    head.add(makeMesh(new THREE.SphereGeometry(0.21,9,7),lightPink,[0,-0.08,0.25],[1.12,0.64,0.62]));
    [-0.075,0.075].forEach(x => head.add(makeMesh(new THREE.SphereGeometry(0.024,7,6),dark,[x,-0.08,0.39])));
    [-1,1].forEach(side => {
      head.add(makeMesh(new THREE.ConeGeometry(0.11,0.24,6),pink,[side*0.22,0.25,-0.03],null,[0,0,side*-0.32]));
      addEye(head,side*0.105,0.06,0.235,0.045);
    });
    group.add(head);
    const legs=[];
    [[-0.26,0.34],[0.26,0.34],[-0.26,-0.35],[0.26,-0.35]].forEach(([x,z]) => {
      const legGroup=new THREE.Group(); legGroup.position.set(x,0.43,z);
      legGroup.add(makeMesh(new THREE.CylinderGeometry(0.055,0.065,0.36,6),pink,[0,-0.18,0]));
      legGroup.add(makeMesh(new THREE.CylinderGeometry(0.07,0.075,0.09,6),dark,[0,-0.405,0.02]));
      group.add(legGroup); legs.push(legGroup);
    });
    const tail=new THREE.Group(); tail.position.set(0,0.72,-0.73);
    tail.add(makeMesh(new THREE.TorusGeometry(0.12,0.027,6,12,Math.PI*1.55),pink,[0,0,0],null,[Math.PI/2,0,0.4])); group.add(tail);
    group.position.copy(randomPigTarget()); group.scale.setScalar(0.92+Math.random()*0.08); scene.add(group);
    const pig={type:'pig',group,legs,head,tail,target:randomPigTarget(),wait:Math.random()*2,speed:0.38+Math.random()*0.08,phase:Math.random()*Math.PI*2};
    group.userData.farmAnimal=pig; pigs.push(pig); return pig;
  }

  function savePigs(){ localStorage.setItem(PIG_KEY,JSON.stringify({count:pigs.length})); }
  function buyPig(){ if(pigs.length>=MAX_PIGS)return status('L’enclos des cochons est plein.'); if(coins()<150)return status('Il manque des pièces pour acheter ce cochon.'); changeCoins(-150); makePig(); savePigs(); refreshTradeUi(); status('Un nouveau cochon arrive dans son enclos.'); }
  function sellPig(){ const pig=pigs[pigs.length-1]; if(!pig)return status('Il n’y a aucun cochon à vendre.'); scene.remove(pig.group); pigs.pop(); changeCoins(85); savePigs(); refreshTradeUi(); status('Le cochon a été vendu pour 85 pièces.'); }

  function addBreedDetails(hen,breedId) {
    const breed=BREEDS[breedId]||BREEDS.red; hen.breedId=breedId; hen.baseScale*=breed.scale; hen.group.scale.setScalar(hen.baseScale);
    if(breed.accent){ const accent=makeMaterial(breed.accent,0.87); [-1,0,1].forEach(index=>hen.group.add(makeMesh(new THREE.SphereGeometry(0.105,8,6),accent,[index*0.1,0.76+Math.abs(index)*0.018,0.18],[0.65,0.8,0.7]))); [-1,1].forEach(side=>hen.group.add(makeMesh(new THREE.SphereGeometry(0.16,8,6),accent,[side*0.35,0.49,-0.04],[0.34,0.85,1]))); }
    if(breed.crest){ const crest=makeMaterial(0xC23B3B,0.55); [-1,0,1].forEach(index=>hen.head.add(makeMesh(new THREE.SphereGeometry(0.06,7,5),crest,[index*0.055,0.2+(index===0?0.025:0),-0.015]))); }
  }

  function spawnBreedHen(breedId) {
    if(hens.length>=MAX_HENS)return null;
    const breed=BREEDS[breedId]||BREEDS.red,index=hens.length,angle=(index/Math.max(6,MAX_HENS))*Math.PI*2;
    const homeX=Math.min(YARD.xMax-0.8,Math.max(-9,-1+Math.cos(angle)*5));
    const homeZ=Math.min(YARD.zMax-0.8,Math.max(1,5+Math.sin(angle)*4));
    const hen=chicken(homeX,homeZ,breed.color);
    hen.role='hen'; hen.broody=index%2===1; hen.nestIndex=index%6; hen.nest=hen.nestIndex<3?nestPositions[hen.nestIndex]:broodNestPositions[hen.nestIndex-3];
    hen.fertileUntil=0; hen.pauseUntil=0; hen.currentEgg=null; hen.group.userData.bird=hen; addBreedDetails(hen,breedId); chickens.push(hen); hens.push(hen); updateHenCount(); return hen;
  }

  function clearCurrentHens(){ const old=hens.slice(); old.forEach(hen=>{scene.remove(hen.group); const i=chickens.indexOf(hen); if(i>=0)chickens.splice(i,1);}); hens.splice(0,hens.length); }
  function saveHens(){ localStorage.setItem(CHICKEN_KEY,JSON.stringify({breeds:hens.map(hen=>hen.breedId||'red')})); }
  function restoreHens(){ const saved=readJson(CHICKEN_KEY,null); const ids=saved&&Array.isArray(saved.breeds)&&saved.breeds.length?saved.breeds.filter(id=>BREEDS[id]).slice(0,MAX_HENS):DEFAULT_BREEDS.slice(); clearCurrentHens(); ids.forEach(spawnBreedHen); saveHens(); }
  function updateHenCount(){ const el=document.getElementById('hensCount'); if(el)el.textContent=String(hens.length); }

  function buyHen(breedId){ const breed=BREEDS[breedId]; if(!breed)return; if(hens.length>=MAX_HENS)return status('Le poulailler est plein : maximum 12 poules.'); if(coins()<breed.cost)return status(`Il manque des pièces pour acheter ${breed.name.toLowerCase()}.`); changeCoins(-breed.cost); spawnBreedHen(breedId); saveHens(); refreshTradeUi(); status(`${breed.name} rejoint l’élevage.`); }

  function sellHen(breedId){
    if(hens.length<=1)return status('Il faut garder au moins une poule dans l’élevage.');
    let index=-1;
    for(let i=hens.length-1;i>=0;i-=1){ const hen=hens[i]; if((hen.breedId||'red')===breedId&&!hen.currentEgg&&!['laying','brooding','toNest'].includes(hen.state)){index=i;break;} }
    if(index<0)return status('Cette poule est occupée à pondre ou à couver. Réessaie un peu plus tard.');
    const hen=hens[index],breed=BREEDS[breedId]; if(typeof rooster!=='undefined'&&rooster.courtshipTarget===hen)rooster.courtshipTarget=null;
    scene.remove(hen.group); hens.splice(index,1); const chickenIndex=chickens.indexOf(hen); if(chickenIndex>=0)chickens.splice(chickenIndex,1);
    changeCoins(breed.sell); saveHens(); updateHenCount(); refreshTradeUi(); status(`${breed.name} a été vendue pour ${breed.sell} pièces.`);
  }

  function countBreed(id){ return hens.filter(hen=>(hen.breedId||'red')===id).length; }

  function installTradeUi(){
    const card=document.querySelector('#shop .sc'); if(!card||document.getElementById('animalUpgradeTrade'))return;
    const style=document.createElement('style'); style.textContent=`#shop .sc{max-height:min(82vh,720px);overflow-y:auto;box-sizing:border-box}#animalUpgradeTrade{margin-top:15px;padding-top:3px}#animalUpgradeTrade h3{font-family:Fredoka,sans-serif;margin:15px 0 4px;font-size:18px}.upgradeNote{display:block;color:#796552;margin-bottom:7px}.tradeRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px 10px;align-items:center;padding:11px 0;border-top:1px solid #4a372826}.tradeRow small{display:block;color:#796552;margin-top:2px}.tradeActions{display:flex;gap:6px;align-items:center}.tradeBuy,.tradeSell{border:0;border-radius:10px;padding:9px 10px;font-weight:700;white-space:nowrap}.tradeBuy{background:#7FA65C;color:white}.tradeSell{background:#D9B36C;color:#4A3728}.tradeBuy:disabled,.tradeSell:disabled{background:#aaa;color:#eee}.tradeCount{font-family:Fredoka,sans-serif;color:#B5482E}`; document.head.appendChild(style);
    const section=document.createElement('div'); section.id='animalUpgradeTrade';
    section.innerHTML=`<h3>🐷 Cochons</h3><span class="upgradeNote">Animaux arrondis, adaptés à leur vraie taille.</span><div class="tradeRow"><div><b>Cochon rose</b><small>Possédés : <span id="pigTradeCount" class="tradeCount">0</span>/${MAX_PIGS}</small></div><div class="tradeActions"><button id="buyPigUpgrade" class="tradeBuy">150 🪙</button><button id="sellPigUpgrade" class="tradeSell">Vendre 85</button></div></div><h3>🐔 Races de poules</h3><span class="upgradeNote">Maximum ${MAX_HENS} poules. Une poule occupée à pondre ou couver ne peut pas être vendue.</span>${Object.entries(BREEDS).map(([id,breed])=>`<div class="tradeRow"><div><b>${breed.name}</b><small>${breed.description} · Possédées : <span id="breedCount-${id}" class="tradeCount">0</span></small></div><div class="tradeActions"><button class="tradeBuy" data-buy-breed="${id}">${breed.cost} 🪙</button><button class="tradeSell" data-sell-breed="${id}">Vendre ${breed.sell}</button></div></div>`).join('')}`;
    card.appendChild(section); section.querySelector('#buyPigUpgrade').addEventListener('click',buyPig); section.querySelector('#sellPigUpgrade').addEventListener('click',sellPig);
    section.querySelectorAll('[data-buy-breed]').forEach(button=>button.addEventListener('click',()=>buyHen(button.dataset.buyBreed)));
    section.querySelectorAll('[data-sell-breed]').forEach(button=>button.addEventListener('click',()=>sellHen(button.dataset.sellBreed))); refreshTradeUi();
  }

  function refreshTradeUi(){
    const pigCount=document.getElementById('pigTradeCount'); if(pigCount)pigCount.textContent=String(pigs.length);
    const buyPigButton=document.getElementById('buyPigUpgrade'); if(buyPigButton)buyPigButton.disabled=pigs.length>=MAX_PIGS||coins()<150;
    const sellPigButton=document.getElementById('sellPigUpgrade'); if(sellPigButton)sellPigButton.disabled=pigs.length===0;
    Object.entries(BREEDS).forEach(([id,breed])=>{const count=countBreed(id),countElement=document.getElementById(`breedCount-${id}`),buyButton=document.querySelector(`[data-buy-breed="${id}"]`),sellButton=document.querySelector(`[data-sell-breed="${id}"]`); if(countElement)countElement.textContent=String(count); if(buyButton)buyButton.disabled=hens.length>=MAX_HENS||coins()<breed.cost; if(sellButton)sellButton.disabled=count===0||hens.length<=1;}); updateHenCount();
  }

  function ensureSoundContext(){ if(typeof ensureAudio==='function')ensureAudio(); if(typeof audioCtx!=='undefined'&&audioCtx)return audioCtx; return null; }
  function panForGroup(group){ if(!group||typeof camera==='undefined')return 0; group.getWorldPosition(tmpWorld); tmpProjected.copy(tmpWorld).project(camera); return Math.max(-0.9,Math.min(0.9,tmpProjected.x)); }
  function connectOutput(node,context,pan,volume=0.22){ const gain=context.createGain(); gain.gain.value=volume; node.connect(gain); if(typeof context.createStereoPanner==='function'){const panner=context.createStereoPanner();panner.pan.value=pan;gain.connect(panner);panner.connect(context.destination);}else gain.connect(context.destination); return gain; }

  function soundHen(group,quiet=false){ const context=ensureSoundContext(); if(!context)return; const now=context.currentTime,pan=panForGroup(group); [0,0.105,0.21].forEach((delay,index)=>{const oscillator=context.createOscillator();oscillator.type='triangle';oscillator.frequency.setValueAtTime(520-index*55,now+delay);oscillator.frequency.exponentialRampToValueAtTime(270,now+delay+0.085);const gain=connectOutput(oscillator,context,pan,quiet?0.045:0.12);gain.gain.setValueAtTime(0.0001,now+delay);gain.gain.exponentialRampToValueAtTime(quiet?0.045:0.12,now+delay+0.012);gain.gain.exponentialRampToValueAtTime(0.0001,now+delay+0.09);oscillator.start(now+delay);oscillator.stop(now+delay+0.1);}); }
  function soundRooster(group,quiet=false){ const context=ensureSoundContext(); if(!context)return; const now=context.currentTime,pan=panForGroup(group); [[390,610,0,0.15],[610,760,0.14,0.16],[760,290,0.29,0.55]].forEach(([from,to,delay,duration])=>{const oscillator=context.createOscillator();oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(from,now+delay);oscillator.frequency.exponentialRampToValueAtTime(to,now+delay+duration);const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=980;filter.Q.value=0.8;oscillator.connect(filter);const gain=connectOutput(filter,context,pan,quiet?0.045:0.11);gain.gain.setValueAtTime(0.0001,now+delay);gain.gain.exponentialRampToValueAtTime(quiet?0.045:0.11,now+delay+0.025);gain.gain.exponentialRampToValueAtTime(0.0001,now+delay+duration);oscillator.start(now+delay);oscillator.stop(now+delay+duration+0.02);}); }
  function soundCow(group){ const context=ensureSoundContext(); if(!context)return; const now=context.currentTime,pan=panForGroup(group),oscillator=context.createOscillator();oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(155,now);oscillator.frequency.exponentialRampToValueAtTime(88,now+0.48);oscillator.frequency.exponentialRampToValueAtTime(118,now+0.95);const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=720;filter.Q.value=2.1;oscillator.connect(filter);const gain=connectOutput(filter,context,pan,0.16);gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(0.16,now+0.06);gain.gain.exponentialRampToValueAtTime(0.0001,now+1.02);oscillator.start(now);oscillator.stop(now+1.05); }
  function soundSheep(group){ const context=ensureSoundContext(); if(!context)return; const now=context.currentTime,pan=panForGroup(group); [0,0.32].forEach((delay,index)=>{const oscillator=context.createOscillator();oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(index?360:420,now+delay);oscillator.frequency.exponentialRampToValueAtTime(index?235:275,now+delay+0.3);const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=820;filter.Q.value=1.5;oscillator.connect(filter);const gain=connectOutput(filter,context,pan,0.12);gain.gain.setValueAtTime(0.0001,now+delay);gain.gain.exponentialRampToValueAtTime(0.12,now+delay+0.035);gain.gain.exponentialRampToValueAtTime(0.0001,now+delay+0.31);oscillator.start(now+delay);oscillator.stop(now+delay+0.33);}); }
  function soundPig(group){ const context=ensureSoundContext(); if(!context)return; const now=context.currentTime,pan=panForGroup(group); [0,0.18].forEach((delay,index)=>{const oscillator=context.createOscillator();oscillator.type='square';oscillator.frequency.setValueAtTime(index?185:220,now+delay);oscillator.frequency.exponentialRampToValueAtTime(105,now+delay+0.14);const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;oscillator.connect(filter);const gain=connectOutput(filter,context,pan,0.095);gain.gain.setValueAtTime(0.0001,now+delay);gain.gain.exponentialRampToValueAtTime(0.095,now+delay+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,now+delay+0.15);oscillator.start(now+delay);oscillator.stop(now+delay+0.17);}); }
  function soundDuck(group){ const context=ensureSoundContext(); if(!context)return; const now=context.currentTime,pan=panForGroup(group); [0,0.19].forEach((delay,index)=>{const oscillator=context.createOscillator();oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(index?520:590,now+delay);oscillator.frequency.exponentialRampToValueAtTime(245,now+delay+0.15);const filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=720;filter.Q.value=1.1;oscillator.connect(filter);const gain=connectOutput(filter,context,pan,0.09);gain.gain.setValueAtTime(0.0001,now+delay);gain.gain.exponentialRampToValueAtTime(0.09,now+delay+0.012);gain.gain.exponentialRampToValueAtTime(0.0001,now+delay+0.16);oscillator.start(now+delay);oscillator.stop(now+delay+0.18);}); }

  function reactAnimal(animal){
    if(!animal)return;
    if(animal.type==='hen'||animal.type==='rooster'){const bird=animal.bird;if(!bird||!bird.head)return;const started=performance.now();const animate=()=>{const progress=(performance.now()-started)/360;bird.head.rotation.z=Math.sin(progress*Math.PI*4)*0.16*(1-Math.min(1,progress));if(progress<1)requestAnimationFrame(animate);else bird.head.rotation.z=0;};animate();return;}
    const group=animal.group;if(!group)return;const base=group.scale.clone(),started=performance.now();const animate=()=>{const progress=Math.min(1,(performance.now()-started)/320),bounce=Math.sin(progress*Math.PI)*0.12;group.scale.set(base.x*(1-bounce*0.35),base.y*(1+bounce),base.z*(1-bounce*0.35));if(progress<1)requestAnimationFrame(animate);else group.scale.copy(base);};animate();
  }
  function playFarmAnimal(animal){ if(!animal)return; reactAnimal(animal); if(animal.type==='cow')soundCow(animal.group); else if(animal.type==='sheep')soundSheep(animal.group); else if(animal.type==='pig')soundPig(animal.group); else if(animal.type==='duck')soundDuck(animal.group); }
  function findAnimalFromObject(object){ let current=object; while(current){if(current.userData&&current.userData.bird){const bird=current.userData.bird;return{type:bird.role==='rooster'?'rooster':'hen',bird,group:bird.group};}if(current.userData&&current.userData.farmAnimal)return current.userData.farmAnimal;current=current.parent;}return null; }
  function hitAnimal(clientX,clientY){ pointerUpgrade.x=(clientX/window.innerWidth)*2-1;pointerUpgrade.y=-(clientY/window.innerHeight)*2+1;raycasterUpgrade.setFromCamera(pointerUpgrade,camera);const hits=raycasterUpgrade.intersectObjects(scene.children,true);for(const hit of hits){const animal=findAnimalFromObject(hit.object);if(animal)return animal;}return null; }

  function installIndividualTapSounds(){
    window.addEventListener('pointerdown',event=>{pointerDownX=event.clientX;pointerDownY=event.clientY;},true);
    window.addEventListener('pointerup',event=>{if(Math.hypot(event.clientX-pointerDownX,event.clientY-pointerDownY)>=6)return;const animal=hitAnimal(event.clientX,event.clientY);if(!animal)return;if(animal.type==='hen'||animal.type==='rooster')pendingTappedBird=animal;else playFarmAnimal(animal);},true);
    if(typeof playCluck==='function'){playCluck=function individualCluck(){const tapped=pendingTappedBird&&pendingTappedBird.type==='hen',randomHen=hens.length?hens[Math.floor(Math.random()*hens.length)]:null,animal=tapped?pendingTappedBird:(randomHen?{type:'hen',bird:randomHen,group:randomHen.group}:null);pendingTappedBird=null;if(!animal||!animal.bird)return;reactAnimal(animal);soundHen(animal.bird.group,!tapped);};}
    if(typeof playCrow==='function'){playCrow=function individualCrow(){const tapped=pendingTappedBird&&pendingTappedBird.type==='rooster',animal=tapped?pendingTappedBird:(typeof rooster!=='undefined'?{type:'rooster',bird:rooster,group:rooster.group}:null);pendingTappedBird=null;if(!animal||!animal.bird)return;reactAnimal(animal);soundRooster(animal.bird.group,!tapped);};}
  }

  function updatePig(pig,dt,time){ pig.wait-=dt;let dx=pig.target.x-pig.group.position.x,dz=pig.target.z-pig.group.position.z,distance=Math.hypot(dx,dz);if(distance<0.16||pig.wait<-8){pig.target.copy(randomPigTarget());pig.wait=0.8+Math.random()*2.5;dx=pig.target.x-pig.group.position.x;dz=pig.target.z-pig.group.position.z;distance=Math.hypot(dx,dz);}const moving=pig.wait<=0&&distance>0.001;if(moving){pig.group.rotation.y=Math.atan2(dx,dz);const step=Math.min(distance,pig.speed*dt);pig.group.position.x+=(dx/distance)*step;pig.group.position.z+=(dz/distance)*step;pig.group.position.y=Math.abs(Math.sin(time*5+pig.phase))*0.025;}else pig.group.position.y=0;const stride=moving?Math.sin(time*6+pig.phase)*0.28:0;pig.legs[0].rotation.x=stride;pig.legs[3].rotation.x=stride;pig.legs[1].rotation.x=-stride;pig.legs[2].rotation.x=-stride;pig.head.rotation.x=moving?Math.sin(time*5+pig.phase)*0.035:-0.05+Math.sin(time*1.5+pig.phase)*0.025;pig.tail.rotation.z=Math.sin(time*3+pig.phase)*0.18; }
  function updateRestyledAnimal(animal,time){ const group=animal.group,previous=group.userData.lastFarmPosition||group.position.clone(),moved=group.position.distanceToSquared(previous)>0.000002;group.userData.lastFarmPosition=group.position.clone();if(animal.legs&&animal.legs.length){const stride=moved?Math.sin(time*7+group.id)*0.28:0;if(animal.legs.length===2){animal.legs[0].rotation.x=stride;animal.legs[1].rotation.x=-stride;}else{animal.legs[0].rotation.x=stride;animal.legs[3].rotation.x=stride;animal.legs[1].rotation.x=-stride;animal.legs[2].rotation.x=-stride;}}if(animal.head)animal.head.rotation.x=moved?Math.sin(time*5+group.id)*0.025:Math.sin(time*1.4+group.id)*0.025; }
  function upgradeLoop(now){ requestAnimationFrame(upgradeLoop);const dt=Math.min(0.05,Math.max(0,(now-lastUpgradeFrame)/1000));lastUpgradeFrame=now;const time=now/1000;pigs.forEach(pig=>updatePig(pig,dt,time));animatedFarmAnimals.forEach(animal=>updateRestyledAnimal(animal,time));tradeRefreshTimer-=dt;if(tradeRefreshTimer<=0){refreshTradeUi();tradeRefreshTimer=0.25;} }

  function start(){ scanAndRestyleAnimals();buildPigPen();const pigData=readJson(PIG_KEY,{count:0}),pigCount=Math.max(0,Math.min(MAX_PIGS,Number(pigData.count)||0));for(let i=0;i<pigCount;i+=1)makePig();restoreHens();installTradeUi();installIndividualTapSounds();const credits=document.getElementById('credits');if(credits)credits.textContent='Sons des animaux générés directement dans le jeu';setInterval(scanAndRestyleAnimals,900);requestAnimationFrame(upgradeLoop); }
  start();
})();
