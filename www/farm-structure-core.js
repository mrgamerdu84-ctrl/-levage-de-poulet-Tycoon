'use strict';
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || typeof renderer === 'undefined') return;

  const NAME='farm-structure-core-v2';
  const old=scene.getObjectByName(NAME);if(old&&old.parent)old.parent.remove(old);
  const root=new THREE.Group();root.name=NAME;scene.add(root);
  const V=(x,z,y=0)=>new THREE.Vector3(x,y,z);

  const portals={
    coop:{axis:'z',out:V(-15,-2.48),gate:V(-15,-3.02),inside:V(-15,-4.05),half:.95},
    barn:{axis:'z',out:V(13,9.62),gate:V(13,10.52),inside:V(13,11.42),half:1.34},
    house:{axis:'z',out:V(-10.5,-14.72),gate:V(-10.5,-15.48),inside:V(-10.5,-16.12),half:.68},
    store:{axis:'z',out:V(15,-12.42),gate:V(15,-13.24),inside:V(15,-14.05),half:1.45},
    yardE:{axis:'x',out:V(5.88,-6),gate:V(5.3,-6),inside:V(4.72,-6),half:1},
    yardN:{axis:'z',out:V(0,12.88),gate:V(0,12.3),inside:V(0,11.72),half:1.38},
    cow:{axis:'z',out:V(10,.08),gate:V(10,.7),inside:V(10,1.3),half:1.18},
    sheep:{axis:'z',out:V(0,12.68),gate:V(0,13.3),inside:V(0,13.92),half:1.18},
    duck:{axis:'z',out:V(-11.5,12.68),gate:V(-11.5,13.3),inside:V(-11.5,13.92),half:1.08},
    pig:{axis:'z',out:V(3,-8.22),gate:V(3,-8.85),inside:V(3,-9.48),half:1.08}
  };

  const buildings={
    coop:{x:-15,z:-6,w:8,d:6,h:4.2,front:1,door:portals.coop,color:0xb5482e},
    barn:{x:13,z:14,w:9,d:7,h:4.9,front:-1,door:portals.barn,color:0xb5482e},
    house:{x:-10.5,z:-18.1,w:7.1,d:5.2,h:3.8,front:1,door:portals.house,color:0xd9b991},
    store:{x:15,z:-17,w:10,d:7.5,h:5.2,front:1,door:portals.store,color:0xd8c3a5}
  };

  const pens={
    hen:{a:-15.3,b:5.3,c:-7.3,d:12.3},rooster:{a:-15.3,b:5.3,c:-7.3,d:12.3},
    cow:{a:5.4,b:14.6,c:.7,d:8.3},sheep:{a:-4.8,b:4.8,c:13.3,d:20.7},
    duck:{a:-15.5,b:-7.5,c:13.3,d:19.7},pig:{a:-1.1,b:7.1,c:-15.15,d:-8.85}
  };

  const truckCurve=new THREE.CatmullRomCurve3([
    V(46,-40,.045),V(39,-34,.045),V(33,-29,.045),V(37,-23,.045),V(29,-19,.045),
    V(24,-16,.045),V(24,-10,.045),V(20,-7.6,.045),V(16,-8.2,.045),V(13.2,-9.2,.045)
  ],false,'catmullrom',.35);

  const mat=(color,rough=.9,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,flatShading:false});
  const mesh=(geo,material,pos,scale,rot)=>{
    const m=new THREE.Mesh(geo,material);m.position.copy(pos);
    if(scale)m.scale.set(...scale);if(rot)m.rotation.set(...rot);
    m.castShadow=m.receiveShadow=true;m.userData.structureFix=true;return m;
  };
  const box=(parent,w,h,d,x,y,z,material,ry=0)=>{
    const m=mesh(new THREE.BoxGeometry(w,h,d),material,V(x,z,y));m.rotation.y=ry;parent.add(m);return m;
  };
  const rect=(s,m=0)=>({a:s.x-s.w/2-m,b:s.x+s.w/2+m,c:s.z-s.d/2-m,d:s.z+s.d/2+m});
  const inside=(p,r)=>p.x>r.a&&p.x<r.b&&p.z>r.c&&p.z<r.d;
  const near=(p,g,e=.15)=>g.axis==='z'
    ?Math.abs(p.x-g.gate.x)<=g.half+e&&Math.abs(p.z-g.gate.z)<.9
    :Math.abs(p.z-g.gate.z)<=g.half+e&&Math.abs(p.x-g.gate.x)<.9;
  const hitsWall=(p,r=.18,allow='')=>Object.entries(buildings).some(([id,s])=>id!==allow&&inside(p,rect(s,r))&&!near(p,s.door,r));

  const world=new THREE.Vector3();
  function findBuilding(s){
    let found=null;
    scene.traverse(o=>{
      if(found||!o.isGroup)return;o.getWorldPosition(world);
      if(Math.abs(world.x-s.x)>.35||Math.abs(world.z-s.z)>.35)return;
      if(o.children.some(c=>{
        if(!c.isMesh||!c.geometry||c.geometry.type!=='BoxGeometry')return false;
        const q=c.geometry.parameters||{};
        return Math.abs((q.width||0)-s.w)<.25&&Math.abs((q.height||0)-s.h)<.25&&Math.abs((q.depth||0)-s.d)<.25;
      }))found=o;
    });
    return found;
  }

  function realDoor(id,s){
    if(scene.getObjectByName(id+'-door-shell'))return true;
    const g=findBuilding(s);if(!g)return false;
    g.children.forEach(c=>{
      if(!c.isMesh||!c.geometry||c.geometry.type!=='BoxGeometry')return;
      const q=c.geometry.parameters||{},W=q.width||0,H=q.height||0,D=q.depth||0;
      if((Math.abs(W-s.w)<.25&&Math.abs(H-s.h)<.25&&Math.abs(D-s.d)<.25)||(Math.min(W,D)<.25&&H>1.5&&H<s.h))c.visible=false;
    });
    const sh=new THREE.Group();sh.name=id+'-door-shell';
    const wall=mat(s.color,.94),trim=mat(0xf3ead7,.9),wood=mat(0x68452e,.94),dark=mat(0x30251f,1);
    const t=.22,dw=s.door.half*2,dh=(id==='barn'||id==='store')?3.15:2.45;
    const fz=s.z+s.front*s.d/2,bz=s.z-s.front*s.d/2,side=(s.w-dw)/2,off=-s.front*t/2;
    box(sh,s.w,s.h,t,s.x,s.h/2,bz,wall);box(sh,t,s.h,s.d,s.x-s.w/2,s.h/2,s.z,wall);box(sh,t,s.h,s.d,s.x+s.w/2,s.h/2,s.z,wall);
    box(sh,side,s.h,t,s.x-dw/2-side/2,s.h/2,fz+off,wall);box(sh,side,s.h,t,s.x+dw/2+side/2,s.h/2,fz+off,wall);
    box(sh,dw,Math.max(.2,s.h-dh),t,s.x,dh+(s.h-dh)/2,fz+off,wall);
    box(sh,dw+.35,.16,.18,s.x,dh+.08,fz+s.front*.02,trim);box(sh,.16,dh,.18,s.x-dw/2-.08,dh/2,fz+s.front*.02,trim);box(sh,.16,dh,.18,s.x+dw/2+.08,dh/2,fz+s.front*.02,trim);
    const hole=box(sh,dw-.12,dh-.08,.08,s.x,dh/2,fz+s.front*.04,dark);hole.castShadow=false;
    const lw=dw*.48;
    box(sh,lw,dh-.18,.12,s.x-dw/2+lw/2-.28,dh/2,fz+s.front*.18,wood,-s.front*.92);
    box(sh,lw,dh-.18,.12,s.x+dw/2-lw/2+.28,dh/2,fz+s.front*.18,wood,s.front*.92);
    box(sh,s.w-.5,.08,s.d-.5,s.x,.04,s.z,mat(id==='coop'?0xb89754:0x6d5844,1));
    root.add(sh);return true;
  }

  function isFence(o){
    if(!o.isMesh||!o.geometry)return false;const q=o.geometry.parameters||{};
    if(o.geometry.type==='CylinderGeometry')return(q.radiusTop||1)<=.16&&(q.height||99)<=1.4;
    if(o.geometry.type!=='BoxGeometry')return false;
    const d=[q.width||0,q.height||0,q.depth||0].sort((a,b)=>a-b);return d[0]<=.18&&d[1]<=.2&&d[2]<=2.5;
  }

  function openGate(g){
    scene.traverse(o=>{
      if((o.userData&&o.userData.structureFix)||!isFence(o))return;o.getWorldPosition(world);
      const hit=g.axis==='z'?Math.abs(world.z-g.gate.z)<.28&&Math.abs(world.x-g.gate.x)<g.half+.3:Math.abs(world.x-g.gate.x)<.28&&Math.abs(world.z-g.gate.z)<g.half+.3;
      if(hit)o.visible=false;
    });
    const R=new THREE.Group(),wood=mat(0x7b583d,.96),metal=mat(0x656a6c,.62,.25),post=new THREE.CylinderGeometry(.1,.13,1.35,8),L=g.half-.08;
    const leaf=()=>{const x=new THREE.Group();box(x,L,.11,.1,L/2,.45,0,wood);box(x,L,.11,.1,L/2,.88,0,wood);box(x,.1,1,.1,.08,.66,0,wood);const b=box(x,L,.07,.07,L/2,.66,.01,metal);b.rotation.z=.42;return x;};
    if(g.axis==='z'){
      R.add(mesh(post,wood,V(g.gate.x-g.half,g.gate.z,.675)),mesh(post,wood,V(g.gate.x+g.half,g.gate.z,.675)));
      const l=leaf();l.position.set(g.gate.x-g.half,0,g.gate.z);l.rotation.y=-1.05;R.add(l);
      const r=leaf();r.position.set(g.gate.x+g.half,0,g.gate.z);r.rotation.y=Math.PI+1.05;R.add(r);
    }else{
      R.add(mesh(post,wood,V(g.gate.x,g.gate.z-g.half,.675)),mesh(post,wood,V(g.gate.x,g.gate.z+g.half,.675)));
      const l=leaf();l.position.set(g.gate.x,0,g.gate.z-g.half);l.rotation.y=Math.PI/2-1.05;R.add(l);
      const r=leaf();r.position.set(g.gate.x,0,g.gate.z+g.half);r.rotation.y=-Math.PI/2+1.05;R.add(r);
    }
    root.add(R);
  }

  function buildNests(){
    if(scene.getObjectByName('visible-nests-v2'))return;
    const g=new THREE.Group();g.name='visible-nests-v2';
    const wood=mat(0x765137,.96),dark=mat(0x4e3527,.98),straw=mat(0xd0ad58,.98),roof=mat(0x93482f,.92);
    box(g,.16,1.45,2.4,-10.98,.78,-4,dark);box(g,1.15,.15,2.55,-10.48,1.48,-4,roof,.06);box(g,1.1,.22,2.35,-10.47,.12,-4,wood);
    [-5.15,-4.3,-3.7,-2.85].forEach(z=>box(g,1,1.25,.09,-10.48,.72,z,wood));
    [-4.6,-4,-3.4].forEach(z=>{
      g.add(mesh(new THREE.TorusGeometry(.31,.08,7,18),straw,V(-10.28,z,.27),[1,.58,1],[Math.PI/2,0,0]));
      for(let i=0;i<6;i++)g.add(mesh(new THREE.CylinderGeometry(.012,.012,.42,4),straw,V(-10.25+(Math.random()-.5)*.35,z+(Math.random()-.5)*.35,.36),null,[Math.random()*.5,Math.random()*Math.PI,1.05+Math.random()*.45]));
    });
    root.add(g);
  }

  function buildDock(){
    const exp=scene.getObjectByName('farm-world-expansion-v4');
    if(exp)exp.children.forEach(c=>{if(!c.isGroup)return;c.getWorldPosition(world);if(Math.abs(world.x-13.2)<.25&&Math.abs(world.z+13.2)<.25)c.visible=false;});
    const g=new THREE.Group(),wood=mat(0x73513a,.96),edge=mat(0x70777a,.58,.35),rubber=mat(0x292c2d,.85);
    box(g,6.2,.52,1.2,13.2,.26,-12.65,wood);box(g,6.25,.16,.12,13.2,.58,-12.04,edge);
    [-2.55,0,2.55].forEach(x=>g.add(mesh(new THREE.CylinderGeometry(.1,.12,1.15,8),wood,V(13.2+x,-12.66,.56))));
    [-1.65,1.65].forEach(x=>box(g,.35,.48,.18,13.2+x,.3,-11.98,rubber));root.add(g);
  }

  function terrainHeight(x,z){
    const d=Math.hypot(x,z);let h=Math.sin(x*.05)*Math.cos(z*.045)*.6;
    if(d>40)h+=(d-40)*.12*(Math.sin(x*.1)+1.2);return h;
  }
  function blocked(x,z){
    const p=V(x,z);if(Object.values(buildings).some(s=>inside(p,rect(s,1.15))))return true;
    return[{a:17,b:23,c:-42,d:25},{a:-32,b:30,c:-26,d:-20},{a:-13,b:-8,c:-24,d:-14},{a:9,b:17,c:-14,d:-8}].some(r=>inside(p,r));
  }

  function buildGrass(){
    let ground=null,area=0;
    scene.traverse(o=>{if(!o.isMesh||!o.geometry||!o.material)return;const q=o.geometry.parameters||{},a=(q.width||0)*(q.height||0);if(o.geometry.type==='PlaneGeometry'&&a>area){ground=o;area=a;}});
    if(!ground)return false;
    const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d'),gr=c.createLinearGradient(0,0,512,512);
    gr.addColorStop(0,'#5f993f');gr.addColorStop(.5,'#78aa4d');gr.addColorStop(1,'#4f8737');c.fillStyle=gr;c.fillRect(0,0,512,512);
    for(let i=0;i<8500;i++){const h=75+Math.random()*35,l=25+Math.random()*25;c.fillStyle=`hsla(${h},45%,${l}%,${.08+Math.random()*.22})`;c.fillRect(Math.random()*512,Math.random()*512,1+Math.random()*2,2+Math.random()*5);}
    const tex=new THREE.CanvasTexture(cv);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(34,34);if(typeof THREE.sRGBEncoding!=='undefined')tex.encoding=THREE.sRGBEncoding;
    const gm=Array.isArray(ground.material)?ground.material[0]:ground.material;gm.map=tex;gm.color.set(0xffffff);gm.roughness=1;gm.needsUpdate=true;

    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-.09,0,0,.09,0,0,.045,.34,0,-.045,.34,0,0,.6,0],3));geo.setIndex([0,1,2,0,2,3,3,2,4]);geo.computeVertexNormals();
    const bm=new THREE.MeshStandardMaterial({color:0x3f7e34,roughness:1,side:THREE.DoubleSide}),n=300,A=new THREE.InstancedMesh(geo,bm,n),C=new THREE.InstancedMesh(geo,bm,n);
    const M=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),e=new THREE.Euler();let placed=0,tries=0;
    while(placed<n&&tries<n*12){tries++;const x=-30+Math.random()*60,z=-25+Math.random()*53;if(blocked(x,z))continue;const a=Math.random()*Math.PI,s=.55+Math.random()*.9;pos.set(x,terrainHeight(x,z)+.04,z);sc.setScalar(s);q.setFromEuler(e.set(0,a,0));M.compose(pos,q,sc);A.setMatrixAt(placed,M);q.setFromEuler(e.set(0,a+Math.PI/2,0));M.compose(pos,q,sc);C.setMatrixAt(placed,M);placed++;}
    A.count=C.count=placed;A.instanceMatrix.needsUpdate=C.instanceMatrix.needsUpdate=true;root.add(A,C);

    const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.014,.018,.28,5),mat(0x4f8c3f,.98),65);
    const petals=new THREE.InstancedMesh(new THREE.SphereGeometry(.065,7,5),mat(0xf1d16a,.88),65);
    for(let i=0;i<65;i++){let x,z;do{x=-28+Math.random()*56;z=-22+Math.random()*48;}while(blocked(x,z));const s=.7+Math.random()*.8;pos.set(x,terrainHeight(x,z)+.14,z);q.setFromEuler(e.set(0,Math.random()*Math.PI,0));sc.setScalar(s);M.compose(pos,q,sc);stems.setMatrixAt(i,M);pos.y=terrainHeight(x,z)+.32;sc.setScalar(s*.85);M.compose(pos,q,sc);petals.setMatrixAt(i,M);}
    stems.instanceMatrix.needsUpdate=petals.instanceMatrix.needsUpdate=true;root.add(stems,petals);return true;
  }

  function buildTruckRoad(){
    const exp=scene.getObjectByName('farm-world-expansion-v4');
    if(exp){
      const remove=[];
      exp.traverse(o=>{if(!o.isMesh||!o.geometry||o.geometry.type!=='BufferGeometry'||!o.material||!o.material.map)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;if(!b)return;const s=new THREE.Vector3();b.getSize(s);if(Math.max(s.x,s.z)>20)remove.push(o);});
      remove.forEach(o=>o.parent&&o.parent.remove(o));
    }
    const n=110,w=4.4,pos=[],uv=[],idx=[],side=new THREE.Vector3();
    for(let i=0;i<=n;i++){const t=i/n,p=truckCurve.getPointAt(t),d=truckCurve.getTangentAt(t).normalize();side.set(-d.z,0,d.x).normalize();const l=p.clone().addScaledVector(side,w/2),r=p.clone().addScaledVector(side,-w/2);pos.push(l.x,l.y,l.z,r.x,r.y,r.z);uv.push(0,t*15,1,t*15);if(i<n){const b=i*2;idx.push(b,b+2,b+1,b+1,b+2,b+3);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    const cv=document.createElement('canvas');cv.width=cv.height=192;const c=cv.getContext('2d');c.fillStyle='#98704c';c.fillRect(0,0,192,192);
    for(let i=0;i<1100;i++){const q=70+Math.random()*90;c.fillStyle=`rgba(${q+54},${q+29},${q+8},${.08+Math.random()*.2})`;c.fillRect(Math.random()*192,Math.random()*192,1+Math.random()*2,1+Math.random()*2);}
    const tx=new THREE.CanvasTexture(cv);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(1,15);if(typeof THREE.sRGBEncoding!=='undefined')tx.encoding=THREE.sRGBEncoding;
    const road=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:tx,roughness:1,polygonOffset:true,polygonOffsetFactor:4,polygonOffsetUnits:4}));
    road.name='collision-safe-truck-road';road.receiveShadow=true;road.castShadow=false;road.renderOrder=-30;root.add(road);
  }

  let ready=false;
  function initWorld(){
    if(ready)return true;
    const ok=Object.entries(buildings).map(([id,s])=>realDoor(id,s)).every(Boolean);if(!ok)return false;
    [portals.yardE,portals.yardN,portals.cow,portals.sheep,portals.duck,portals.pig].forEach(openGate);
    buildNests();buildDock();buildTruckRoad();buildGrass();ready=true;return true;
  }

  window.FarmStructureV2={root,V,portals,buildings,pens,truckCurve,rect,inside,near,hitsWall,initWorld};
  window.FARM_PORTALS=portals;
  window.FARM_BUILDING_COLLIDERS=buildings;
})();
