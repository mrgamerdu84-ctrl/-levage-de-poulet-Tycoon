'use strict';
  // ---------- FEEDING TROUGH, WATER TROUGH & FARMERS ----------
  const troughPos = new THREE.Vector3(3, 0, 5.6);
  const trough = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.28,0.55), mat(COLORS.woodDark,0.8,0));
  trough.position.set(troughPos.x, 0.14, troughPos.z); trough.castShadow=true; scene.add(trough);

  const waterPos = new THREE.Vector3(3, 0, 4.1);
  const waterTub = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.6,0.28,14), mat(0x9a9a9a,0.4,0.5));
  waterTub.position.set(waterPos.x,0.14,waterPos.z); waterTub.castShadow=true; scene.add(waterTub);
  const waterSurface = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48,0.02,14), smoothMat(0x5B9BD5,0.25,0.6));
  waterSurface.position.set(waterPos.x,0.27,waterPos.z); scene.add(waterSurface);

  let feedPellets = [];
  function spawnFeed(){
    feedPellets.forEach(p=>scene.remove(p));
    feedPellets = [];
    for(let i=0;i<12;i++){
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.035,5,4), mat(0xC9A24E,0.9,0));
      p.position.set(troughPos.x+(Math.random()-0.5)*1.0, 0.06, troughPos.z-0.6+(Math.random()-0.5)*0.8);
      scene.add(p);
      feedPellets.push(p);
    }
  }
  function clearFeed(){
    feedPellets.forEach(p=>scene.remove(p));
    feedPellets = [];
  }

  function smoothMat(color, rough=0.7, metal=0){
    return new THREE.MeshStandardMaterial({color, roughness:rough, metalness:metal, flatShading:false});
  }

  function makeFarmer(hatColor){
    const g = new THREE.Group();
    const skin = smoothMat(0xE8B589,0.7,0);
    const denim = smoothMat(0x4C6B8A,0.8,0);
    const shirt = smoothMat(0xC96A3B,0.75,0);
    const straw = smoothMat(hatColor,0.8,0);

    const legGeoF = new THREE.CylinderGeometry(0.09,0.09,0.7,6);
    const legL = new THREE.Group(); const legR = new THREE.Group();
    const legMeshL = new THREE.Mesh(legGeoF, denim); legMeshL.position.y=-0.35; legMeshL.castShadow=true; legL.add(legMeshL);
    const legMeshR = new THREE.Mesh(legGeoF, denim); legMeshR.position.y=-0.35; legMeshR.castShadow=true; legR.add(legMeshR);
    legL.position.set(-0.12,0.7,0); legR.position.set(0.12,0.7,0);
    g.add(legL); g.add(legR);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.26,0.6,8), shirt);
    torso.position.y=1.02; torso.castShadow=true; g.add(torso);
    const overalls = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.5,0.16), denim);
    overalls.position.y=0.85; g.add(overalls);

    const armL = new THREE.Group(); const armR = new THREE.Group();
    const armMeshL = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.55,6), shirt); armMeshL.position.y=-0.275; armL.add(armMeshL);
    const armMeshR = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.55,6), shirt); armMeshR.position.y=-0.275; armR.add(armMeshR);
    armL.position.set(-0.28,1.25,0); armR.position.set(0.28,1.25,0);
    g.add(armL); g.add(armR);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18,10,8), skin);
    head.position.y=1.45; g.add(head);
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.04,12), straw);
    hatBrim.position.y=1.55; g.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.16,0.22,10), straw);
    hatTop.position.y=1.69; g.add(hatTop);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.08,0.18,8), mat(0x9a9a9a,0.5,0.4));
    bucket.position.set(0.44,0.95,0.1);
    armR.add(bucket);

    g.visible = false;
    scene.add(g);
    return {
      group:g, legL, legR, armL, armR,
      state:'offstage', timer: 5+Math.random()*5,
      start: new THREE.Vector3((Math.random()-0.5)*2, 0, YARD.zMax+4)
    };
  }
  const farmers = [makeFarmer(0xD9B36C), makeFarmer(0xB5824A)];
  farmers[0].group.visible = true;
  farmers[0].group.position.set(troughPos.x, 0, troughPos.z);
  farmers[0].state = 'feeding';
  farmers[0].timer = 6;
  spawnFeed();
  farmers[1].timer = 22 + Math.random()*8;

  function updateFarmer(f, dt, t){
    if(f.state==='offstage'){
      f.timer -= dt;
      if(f.timer<=0){
        f.state='entering';
        f.group.visible = true;
        f.group.position.copy(f.start);
      }
      return;
    }
    const dest = f.state==='entering' ? troughPos : f.start;
    if(f.state==='entering' || f.state==='leaving'){
      const dir = new THREE.Vector3(dest.x-f.group.position.x,0,dest.z-f.group.position.z);
      const dist = dir.length();
      if(dist>0.15){
        dir.normalize();
        f.group.position.x += dir.x*1.5*dt;
        f.group.position.z += dir.z*1.5*dt;
        f.group.rotation.y = Math.atan2(dir.x,dir.z);
        f.group.position.y = Math.abs(Math.sin(t*7))*0.03;
        const swing = Math.sin(t*7)*0.55;
        f.legL.rotation.x = swing; f.legR.rotation.x = -swing;
        f.armL.rotation.x = -swing*0.7; f.armR.rotation.x = swing*0.4;
      } else if(f.state==='entering'){
        f.state='feeding'; f.timer=4.5;
        f.legL.rotation.x=0; f.legR.rotation.x=0; f.armL.rotation.x=0; f.armR.rotation.x=0;
        spawnFeed();
        setFarmStatus('Le fermier vient de remplir la mangeoire.');
      } else {
        f.state='offstage'; f.group.visible=false;
        f.timer = 20+Math.random()*10;
      }
    } else if(f.state==='feeding'){
      f.timer -= dt;
      if(f.timer<=0) f.state='leaving';
    }
  }

  // ---------- CHICKENS ----------
  const bodyGeo = new THREE.SphereGeometry(0.42,12,10); bodyGeo.scale(1,0.82,1.3);
  const chestGeo = new THREE.SphereGeometry(0.3,10,8); chestGeo.scale(0.9,0.9,0.8);
  const headGeo = new THREE.SphereGeometry(0.19,10,8);
  const beakGeo = new THREE.ConeGeometry(0.055,0.15,6);
  const wattleGeo = new THREE.SphereGeometry(0.045,6,5); wattleGeo.scale(0.7,1.3,0.7);
  const eyeWhiteGeo = new THREE.SphereGeometry(0.052,10,8);
  const pupilGeo = new THREE.SphereGeometry(0.027,10,8);
  const wingGeo = new THREE.SphereGeometry(0.22,7,6); wingGeo.scale(0.45,1,1.15);
  const tailGeo = new THREE.ConeGeometry(0.09,0.42,5);
  const legGeo = new THREE.CylinderGeometry(0.028,0.035,0.32,5);
  const footGeo = new THREE.BoxGeometry(0.16,0.02,0.09);
  const combGeo = new THREE.ConeGeometry(0.045,0.12,4);

  function chicken(homeX,homeZ,color){
    const g = new THREE.Group();
    const scale = 0.9 + Math.random()*0.25;
    const darkHex = new THREE.Color(color).multiplyScalar(0.8).getHex();
    const featTex1 = featherTexture(color, darkHex); featTex1.repeat.set(3,3);
    const featTex2 = featherTexture(darkHex, color); featTex2.repeat.set(3,3);
    const cm = new THREE.MeshStandardMaterial({map:featTex1, roughness:0.85, metalness:0});
    const darkCm = new THREE.MeshStandardMaterial({map:featTex2, roughness:0.85, metalness:0});

    const body = new THREE.Mesh(bodyGeo, cm); body.position.y=0.5; body.castShadow=true; g.add(body);
    const chest = new THREE.Mesh(chestGeo, cm); chest.position.set(0,0.42,0.28); chest.castShadow=true; g.add(chest);

    for(let i=-1;i<=1;i++){
      const tail = new THREE.Mesh(tailGeo, darkCm);
      tail.position.set(i*0.09, 0.72+Math.abs(i)*0.05, -0.5);
      tail.rotation.x = -1.15; tail.rotation.z = i*0.25;
      tail.castShadow = true;
      g.add(tail);
    }

    const headGroup = new THREE.Group();
    const head = new THREE.Mesh(headGeo, cm); headGroup.add(head);
    const beak = new THREE.Mesh(beakGeo, smoothMat(0xE0A030,0.5,0));
    beak.rotation.x = Math.PI/2; beak.position.set(0,-0.01,0.22); headGroup.add(beak);
    const wattle = new THREE.Mesh(wattleGeo, smoothMat(0xC23B3B,0.5,0));
    wattle.position.set(0,-0.14,0.17); headGroup.add(wattle);
    [-0.105,0.105].forEach(sx=>{
      const white = new THREE.Mesh(eyeWhiteGeo, smoothMat(0xFFFDF5,0.2,0));
      white.position.set(sx,0.045,0.165); headGroup.add(white);
      const pupil = new THREE.Mesh(pupilGeo, smoothMat(0x16110D,0.15,0));
      pupil.position.set(sx,0.045,0.207); headGroup.add(pupil);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.008,6,5), smoothMat(0xFFFFFF,0.05,0));
      shine.position.set(sx-0.007,0.057,0.232); headGroup.add(shine);
    });
    for(let i=-1;i<=1;i++){
      const comb = new THREE.Mesh(combGeo, smoothMat(0xC23B3B,0.5,0));
      comb.position.set(i*0.05,0.18+Math.abs(i)*-0.02,0);
      headGroup.add(comb);
    }
    headGroup.position.set(0,0.87,0.3);
    g.add(headGroup);

    [-1,1].forEach(side=>{
      const wing = new THREE.Mesh(wingGeo, darkCm);
      wing.position.set(side*0.34,0.5,-0.03); wing.rotation.y = side*0.35;
      wing.castShadow = true;
      g.add(wing);
    });

    const legs = [];
    [-0.13,0.13].forEach(sx=>{
      const legGroup = new THREE.Group();
      const leg = new THREE.Mesh(legGeo, smoothMat(0xD9922E,0.5,0));
      leg.position.y = -0.16; legGroup.add(leg);
      const foot = new THREE.Mesh(footGeo, smoothMat(0xD9922E,0.5,0));
      foot.position.set(0,-0.32,0.03); legGroup.add(foot);
      legGroup.position.set(sx,0.34,0);
      g.add(legGroup); legs.push(legGroup);
    });

    g.scale.setScalar(scale);
    g.position.set(homeX,0,homeZ);
    scene.add(g);
    return {
      group:g, legs, head:headGroup,
      home:[homeX,homeZ],
      phase:Math.random()*Math.PI*2,
      radius: 1.1+Math.random()*1.4,
      speed: 0.12+Math.random()*0.12,
      state:'wander',
      stateTimer: 3+Math.random()*8,
      target:new THREE.Vector3(),
      baseScale: scale,
      fed:false, hydrated:false
    };
  }

  const chickenColors = [0xF5EFE0, 0xB5824A, 0x8A5A34, 0xE8D9B5, 0xF0E6C8, 0x6B4A32];
  const chickens = [];
  for(let i=0;i<6;i++){
    const ang = (i/6)*Math.PI*2;
    const hx = Math.min(YARD.xMax-0.8, Math.max(-9, -1+Math.cos(ang)*5));
    const hz = Math.min(YARD.zMax-0.8, Math.max(1, 5+Math.sin(ang)*4));
    const c = chicken(hx, hz, chickenColors[i]);
    c.role = 'hen';
    c.broody = i >= 3;
    c.nestIndex = i;
    c.nest = i < 3 ? nestPositions[i] : broodNestPositions[i-3];
    c.fertileUntil = 0;
    c.pauseUntil = 0;
    c.currentEgg = null;
    c.group.userData.bird = c;
    chickens.push(c);
  }

  function makeRooster(x,z){
    const r = chicken(x,z, 0x2E2A1E);
    r.role = 'rooster';
    r.baseScale = 1.35;
    r.group.scale.setScalar(r.baseScale);
    r.radius = 2.4; r.speed = 0.08;
    const bigComb = new THREE.Mesh(new THREE.ConeGeometry(0.06,0.24,5), smoothMat(0xD62828,0.4,0));
    bigComb.position.set(0,0.3,0.02); r.head.add(bigComb);
    const bigWattle = new THREE.Mesh(new THREE.SphereGeometry(0.075,6,5), smoothMat(0xD62828,0.4,0));
    bigWattle.scale.set(0.7,1.5,0.7); bigWattle.position.set(0,-0.22,0.18); r.head.add(bigWattle);
    const featherGeo = new THREE.ConeGeometry(0.05,0.8,5);
    for(let i=-2;i<=2;i++){
      const f = new THREE.Mesh(featherGeo, smoothMat(0x1E5C3A,0.35,0.2));
      f.position.set(i*0.07, 0.88+Math.abs(i)*0.05, -0.55);
      f.rotation.x = -1.3 - Math.abs(i)*0.08;
      f.rotation.z = i*0.18;
      f.castShadow = true;
      r.group.add(f);
    }
    r.group.userData.bird = r;
    chickens.push(r);
    return r;
  }
  const rooster = makeRooster(-3, 8);
  rooster.courtshipTarget = null;
  rooster.stateTimer = 5;
  const hens = chickens.filter(c=>c.role==='hen');

  const chickBodyGeo = new THREE.SphereGeometry(0.16,8,6); chickBodyGeo.scale(1,0.9,1.1);
  const chickHeadGeo = new THREE.SphereGeometry(0.1,8,6);
  const chickBeakGeo = new THREE.ConeGeometry(0.025,0.06,5);
  const chickLegGeo = new THREE.CylinderGeometry(0.012,0.012,0.1,4);
  const chicks = [];
  function spawnChick(pos){
    const g = new THREE.Group();
    const cm = smoothMat(0xF3D65A,0.7,0);
    const body = new THREE.Mesh(chickBodyGeo, cm); body.position.y=0.16; body.castShadow=true; g.add(body);
    const head = new THREE.Mesh(chickHeadGeo, cm); head.position.set(0,0.28,0.1); g.add(head);
    [-0.048,0.048].forEach(sx=>{
      const ew=new THREE.Mesh(new THREE.SphereGeometry(0.027,8,6),smoothMat(0xFFFDF5,0.2,0));
      ew.position.set(sx,0.30,0.185); g.add(ew);
      const ep=new THREE.Mesh(new THREE.SphereGeometry(0.015,8,6),smoothMat(0x17120F,0.1,0));
      ep.position.set(sx,0.30,0.207); g.add(ep);
    });
    const beak = new THREE.Mesh(chickBeakGeo, smoothMat(0xE0A030,0.5,0));
    beak.rotation.x=Math.PI/2; beak.position.set(0,0.27,0.19); g.add(beak);
    [-0.05,0.05].forEach(sx=>{
      const leg = new THREE.Mesh(chickLegGeo, smoothMat(0xE0A030,0.5,0));
      leg.position.set(sx,0.06,0); g.add(leg);
    });
    g.position.set(pos.x,0,pos.z);
    scene.add(g);
    chicks.push({group:g, home:[pos.x,pos.z], seed:Math.random()*Math.PI*2});
    const chickCountEl = document.getElementById('chickCount');
    if(chickCountEl) chickCountEl.textContent = chicks.length;
  }
