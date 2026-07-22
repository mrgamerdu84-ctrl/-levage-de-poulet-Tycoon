'use strict';
  // ---------- GROUND ----------
  const groundGeo = new THREE.PlaneGeometry(220,220,60,60);
  groundGeo.rotateX(-Math.PI/2);
  const pos = groundGeo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i);
    const d = Math.sqrt(x*x+z*z);
    let h = Math.sin(x*0.05)*Math.cos(z*0.045)*0.6;
    if(d>40) h += (d-40)*0.12 * (Math.sin(x*0.1)+1.2);
    pos.setY(i,h);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, mat(COLORS.grass,1,0));
  ground.receiveShadow = true;
  scene.add(ground);

  for(let i=0;i<10;i++){
    const s = 18+Math.random()*22;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(s,10,8,0,Math.PI*2,0,Math.PI/2), mat(i%2?COLORS.grassDark:COLORS.leaf,1,0));
    const ang = (i/10)*Math.PI*2 + Math.random()*0.3;
    const r = 70+Math.random()*25;
    hill.position.set(Math.cos(ang)*r, -s*0.55, Math.sin(ang)*r);
    scene.add(hill);
  }

  const yard = new THREE.Mesh(new THREE.CircleGeometry(13,24), mat(COLORS.soil,1,0));
  yard.rotation.x=-Math.PI/2; yard.position.set(-2,0.03,4); yard.receiveShadow=true;
  scene.add(yard);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(5,60), mat(0x9A7A55,1,0));
  road.rotation.x=-Math.PI/2; road.position.set(20,0.02,-2);
  scene.add(road);

  function pyramidRoof(w,d,h,color){
    const r = Math.sqrt(w*w+d*d)/2 * 0.75;
    const geo = new THREE.ConeGeometry(r,h,4,1);
    geo.rotateY(Math.PI/4);
    const m = new THREE.Mesh(geo, mat(color,0.8,0));
    m.castShadow = true;
    return m;
  }

  function building(x,z,w,d,h,wallColor,roofColor,roofH,rotY=0){
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(wallColor));
    walls.position.y = h/2; walls.castShadow=true; walls.receiveShadow=true;
    g.add(walls);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w+0.15,0.25,d+0.15), mat(COLORS.trim));
    trim.position.y = h+0.02; g.add(trim);
    const roof = pyramidRoof(w+0.6,d+0.6,roofH,roofColor);
    roof.position.y = h + roofH/2 + 0.05;
    g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(w*0.28,h*0.55,0.1), mat(COLORS.woodDark));
    door.position.set(0, h*0.28, d/2+0.06);
    g.add(door);
    g.position.set(x,0,z); g.rotation.y = rotY;
    scene.add(g);
    return g;
  }

  const henHouse = building(-15,-6, 8,6,4.2, COLORS.barn, COLORS.roof, 2.6);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2,0.15,1.6), mat(COLORS.wood));
  ramp.rotation.x = -0.25; ramp.position.set(-15,0.35,-2.6);
  scene.add(ramp);

  (function(){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.25,0.7,6), mat(COLORS.woodDark,0.6,0.3));
    body.rotation.z = Math.PI/2; g.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.5,5), mat(0xB5482E,0.6,0.3));
    tail.position.set(-0.35,0.25,0); tail.rotation.z = Math.PI/1.3; g.add(tail);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,1.2,6), mat(COLORS.metal));
    pole.position.y=-0.6; g.add(pole);
    g.position.set(-15, henHouse.children[0].position.y + 2.9 + 0.05, -6);
    scene.add(g);
  })();

  // ---------- EXPLOITATION AGRICOLE (sans usine) ----------
  for(let i=0;i<6;i++){
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.52,0.52,0.75,12), mat(0xC9A24E,0.95,0));
    bale.rotation.z = Math.PI/2;
    bale.position.set(12.2+(i%3)*1.15, 0.52+Math.floor(i/3)*0.82, -6.6);
    bale.castShadow=true; scene.add(bale);
  }
  const grainBasket = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.52,0.55,12), mat(0x8A6642,0.9,0));
  grainBasket.position.set(11.5,0.28,-3.9); grainBasket.castShadow=true; scene.add(grainBasket);

  // Les œufs restent dans les nids : aucune usine ni tapis roulant.
  const eggGeo = new THREE.SphereGeometry(0.18,14,10);
  eggGeo.scale(1,1.32,1);
  const eggs = [];
  let eggCount = 0, fertileCount = 0;
  const eggCountEl = document.getElementById('eggCount');
  const fertileCountEl = document.getElementById('fertileCount');
  const eventEl = document.getElementById('event');
  function setFarmStatus(text){ if(eventEl) eventEl.textContent=text; }
  function updateEggStats(){
    eggCountEl.textContent = eggCount;
    fertileCountEl.textContent = fertileCount;
  }
  function spawnEgg(startPos, fertilized, mother, nestIndex){
    const color = fertilized ? 0xFFF0C2 : COLORS.egg;
    const e = new THREE.Mesh(eggGeo, smoothMat(color,0.42,0));
    e.castShadow = true; e.position.copy(startPos);
    scene.add(e);
    const egg={mesh:e, fertilized, mother, nestIndex, age:0, incubating:false};
    eggs.push(egg);
    eggCount++;
    if(fertilized) fertileCount++;
    updateEggStats();
    setFarmStatus(fertilized ? 'La poule a pondu un œuf fécondé : une couveuse va rester dessus.' : 'La poule a pondu un œuf. Il restera visible dans le nid avant le ramassage.');
    return egg;
  }
  function removeEgg(egg){
    scene.remove(egg.mesh);
    const i=eggs.indexOf(egg); if(i>=0) eggs.splice(i,1);
  }
  function eggInNest(index){ return eggs.find(e=>e.nestIndex===index); }

  // ---------- FENCE ----------
  const YARD = { xMin:-15.3, xMax:5.3, zMin:-7.3, zMax:12.3 };
  const FARM_GATE_Z = [-7.0, -5.0];

  function fencePost(x,z){
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,1.1,6), mat(COLORS.fence));
    p.position.set(x,0.55,z); p.castShadow=true; scene.add(p);
  }
  function fenceRail(x1,z1,x2,z2,y){
    const len = Math.hypot(x2-x1,z2-z1);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len,0.09,0.09), mat(COLORS.fence));
    rail.position.set((x1+x2)/2, y, (z1+z2)/2);
    rail.rotation.y = -Math.atan2(z2-z1, x2-x1);
    scene.add(rail);
  }
  function inGate(x,z){
    const sideGate = Math.abs(x-YARD.xMax) < 0.2 && z > FARM_GATE_Z[0] && z < FARM_GATE_Z[1];
    const humanGate = Math.abs(z-YARD.zMax) < 0.2 && x > -1.4 && x < 1.4;
    return sideGate || humanGate;
  }
  const fencePts = [[YARD.xMin,YARD.zMin],[YARD.xMax,YARD.zMin],[YARD.xMax,YARD.zMax],[YARD.xMin,YARD.zMax]];
  for(let i=0;i<fencePts.length;i++){
    const a=fencePts[i], b=fencePts[(i+1)%fencePts.length];
    const segs = Math.max(2, Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/1.8));
    for(let s=0;s<segs;s++){
      const t0=s/segs, t1=(s+1)/segs;
      const x0=a[0]+(b[0]-a[0])*t0, z0=a[1]+(b[1]-a[1])*t0;
      const x1v=a[0]+(b[0]-a[0])*t1, z1v=a[1]+(b[1]-a[1])*t1;
      if(inGate((x0+x1v)/2, (z0+z1v)/2)) continue;
      fencePost(x0,z0);
      fenceRail(x0,z0,x1v,z1v,0.8);
      fenceRail(x0,z0,x1v,z1v,0.35);
    }
    if(!inGate(b[0],b[1])) fencePost(b[0],b[1]);
  }

  const nestPositions = [
    new THREE.Vector3(-10.6, 0.32, -4.6),
    new THREE.Vector3(-10.6, 0.32, -4.0),
    new THREE.Vector3(-10.6, 0.32, -3.4)
  ];
  const strawTex1 = strawTexture(); strawTex1.repeat.set(2,2);
  const strawMat1 = new THREE.MeshStandardMaterial({map:strawTex1, roughness:0.95, metalness:0});
  nestPositions.forEach(p=>{
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.46,0.22,10), mat(COLORS.woodDark,0.8,0));
    base.position.set(p.x,0.11,p.z); base.castShadow=true; base.receiveShadow=true; scene.add(base);
    const straw = new THREE.Mesh(new THREE.SphereGeometry(0.36,10,6), strawMat1);
    straw.scale.set(1,0.45,1); straw.position.set(p.x,0.24,p.z); scene.add(straw);
    for(let i=0;i<6;i++){
      const wisp = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.5,3), mat(0xC9A24E,0.9,0));
      wisp.position.set(p.x+(Math.random()-0.5)*0.5, 0.3, p.z+(Math.random()-0.5)*0.5);
      wisp.rotation.set(Math.random()*0.6, Math.random()*Math.PI, Math.random()*0.6+1.1);
      scene.add(wisp);
    }
  });

  const broodNestPositions = [
    new THREE.Vector3(-1.4, 0.32, -1.6),
    new THREE.Vector3(0.0, 0.32, -1.6),
    new THREE.Vector3(1.4, 0.32, -1.6)
  ];
  const strawTex2 = strawTexture(); strawTex2.repeat.set(2,2);
  const strawMat2 = new THREE.MeshStandardMaterial({map:strawTex2, roughness:0.95, metalness:0});
  broodNestPositions.forEach(p=>{
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.5,0.24,10), mat(COLORS.woodDark,0.8,0));
    base.position.set(p.x,0.12,p.z); base.castShadow=true; base.receiveShadow=true; scene.add(base);
    const straw = new THREE.Mesh(new THREE.SphereGeometry(0.4,10,6), strawMat2);
    straw.scale.set(1,0.45,1); straw.position.set(p.x,0.26,p.z); scene.add(straw);
  });
  for(let x=-3.6; x<=3.6; x+=1.2){
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.5,6), mat(COLORS.fence));
    post.position.set(x,0.25,-3.0); post.castShadow=true; scene.add(post);
  }

  function tree(x,z,scale=1){
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.22,1.4,6), mat(COLORS.woodDark));
    trunk.position.y=0.7; trunk.castShadow=true; g.add(trunk);
    for(let i=0;i<3;i++){
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.9-i*0.15,8,6), mat(i%2?COLORS.leaf:COLORS.leafLight));
      foliage.position.set((Math.random()-0.5)*0.4, 1.5+i*0.55, (Math.random()-0.5)*0.4);
      foliage.castShadow = true;
      g.add(foliage);
    }
    g.position.set(x,0,z); g.scale.setScalar(scale);
    scene.add(g);
  }
  const treeSpots = [[-22,-14],[-24,4],[-20,16],[-2,-18],[10,18],[22,10],[24,-6],[-6,20],[18,-16],[-16,20],[26,2],[-28,-4]];
  treeSpots.forEach(([x,z])=>tree(x,z,0.8+Math.random()*0.6));

  function bush(x,z){
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.4,7,5), mat(COLORS.leaf));
    b.position.set(x,0.3,z); b.castShadow=true; scene.add(b);
  }
  for(let i=0;i<10;i++){
    const ang = Math.random()*Math.PI*2, r=9+Math.random()*3;
    bush(-2+Math.cos(ang)*r, 4+Math.sin(ang)*r);
  }
