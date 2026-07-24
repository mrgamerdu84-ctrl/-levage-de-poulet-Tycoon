'use strict';
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || typeof renderer === 'undefined') return;

  window.FARM_WORLD_EXPANSION_V4_ACTIVE = true;

  const ROOT_NAME = 'farm-world-expansion-v4';
  const STORAGE_KEY = 'elevage.world.expansion.v4';
  const SYSTEM_KEY = 'elevage.systems.v1';
  const HORN_URL = 'https://commons.wikimedia.org/wiki/Special:FilePath/Car_Horn.wav';
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_LABEL = { spring:'Printemps', summer:'Été', autumn:'Automne', winter:'Hiver' };
  const WEATHER_LABEL = { sun:'☀️ Soleil', rain:'🌧️ Pluie', snow:'❄️ Neige', heat:'🔥 Canicule' };
  const HAZARDOUS = new Set(['rain', 'snow', 'heat']);
  const BARN_ENTRY = new THREE.Vector3(13, 0, 10.55);
  const BARN_INSIDE = new THREE.Vector3(13, 0, 13.45);
  const HOUSE_DOOR = new THREE.Vector3(-10.5, 0, -14.9);
  const NEST_POINT = new THREE.Vector3(-10.55, 0, -4);

  const oldRoot = scene.getObjectByName(ROOT_NAME);
  if (oldRoot && oldRoot.parent) oldRoot.parent.remove(oldRoot);

  const root = new THREE.Group();
  root.name = ROOT_NAME;
  scene.add(root);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  if (typeof THREE.sRGBEncoding !== 'undefined') renderer.outputEncoding = THREE.sRGBEncoding;
  if (typeof THREE.ACESFilmicToneMapping !== 'undefined') {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
  }

  const climate = {
    season: 'spring', seasonIndex: 0, seasonTimer: 210,
    weather: 'sun', weatherTimer: 55,
    wetness: 0, snow: 0, heat: 0, bloom: 0
  };

  const logistics = {
    eggs: 0, milk: 0, ham: 0, wool: 0, duck: 0,
    deliveries: 0, totalRevenue: 0, lastRevenue: 0,
    truckState: 'dans les montagnes', nextTruck: 30
  };

  const workers = [];
  const animals = [];
  const shelter = new Map();
  const puddles = [];
  const crates = [];
  const clouds = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  let truck = null;
  let routeCurve = null;
  let rain = null;
  let snow = null;
  let flowers = null;
  let ground = null;
  let groundColor = new THREE.Color(0x7fa65c);
  let scanTimer = 0;
  let hudTimer = 0;
  let saveTimer = 0;
  let productionTimer = 18;
  let lastEggCounter = typeof eggCount === 'number' ? eggCount : 0;
  let lastFrame = performance.now();
  let pointerDown = null;
  let audioUnlocked = false;
  let pendingHorn = false;

  function mat(color, roughness = 0.88, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading:false });
  }

  function mesh(geometry, material, x, y, z, scale, rotation) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    if (scale) object.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
    object.castShadow = true;
    object.receiveShadow = true;
    return object;
  }

  function notify(message) {
    if (typeof setFarmStatus === 'function') setFarmStatus(message);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (SEASONS.includes(saved.season)) {
        climate.season = saved.season;
        climate.seasonIndex = SEASONS.indexOf(saved.season);
      }
      if (Object.prototype.hasOwnProperty.call(WEATHER_LABEL, saved.weather)) climate.weather = saved.weather;
      climate.seasonTimer = Math.max(15, Number(saved.seasonTimer) || climate.seasonTimer);
      climate.weatherTimer = Math.max(8, Number(saved.weatherTimer) || climate.weatherTimer);
      ['eggs','milk','ham','deliveries','totalRevenue'].forEach(key => {
        logistics[key] = Math.max(0, Number(saved[key]) || 0);
      });
    } catch (_) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        season: climate.season,
        seasonTimer: climate.seasonTimer,
        weather: climate.weather,
        weatherTimer: climate.weatherTimer,
        eggs: logistics.eggs,
        milk: logistics.milk,
        ham: logistics.ham,
        deliveries: logistics.deliveries,
        totalRevenue: logistics.totalRevenue
      }));
    } catch (_) {}
  }

  function saveCoins() {
    if (!window.farmEconomyState) return;
    try {
      const saved = JSON.parse(localStorage.getItem(SYSTEM_KEY) || '{}');
      saved.coins = Math.max(0, Math.floor(Number(window.farmEconomyState.coins) || 0));
      localStorage.setItem(SYSTEM_KEY, JSON.stringify(saved));
    } catch (_) {}
  }

  function smoothScene() {
    const anisotropy = renderer.capabilities && renderer.capabilities.getMaxAnisotropy
      ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    scene.traverse(object => {
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (!material) return;
        if (material.map) material.map.anisotropy = anisotropy;
        if (material.isMeshStandardMaterial) {
          material.flatShading = false;
          material.roughness = Math.max(0.55, Math.min(1, material.roughness || 0.88));
          material.needsUpdate = true;
        }
      });
    });
  }

  function findGround() {
    let area = 0;
    scene.traverse(object => {
      if (!object.isMesh || !object.geometry || !object.material) return;
      const p = object.geometry.parameters || {};
      const current = Number(p.width || 0) * Number(p.height || 0);
      if (object.geometry.type === 'PlaneGeometry' && current > area) {
        ground = object;
        area = current;
      }
    });
    if (ground) {
      const material = Array.isArray(ground.material) ? ground.material[0] : ground.material;
      if (material && material.color) groundColor = material.color.clone();
    }
  }

  function dirtTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#98704c';
    ctx.fillRect(0, 0, 192, 192);
    for (let i = 0; i < 1100; i += 1) {
      const tone = 70 + Math.floor(Math.random() * 90);
      ctx.fillStyle = `rgba(${tone+54},${tone+29},${tone+8},${0.08+Math.random()*0.2})`;
      ctx.fillRect(Math.random()*192, Math.random()*192, 1+Math.random()*2, 1+Math.random()*2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  const roadTexture = dirtTexture();

  function roadSegment(x1, z1, x2, z2, width) {
    const dx = x2-x1, dz = z2-z1, length = Math.hypot(dx,dz);
    const texture = roadTexture.clone();
    texture.needsUpdate = true;
    texture.repeat.set(Math.max(1,width/2), Math.max(1,length/4));
    const material = new THREE.MeshStandardMaterial({
      map:texture, roughness:1, polygonOffset:true, polygonOffsetFactor:4, polygonOffsetUnits:4
    });
    const road = mesh(
      new THREE.BoxGeometry(width,0.022,length), material,
      (x1+x2)/2,0.011,(z1+z2)/2,null,[0,Math.atan2(dx,dz),0]
    );
    road.castShadow = false;
    road.renderOrder = -30;
    road.userData.farmRoad = true;
    root.add(road);
  }

  function buildSafeRoads() {
    const obsolete = [];
    scene.traverse(object => {
      if (object.userData && object.userData.farmRoad) obsolete.push(object);
    });
    obsolete.forEach(object => object.parent && object.parent.remove(object));

    roadSegment(20,-40,20,24,5.2);
    roadSegment(-29,-23,28,-23,5.2);
    roadSegment(-18,22.5,20,22.5,4.0);
    roadSegment(-10.5,-23,-10.5,-15.8,2.7);
    roadSegment(20,-15.6,13.6,-15.6,3.4);
    roadSegment(20,-6,5.9,-6,3.0);
    roadSegment(20,0,15.4,0,2.6);
    roadSegment(0,22.5,0,21.2,2.1);
    roadSegment(-11.5,22.5,-11.5,20.2,2.1);
  }

  function mountainRoad() {
    const points = [
      [46,-40],[39,-34],[33,-29],[37,-23],[29,-19],[24,-23],[20,-18],[16,-17],[13.2,-15.15]
    ].map(p => new THREE.Vector3(p[0],0.045,p[1]));
    routeCurve = new THREE.CatmullRomCurve3(points,false,'catmullrom',0.35);
    const positions = [], uvs = [], indices = [], segments = 110, width = 4.4;
    for (let i=0;i<=segments;i+=1) {
      const t=i/segments, point=routeCurve.getPointAt(t), tangent=routeCurve.getTangentAt(t).normalize();
      const side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
      const left=point.clone().addScaledVector(side,width/2), right=point.clone().addScaledVector(side,-width/2);
      positions.push(left.x,left.y,left.z,right.x,right.y,right.z);
      uvs.push(0,t*15,1,t*15);
      if(i<segments){const b=i*2;indices.push(b,b+2,b+1,b+1,b+2,b+3);}
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const texture=roadTexture.clone();texture.needsUpdate=true;texture.repeat.set(1,15);
    const road=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,roughness:1,polygonOffset:true,polygonOffsetFactor:4,polygonOffsetUnits:4}));
    road.receiveShadow=true;road.castShadow=false;road.renderOrder=-30;root.add(road);
  }

  function buildHouse() {
    const group=new THREE.Group(), stone=mat(0x817463,.98), wall=mat(0xd9b991,.94), wood=mat(0x66442e,.92), trim=mat(0xf3ead7,.9), roof=mat(0x93482f,.9);
    const glass=new THREE.MeshStandardMaterial({color:0x9ed2e3,roughness:.2,metalness:.08,transparent:true,opacity:.82});
    group.add(mesh(new THREE.BoxGeometry(7.5,.65,5.6),stone,0,.33,0));
    group.add(mesh(new THREE.BoxGeometry(7.1,3.8,5.2),wall,0,2.18,0));
    group.add(mesh(new THREE.BoxGeometry(7.9,.28,3.5),roof,0,4.45,-1.35,null,[.62,0,0]));
    group.add(mesh(new THREE.BoxGeometry(7.9,.28,3.5),roof,0,4.45,1.35,null,[-.62,0,0]));
    group.add(mesh(new THREE.BoxGeometry(4.6,.28,1.55),wood,0,.26,3.2));
    group.add(mesh(new THREE.BoxGeometry(1.18,2.35,.16),wood,0,1.48,2.66));
    [-2.25,2.25].forEach(x=>{
      const frame=mesh(new THREE.BoxGeometry(1.65,1.6,.18),trim,x,2.1,2.63);
      frame.add(mesh(new THREE.BoxGeometry(1.37,1.32,.08),glass,0,0,.1));
      frame.add(mesh(new THREE.BoxGeometry(.08,1.32,.1),trim,0,0,.18));
      frame.add(mesh(new THREE.BoxGeometry(1.37,.08,.1),trim,0,0,.18));
      group.add(frame);
    });
    group.add(mesh(new THREE.BoxGeometry(.75,2.2,.75),stone,2.25,5.3,-.7));
    group.position.set(-10.5,0,-18.1);root.add(group);
    const lamp=new THREE.PointLight(0xffd28a,.45,8);lamp.position.set(-10.5,2.8,-14.7);root.add(lamp);
  }

  function buildDock() {
    const dock=new THREE.Group(), timber=mat(0x73513a,.95), metal=mat(0x757d80,.56,.35);
    dock.add(mesh(new THREE.BoxGeometry(6.2,.5,2.6),timber,0,.25,0));
    dock.add(mesh(new THREE.BoxGeometry(6.3,.14,.14),metal,0,.54,-1.2));
    [-2.6,0,2.6].forEach(x=>dock.add(mesh(new THREE.CylinderGeometry(.09,.11,1.1,8),timber,x,.55,0)));
    dock.position.set(13.2,0,-13.2);root.add(dock);
  }

  function buildWeather() {
    const cloudGeometry=new THREE.SphereGeometry(1,12,8);
    for(let i=0;i<6;i+=1){
      const group=new THREE.Group();
      const material=new THREE.MeshStandardMaterial({color:0xf7fbff,roughness:1,transparent:true,opacity:.88,depthWrite:false});
      for(let p=0;p<6;p+=1){
        const puff=mesh(cloudGeometry,material,(p-2.5)*1.15,Math.sin(p/5*Math.PI)*.7,(Math.random()-.5),[1.45+Math.random()*.4,.75+Math.random()*.3,1.15+Math.random()*.35]);
        puff.castShadow=false;puff.receiveShadow=false;group.add(puff);
      }
      group.position.set(-42+Math.random()*84,29+i*1.8,-34+Math.random()*64);
      group.scale.setScalar(.8+Math.random()*.5);group.userData.speed=.18+Math.random()*.14;group.userData.material=material;root.add(group);clouds.push(group);
    }

    const rc=600, rp=new Float32Array(rc*6);
    for(let i=0;i<rc;i+=1){const o=i*6,x=(Math.random()-.5)*68,y=2+Math.random()*27,z=(Math.random()-.5)*68;rp[o]=x;rp[o+1]=y;rp[o+2]=z;rp[o+3]=x+.05;rp[o+4]=y-.7;rp[o+5]=z+.03;}
    const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(rp,3));
    rain=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xccecff,transparent:true,opacity:.46,depthWrite:false}));rain.visible=false;rain.frustumCulled=false;root.add(rain);

    const sc=500, sp=new Float32Array(sc*3);
    for(let i=0;i<sc;i+=1){sp[i*3]=(Math.random()-.5)*68;sp[i*3+1]=2+Math.random()*27;sp[i*3+2]=(Math.random()-.5)*68;}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
    snow=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:.13,transparent:true,opacity:.9,depthWrite:false}));snow.visible=false;snow.frustumCulled=false;root.add(snow);

    for(let i=0;i<20;i+=1){
      const puddle=mesh(new THREE.CircleGeometry(1,20),new THREE.MeshStandardMaterial({color:0x6faed7,roughness:.22,metalness:.08,transparent:true,opacity:0}),-24+Math.random()*48,.06,-20+Math.random()*42,[.7+Math.random()*1.4,.5+Math.random()*.9,1],[-Math.PI/2,0,Math.random()*Math.PI]);
      puddle.visible=false;puddle.castShadow=false;puddle.userData.base=puddle.scale.clone();root.add(puddle);puddles.push(puddle);
    }

    const count=90, stemGeo=new THREE.CylinderGeometry(.018,.023,.28,5), petalGeo=new THREE.SphereGeometry(.07,7,5);
    const stems=new THREE.InstancedMesh(stemGeo,mat(0x4f8f3d,.94),count), petals=new THREE.InstancedMesh(petalGeo,mat(0xe9838f,.88),count);
    const matrix=new THREE.Matrix4(), pos=new THREE.Vector3(), quat=new THREE.Quaternion(), scale=new THREE.Vector3();
    for(let i=0;i<count;i+=1){const x=-27+Math.random()*54,z=-20+Math.random()*44;quat.setFromEuler(new THREE.Euler(0,Math.random()*Math.PI,0));pos.set(x,.14,z);scale.setScalar(.8+Math.random()*.7);matrix.compose(pos,quat,scale);stems.setMatrixAt(i,matrix);pos.set(x,.33,z);scale.setScalar(.7+Math.random()*.9);matrix.compose(pos,quat,scale);petals.setMatrixAt(i,matrix);}
    stems.instanceMatrix.needsUpdate=true;petals.instanceMatrix.needsUpdate=true;flowers=new THREE.Group();flowers.add(stems,petals);flowers.visible=false;root.add(flowers);
  }

  function createWorker(index) {
    const group=new THREE.Group(), skin=mat(index?0xc98f67:0xe1aa7c,.76), denim=mat(index?0x425f78:0x4f7191,.88), shirt=mat(index?0xb7553d:0xc46d3d,.86), boots=mat(0x493429,.94), straw=mat(0xd6b56c,.92), metal=mat(0x70787b,.5,.4), wood=mat(0x765039,.92);
    const leftLeg=new THREE.Group(),rightLeg=new THREE.Group(),leftArm=new THREE.Group(),rightArm=new THREE.Group();
    [-1,1].forEach(side=>{const leg=side<0?leftLeg:rightLeg;leg.position.set(side*.14,.72,0);leg.add(mesh(new THREE.CylinderGeometry(.085,.095,.68,9),denim,0,-.3,0));leg.add(mesh(new THREE.SphereGeometry(1,10,7),boots,0,-.69,.09,[.12,.08,.2]));group.add(leg);});
    group.add(mesh(new THREE.CylinderGeometry(.22,.29,.68,11),shirt,0,1.12,0));
    [-1,1].forEach(side=>{const arm=side<0?leftArm:rightArm;arm.position.set(side*.31,1.35,0);arm.add(mesh(new THREE.CylinderGeometry(.055,.065,.58,9),shirt,0,-.27,0));arm.add(mesh(new THREE.SphereGeometry(.075,10,7),skin,0,-.59,0));group.add(arm);});
    group.add(mesh(new THREE.SphereGeometry(.2,16,12),skin,0,1.62,0));group.add(mesh(new THREE.CylinderGeometry(.34,.34,.045,18),straw,0,1.78,0));group.add(mesh(new THREE.CylinderGeometry(.17,.2,.22,16),straw,0,1.9,0));
    const fork=new THREE.Group();fork.add(mesh(new THREE.CylinderGeometry(.025,.025,1.18,7),wood,0,-.45,0));[-.12,-.04,.04,.12].forEach(x=>fork.add(mesh(new THREE.CylinderGeometry(.012,.012,.34,6),metal,x,-1.08,0)));fork.add(mesh(new THREE.BoxGeometry(.3,.04,.04),metal,0,-.92,0));fork.position.set(0,-.55,.08);rightArm.add(fork);
    const basket=new THREE.Group();basket.add(mesh(new THREE.CylinderGeometry(.2,.15,.22,12),wood,0,0,0));basket.position.set(0,-.62,.08);basket.visible=false;leftArm.add(basket);
    group.position.copy(HOUSE_DOOR).add(new THREE.Vector3(index*.65,0,0));root.add(group);
    return {group,leftLeg,rightLeg,leftArm,rightArm,fork,basket,state:'wait',wait:3+index*5,taskIndex:index,path:[],waypoint:0,action:0,speed:1.42+index*.07,phase:Math.random()*6.28,status:'à la maison'};
  }

  const tasks=[
    {name:'paille l’enclos des vaches',type:'straw',target:new THREE.Vector3(6.2,0,3.7),path:[[-7.8,-12.4],[-2,3.2],[5.8,3.7]]},
    {name:'nourrit les poules',type:'feed',target:new THREE.Vector3(3.1,0,5.5),path:[[-7.8,-12.4],[-2,3.2],[3.1,5.5]]},
    {name:'paille l’enclos des moutons',type:'straw',target:new THREE.Vector3(0,0,13.9),path:[[-7.8,-12.4],[-2,3.2],[0,13.9]]},
    {name:'nourrit les cochons',type:'feed',target:new THREE.Vector3(3.1,0,-9.25),path:[[-7.8,-12.4],[.5,-10.3],[3.1,-9.25]]},
    {name:'ramasse les œufs dans les nids',type:'eggs',target:NEST_POINT.clone(),path:[[-8.1,-12.2],[-7.3,-7.4],[-9.35,-4.2],[-10.55,-4]]},
    {name:'remplit l’eau des canards',type:'water',target:new THREE.Vector3(-10.6,0,14.05),path:[[-8.1,-12.2],[-2,3.2],[-10.6,14.05]]}
  ];

  function collectableEggs(){return typeof eggs!=='undefined'&&Array.isArray(eggs)?eggs.filter(e=>e&&e.mesh&&e.mesh.visible!==false&&!e.incubating):[];}

  function startTask(worker){
    let task=null,tries=0;
    while(tries<tasks.length){task=tasks[worker.taskIndex%tasks.length];worker.taskIndex+=1;tries+=1;if(task.type!=='eggs'||collectableEggs().length)break;task=null;}
    if(!task){worker.wait=5;return;}
    worker.task=task;worker.path=task.path.map(p=>new THREE.Vector3(p[0],0,p[1]));worker.waypoint=0;worker.state='walk';worker.status=task.name;worker.fork.visible=task.type==='straw'||task.type==='feed';worker.basket.visible=task.type==='eggs';
  }

  function walkWorker(worker,target,dt,time){const dx=target.x-worker.group.position.x,dz=target.z-worker.group.position.z,d=Math.hypot(dx,dz);if(d<.16)return true;const s=Math.min(d,worker.speed*dt);worker.group.position.x+=dx/d*s;worker.group.position.z+=dz/d*s;worker.group.rotation.y=Math.atan2(dx,dz);worker.group.position.y=Math.abs(Math.sin(time*7.4+worker.phase))*.025;const stride=Math.sin(time*7.4+worker.phase)*.58;worker.leftLeg.rotation.x=stride;worker.rightLeg.rotation.x=-stride;worker.leftArm.rotation.x=-stride*.62;worker.rightArm.rotation.x=stride*.42;return false;}

  function finishEggs(){const list=collectableEggs();list.forEach(egg=>{if(typeof removeEgg==='function')removeEgg(egg);else if(egg.mesh.parent)egg.mesh.parent.remove(egg.mesh);});if(list.length)notify(`Le fermier a ramassé ${list.length} œuf${list.length>1?'s':''} directement dans les nids.`);}

  function updateWorker(worker,dt,time){
    if(worker.state==='wait'){worker.wait-=dt;if(worker.wait<=0)startTask(worker);return;}
    if(worker.state==='walk'||worker.state==='return'){
      const target=worker.path[worker.waypoint];
      if(!target){if(worker.state==='walk'){worker.state='act';worker.action=worker.task.type==='eggs'?3.2:3.8;}else{worker.state='wait';worker.wait=8+Math.random()*10;worker.status='à la maison';worker.task=null;worker.fork.visible=true;worker.basket.visible=false;}return;}
      if(walkWorker(worker,target,dt,time))worker.waypoint+=1;return;
    }
    if(worker.state!=='act')return;
    worker.action-=dt;const wave=Math.sin(time*7.5);worker.group.position.y=0;
    if(worker.task.type==='straw'){worker.rightArm.rotation.x=-1+wave*.34;worker.leftArm.rotation.x=-.45;worker.fork.rotation.z=-.55+wave*.18;}
    else if(worker.task.type==='feed'){worker.rightArm.rotation.x=-.65+wave*.18;worker.fork.rotation.z=-.8;}
    else if(worker.task.type==='water'){worker.rightArm.rotation.x=-.72+wave*.16;}
    else{worker.rightArm.rotation.x=-.95+wave*.13;worker.leftArm.rotation.x=-.82;}
    if(worker.action>0)return;
    if(worker.task.type==='eggs')finishEggs();worker.rightArm.rotation.x=0;worker.leftArm.rotation.x=0;worker.fork.rotation.z=0;worker.state='return';worker.path=[worker.task.target.clone(),new THREE.Vector3(-7.8,0,-12.4),HOUSE_DOOR.clone()];worker.waypoint=0;worker.status='retourne à la maison';
  }

  function makeTruck(){
    const group=new THREE.Group(), red=mat(0xb84a38,.78,.05), cream=mat(0xf0dfbd,.88), dark=mat(0x282b2d,.75,.2), metal=mat(0x747b7e,.52,.42);
    const glass=new THREE.MeshStandardMaterial({color:0x8fc2d7,roughness:.2,metalness:.12,transparent:true,opacity:.84});
    group.add(mesh(new THREE.BoxGeometry(2.5,.32,5.6),dark,0,.7,0));
    const cabin=mesh(new THREE.BoxGeometry(2.35,1.8,1.9),red,0,1.72,1.65);cabin.add(mesh(new THREE.BoxGeometry(1.9,.68,.08),glass,0,.25,.99));group.add(cabin);
    group.add(mesh(new THREE.BoxGeometry(2.18,.78,1.1),red,0,1.08,2.55));group.add(mesh(new THREE.BoxGeometry(2.45,1.85,3.5),cream,0,1.62,-1.05));
    const wheels=[];[-1.17,1.17].forEach(side=>[1.65,-1.35].forEach(z=>{const wheel=mesh(new THREE.CylinderGeometry(.48,.48,.28,18),dark,side,.58,z,null,[0,0,Math.PI/2]);wheel.add(mesh(new THREE.CylinderGeometry(.22,.22,.3,14),metal,0,0,0));group.add(wheel);wheels.push(wheel);}));
    group.traverse(object=>object.userData.truckClickable=true);group.visible=false;root.add(group);
    return {group,wheels,state:'waiting',progress:0,speed:.055,wheel:0,loading:0,revenue:0,next:30,status:'dans les montagnes'};
  }

  function buildCrates(){const wood=mat(0x825839,.94),dark=mat(0x5e3f2c,.96);for(let i=0;i<12;i+=1){const crate=new THREE.Group();crate.add(mesh(new THREE.BoxGeometry(.82,.52,.66),wood,0,0,0));[-.3,0,.3].forEach(x=>crate.add(mesh(new THREE.BoxGeometry(.09,.55,.7),dark,x,0,0)));crate.position.set(10.9+i%4*.92,.35+Math.floor(i/4)*.58,-12.55);crate.visible=false;root.add(crate);crates.push(crate);}}
  function updateCrates(){const total=logistics.eggs+logistics.milk+logistics.ham,visible=Math.min(crates.length,Math.ceil(total/5));crates.forEach((c,i)=>c.visible=i<visible);}

  function hornFallback(){const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const c=new A(),o1=c.createOscillator(),o2=c.createOscillator(),g=c.createGain(),t=c.currentTime;o1.type='sawtooth';o2.type='square';o1.frequency.value=190;o2.frequency.value=245;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.18,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.55);o1.connect(g);o2.connect(g);g.connect(c.destination);o1.start(t);o2.start(t);o1.stop(t+.58);o2.stop(t+.58);}
  function playHorn(){if(!audioUnlocked){pendingHorn=true;return;}const audio=new Audio(HORN_URL);audio.volume=.72;const promise=audio.play();if(promise&&promise.catch)promise.catch(hornFallback);}

  function beginLoad(){if(!truck||truck.state!=='waitingPlayer')return;const e=Math.floor(logistics.eggs),m=Math.floor(logistics.milk),h=Math.floor(logistics.ham);if(e+m+h<=0){notify('Le camion attend, mais aucun produit n’est prêt.');return;}logistics.eggs-=e;logistics.milk-=m;logistics.ham-=h;truck.revenue=e*8+m*14+h*22;truck.loading=2.8;truck.state='loading';truck.status='chargement manuel en cours';logistics.truckState=truck.status;updateCrates();notify(`Chargement : ${e} œufs, ${m} lait, ${h} jambon.`);}
  function completeSale(){const revenue=Math.max(0,Math.floor(truck.revenue));if(window.farmEconomyState&&revenue){window.farmEconomyState.coins=Number(window.farmEconomyState.coins||0)+revenue;saveCoins();}logistics.lastRevenue=revenue;logistics.totalRevenue+=revenue;logistics.deliveries+=1;truck.state='leaving';truck.status='repart vers les montagnes';logistics.truckState=truck.status;notify(`Le camion repart avec la marchandise : +${revenue} pièces.`);}

  function updateTruck(dt){
    if(truck.state==='waiting'){truck.next-=dt;logistics.nextTruck=Math.max(0,truck.next);if(truck.next<=0){truck.group.visible=true;truck.state='arriving';truck.progress=0;truck.status='arrive par la route de montagne';logistics.truckState=truck.status;notify('Le camion descend de la montagne vers la ferme.');}return;}
    if(truck.state==='arriving'||truck.state==='leaving'){
      truck.progress=THREE.MathUtils.clamp(truck.progress+(truck.state==='arriving'?1:-1)*dt*truck.speed,0,1);const point=routeCurve.getPointAt(truck.progress),tangent=routeCurve.getTangentAt(truck.progress);truck.group.position.copy(point);truck.group.rotation.y=Math.atan2((truck.state==='arriving'?1:-1)*tangent.x,(truck.state==='arriving'?1:-1)*tangent.z);truck.wheel+=dt*9;truck.wheels.forEach(w=>w.rotation.x=truck.wheel);
      if(truck.state==='arriving'&&truck.progress>=1){truck.state='waitingPlayer';truck.status='attend que le joueur le charge';logistics.truckState=truck.status;playHorn();notify('Le camion est arrivé. Touchez-le pour charger les produits.');}
      else if(truck.state==='leaving'&&truck.progress<=0){truck.group.visible=false;truck.state='waiting';truck.next=75+Math.random()*45;truck.status='dans les montagnes';logistics.truckState=truck.status;}
      return;
    }
    if(truck.state==='loading'){truck.loading-=dt;if(truck.loading<=0)completeSale();}
  }

  function hitTruck(x,y){if(!truck||!truck.group.visible)return false;const rect=renderer.domElement.getBoundingClientRect();pointer.x=((x-rect.left)/rect.width)*2-1;pointer.y=-((y-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(truck.group,true).some(hit=>{let o=hit.object;while(o){if(o.userData&&o.userData.truckClickable)return true;o=o.parent;}return false;});}
  function installTruckInput(){renderer.domElement.addEventListener('pointerdown',event=>{audioUnlocked=true;if(pendingHorn){pendingHorn=false;playHorn();}pointerDown={x:event.clientX,y:event.clientY,time:performance.now()};},{passive:true});window.addEventListener('pointerup',event=>{if(!pointerDown)return;const start=pointerDown;pointerDown=null;if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>12||performance.now()-start.time>850||!hitTruck(event.clientX,event.clientY))return;event.preventDefault();event.stopImmediatePropagation();beginLoad();},true);}

  function scanAnimals(){animals.length=0;const seen=new Set();scene.traverse(object=>{if(!object.userData)return;let group=null,data=null,type=null;if(object.userData.bird){data=object.userData.bird;group=data.group||object;type=data.role==='rooster'?'rooster':'hen';}else if(object.userData.farmAnimal){data=object.userData.farmAnimal;group=data.group||object;type=data.type;}if(!group||seen.has(group.uuid)||!['hen','rooster','cow','sheep','duck','pig'].includes(type))return;seen.add(group.uuid);animals.push({group,data,type});finishAnimal(group,data,type);});}

  function finishAnimal(group,data,type){if(group.userData.visualFinishV4)return;group.userData.visualFinishV4=true;if(type==='cow'){const old=group.getObjectByName('visual-cow-details');if(old&&old.parent)old.parent.remove(old);group.children.forEach(child=>{if(!child.isMesh||!child.geometry||child.geometry.type!=='SphereGeometry')return;const r=Number((child.geometry.parameters||{}).radius||0),s=Math.max(child.scale.x,child.scale.y,child.scale.z);if(r>=.9&&s<.5&&child.position.y>.65)child.visible=false;});const coat=largestColor(group,0xeee4d2),patch=new THREE.MeshStandardMaterial({color:coat.r+coat.g+coat.b>1.55?0x3e302b:0xe6d2b7,roughness:.95,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});const rootPatch=new THREE.Group();[[-.21,1.455,-.22,-Math.PI/2,0,.18,.3,.4],[.25,1.445,.32,-Math.PI/2,0,-.22,.24,.32],[-.603,.95,.02,0,-Math.PI/2,.15,.28,.36],[.603,.93,-.37,0,Math.PI/2,-.16,.24,.32]].forEach(p=>{const spot=mesh(new THREE.CircleGeometry(1,22),patch,p[0],p[1],p[2],[p[6],p[7],1],[p[3],p[4],p[5]]);spot.castShadow=false;spot.renderOrder=8;rootPatch.add(spot);});group.add(rootPatch);}else if(type==='hen'||type==='rooster'){const old=group.getObjectByName('visual-bird-details');if(old&&old.parent)old.parent.remove(old);const base=largestColor(group,type==='rooster'?0x302a20:0xb5824a),light=mat(base.clone().lerp(new THREE.Color(0xffffff),.24).getHex(),.94),dark=mat(base.clone().lerp(new THREE.Color(0x17120f),type==='rooster'?.48:.31).getHex(),.9),details=new THREE.Group();[-1,1].forEach(side=>{for(let row=0;row<3;row+=1){for(let i=0;i<5;i+=1){details.add(mesh(new THREE.SphereGeometry(1,9,6),row?dark:light,side*(.35+row*.018),.64-row*.085,.19-i*.145-row*.025,[.065+row*.006,.027,.18-row*.014],[.16+i*.025,side*.27,side*(.1+row*.035)]));}}});group.add(details);}}
  function largestColor(group,fallback){let color=new THREE.Color(fallback),score=-1;group.traverse(object=>{if(!object.isMesh||!object.material)return;const material=Array.isArray(object.material)?object.material[0]:object.material;if(!material||!material.color)return;const box=new THREE.Box3().setFromObject(object),size=new THREE.Vector3();box.getSize(size);const volume=size.x*size.y*size.z;if(volume>score){score=volume;color=material.color.clone();}});return color;}

  function animalSpeed(type){return type==='cow'?1.03:type==='sheep'?1.22:type==='duck'?1.34:type==='pig'?1.17:1.5;}
  function registerShelter(animal,index){if(shelter.has(animal.group))return;const record={group:animal.group,data:animal.data,type:animal.type,index,position:animal.group.position.clone(),rotation:animal.group.rotation.y,visible:animal.group.visible,state:animal.data&&animal.data.state,timer:animal.data&&animal.data.stateTimer,target:animal.data&&animal.data.target&&animal.data.target.clone?animal.data.target.clone():null,phase:'entry',hidden:false,entry:BARN_ENTRY.clone().add(new THREE.Vector3((index%5-2)*.28,0,Math.floor(index/5)*.16)),inside:BARN_INSIDE.clone().add(new THREE.Vector3((index%5-2)*.22,0,Math.floor(index/5)*.17))};if(animal.data){animal.data.state='climateShelter';animal.data.stateTimer=999999;}animal.group.visible=true;shelter.set(animal.group,record);}
  function moveAnimal(record,target,dt){const dx=target.x-record.group.position.x,dz=target.z-record.group.position.z,d=Math.hypot(dx,dz);if(d<.18)return true;const s=Math.min(d,animalSpeed(record.type)*dt);record.group.position.x+=dx/d*s;record.group.position.z+=dz/d*s;record.group.rotation.y=Math.atan2(dx,dz);record.group.position.y=Math.abs(Math.sin(performance.now()*.007+record.index))*.025;return false;}
  function releaseAnimals(){shelter.forEach(record=>{record.group.visible=record.visible;record.group.position.copy(record.position);record.group.rotation.y=record.rotation;if(record.data){record.data._in=false;record.data._ws=null;if(record.data.currentEgg&&record.data.currentEgg.incubating&&record.data.nest){record.group.position.set(record.data.nest.x,0,record.data.nest.z);record.data.state='brooding';record.data.stateTimer=Math.max(5,Number(record.timer)||12);}else{record.data.state=['weatherShelter','climateShelter'].includes(record.state)?'wander':record.state||'wander';record.data.stateTimer=Math.max(3,Number(record.timer)||4+Math.random()*5);}if(record.target&&record.data.target&&record.data.target.copy)record.data.target.copy(record.target);}});shelter.clear();}
  function updateShelter(dt){const hazardous=HAZARDOUS.has(climate.weather);window.FARM_CLIMATE_SHELTER_ACTIVE=hazardous;if(hazardous){animals.forEach(registerShelter);shelter.forEach(record=>{if(!record.group.parent||record.hidden)return;if(record.data){record.data.state='climateShelter';record.data.stateTimer=999999;}record.group.visible=true;if(record.phase==='entry'){if(moveAnimal(record,record.entry,dt))record.phase='inside';}else if(moveAnimal(record,record.inside,dt)){record.group.visible=false;record.hidden=true;}});return;}if(shelter.size){releaseAnimals();notify('Le climat redevient agréable : les animaux ressortent de la grange.');}animals.forEach(record=>{if((record.type==='hen'||record.type==='rooster')&&record.data&&record.data.state==='weatherShelter'){record.group.visible=true;record.data.state='wander';record.data.stateTimer=4+Math.random()*5;record.data._in=false;record.data._ws=null;}});}

  function chooseWeather(){const r=Math.random();climate.weather=climate.season==='spring'?(r<.48?'rain':'sun'):climate.season==='summer'?(r<.42?'heat':'sun'):climate.season==='autumn'?(r<.58?'rain':'sun'):(r<.68?'snow':'sun');climate.weatherTimer=42+Math.random()*46;notify(climate.weather==='rain'?'La pluie commence : les animaux gagnent la grange.':climate.weather==='snow'?'La neige commence à tenir : les animaux vont se mettre au chaud.':climate.weather==='heat'?'La canicule arrive : les animaux se mettent à l’ombre dans la grange.':'Le temps redevient calme.');}
  function updateClimate(dt){climate.seasonTimer-=dt;climate.weatherTimer-=dt;if(climate.seasonTimer<=0){climate.seasonIndex=(climate.seasonIndex+1)%SEASONS.length;climate.season=SEASONS[climate.seasonIndex];climate.seasonTimer=190+Math.random()*80;chooseWeather();notify(`La ferme entre en ${SEASON_LABEL[climate.season].toLowerCase()}.`);}else if(climate.weatherTimer<=0)chooseWeather();}

  function updateGround(dt){const wet=climate.weather==='rain'?1:0,sn=climate.weather==='snow'?1:0,heat=climate.weather==='heat'?1:0,bloom=climate.season==='spring'?1:0;climate.wetness+=(wet-climate.wetness)*Math.min(1,dt*.35);climate.snow+=(sn-climate.snow)*Math.min(1,dt*.18);climate.heat+=(heat-climate.heat)*Math.min(1,dt*.25);climate.bloom+=(bloom-climate.bloom)*Math.min(1,dt*.22);puddles.forEach((p,i)=>{const v=THREE.MathUtils.clamp((climate.wetness-i/puddles.length*.7)/.3,0,1);p.visible=v>.02;p.material.opacity=v*.52;p.scale.copy(p.userData.base).multiplyScalar(.35+v*.65);});if(flowers){flowers.visible=climate.bloom>.02;flowers.scale.setScalar(.2+climate.bloom*.8);}if(ground){const material=Array.isArray(ground.material)?ground.material[0]:ground.material;if(material&&material.color){const target=groundColor.clone();if(climate.season==='spring')target.lerp(new THREE.Color(0x4f9a49),.42);else if(climate.season==='autumn')target.lerp(new THREE.Color(0x8d7c46),.32);else if(climate.season==='winter')target.lerp(new THREE.Color(0xa8b3a4),.2);target.lerp(new THREE.Color(0xf4f7f6),climate.snow*.88);target.lerp(new THREE.Color(0xb49a55),climate.heat*.38);material.color.lerp(target,Math.min(1,dt*1.5));}}rain.visible=climate.weather==='rain';snow.visible=climate.weather==='snow';const cloudColor=new THREE.Color(climate.weather==='rain'?0x76838d:climate.weather==='snow'?0xc7d0d5:climate.weather==='heat'?0xf1e0c2:0xf7fbff);clouds.forEach(c=>c.userData.material.color.lerp(cloudColor,Math.min(1,dt*.65)));const bg=new THREE.Color(climate.weather==='rain'?0x718391:climate.weather==='snow'?0xc8d6df:climate.weather==='heat'?0xe6c58e:0xbfe3f0);if(scene.background&&scene.background.isColor)scene.background.lerp(bg,Math.min(1,dt*.7));if(scene.fog&&scene.fog.color)scene.fog.color.lerp(bg,Math.min(1,dt*.7));}

  function updateParticles(dt){if(rain.visible){const a=rain.geometry.attributes.position.array;for(let i=0;i<a.length;i+=6){a[i+1]-=dt*15;a[i+4]-=dt*15;if(a[i+4]<0){const x=(Math.random()-.5)*68,y=22+Math.random()*8,z=(Math.random()-.5)*68;a[i]=x;a[i+1]=y;a[i+2]=z;a[i+3]=x+.05;a[i+4]=y-.7;a[i+5]=z+.03;}}rain.geometry.attributes.position.needsUpdate=true;}if(snow.visible){const a=snow.geometry.attributes.position.array;for(let i=0;i<a.length;i+=3){a[i]+=Math.sin(performance.now()*.001+i)*dt*.08;a[i+1]-=dt*1.6;if(a[i+1]<0){a[i]=(Math.random()-.5)*68;a[i+1]=23+Math.random()*7;a[i+2]=(Math.random()-.5)*68;}}snow.geometry.attributes.position.needsUpdate=true;}clouds.forEach(c=>{c.position.x+=c.userData.speed*dt;if(c.position.x>48)c.position.x=-48;});}

  function countType(type){return animals.filter(a=>a.type===type).length;}
  function updateProduction(dt){collectableEggs().forEach(egg=>egg.age=Math.min(Number(egg.age)||0,29.5));const current=typeof eggCount==='number'?eggCount:lastEggCounter,newEggs=Math.max(0,current-lastEggCounter);if(newEggs){logistics.eggs+=newEggs;lastEggCounter=current;if(window.farmEconomyState){window.farmEconomyState.coins=Math.max(0,Number(window.farmEconomyState.coins||0)-newEggs*18);saveCoins();}}productionTimer-=dt;if(productionTimer<=0){productionTimer=22;logistics.milk+=countType('cow')*.6;logistics.ham+=countType('pig')*.22;updateCrates();}}

  function installHamHud(){const panel=document.getElementById('hudLogisticsPanel');if(!panel||document.getElementById('hudStockHam'))return;const grid=panel.querySelector('.farmPanelGrid');if(!grid)return;const card=document.createElement('div');card.className='farmPanelCard';card.innerHTML='🍖 Jambon<b id="hudStockHam">0</b>';grid.insertBefore(card,grid.querySelector('.farmPanelWide')||null);}
  function updateHud(){installHamHud();const set=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=value;};set('hudStockEggs',Math.floor(logistics.eggs));set('hudStockMilk',Math.floor(logistics.milk));set('hudStockHam',Math.floor(logistics.ham));set('hudTruckState',logistics.truckState);set('hudTruckTime',truck.state==='waiting'?`Prochain camion dans environ ${Math.ceil(truck.next)} s`:truck.state==='waitingPlayer'?'Touchez le camion pour le charger':'Transport en cours');const wx=document.getElementById('wx');if(wx)wx.textContent=`${WEATHER_LABEL[climate.weather]} · ${SEASON_LABEL[climate.season]}`;}

  function initialize(){
    loadState();findGround();smoothScene();buildSafeRoads();mountainRoad();buildHouse();buildDock();buildWeather();buildCrates();workers.push(createWorker(0),createWorker(1));truck=makeTruck();truck.group.position.copy(routeCurve.getPointAt(0));installTruckInput();scanAnimals();updateCrates();
    if(typeof farmers!=='undefined'&&Array.isArray(farmers))farmers.forEach(f=>{if(f&&f.group)f.group.visible=false;});
    if(typeof updateFarmer==='function')updateFarmer=function(f){if(f&&f.group)f.group.visible=false;};
    window.farmClimateState=climate;window.farmLogisticsState=logistics;window.farmWorkerState=workers;window.farmTruckState=truck;window.loadFarmTruck=beginLoad;
    setTimeout(()=>requestAnimationFrame(loop),0);
  }

  function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;const time=now/1000;scanTimer-=dt;hudTimer-=dt;saveTimer-=dt;if(scanTimer<=0){scanTimer=1;scanAnimals();smoothScene();}updateClimate(dt);updateGround(dt);updateParticles(dt);updateShelter(dt);workers.forEach(worker=>updateWorker(worker,dt,time));updateProduction(dt);updateTruck(dt);if(hudTimer<=0){hudTimer=.35;updateHud();}if(saveTimer<=0){saveTimer=5;saveState();}}

  initialize();
})();
