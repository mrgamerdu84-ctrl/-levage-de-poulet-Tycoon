'use strict';
(() => {
  if (typeof THREE === 'undefined' || !window.FarmStructureV2) return;
  const F=window.FarmStructureV2,{V,portals:P,buildings:B,pens:PEN}=F;
  const animals=new Map(),shelter=new Map(),workers=new Map();
  const hazardous=['rain','snow','heat'];

  function scanAnimals(){
    const seen=new Set();
    scene.traverse(o=>{
      if(!o.userData)return;let g=null,data=null,type=null;
      if(o.userData.bird){data=o.userData.bird;g=data.group||o;type=data.role==='rooster'?'rooster':'hen';}
      else if(o.userData.farmAnimal){data=o.userData.farmAnimal;g=data.group||o;type=data.type;}
      if(!g||seen.has(g.uuid)||!PEN[type])return;seen.add(g.uuid);
      if(!animals.has(g))animals.set(g,{g,data,type,safe:g.position.clone()});
      else Object.assign(animals.get(g),{data,type});
    });
    animals.forEach((r,g)=>{if(!seen.has(g.uuid)||!g.parent){animals.delete(g);shelter.delete(g);}});
  }

  function normalCollision(r){
    if(shelter.has(r.g)||!r.g.visible)return;
    const p=PEN[r.type],rad=r.type==='cow'?.58:r.type==='sheep'?.48:.3,x=r.g.position;
    x.x=THREE.MathUtils.clamp(x.x,p.a+rad,p.b-rad);x.z=THREE.MathUtils.clamp(x.z,p.c+rad,p.d-rad);
    const coop=(r.type==='hen'||r.type==='rooster')&&F.inside(x,F.rect(B.coop,rad*.45))&&!F.near(x,P.coop,rad);
    if(coop||F.hitsWall(x,rad)){x.copy(r.safe);if(r.data&&r.data.target&&r.data.target.copy)r.data.target.copy(r.safe);}
    else r.safe.copy(x);
  }

  const route=t=>{
    if(t==='cow')return[P.cow.inside,P.cow.gate,P.cow.out,V(16.5,.2),V(18,8.5),V(15.8,9.65)];
    if(t==='sheep')return[P.sheep.inside,P.sheep.gate,P.sheep.out,V(5.7,12.6),V(8,9.65)];
    if(t==='duck')return[P.duck.inside,P.duck.gate,P.duck.out,V(-6.5,12.55),V(5.5,12.25),V(8,9.65)];
    if(t==='pig')return[P.pig.inside,P.pig.gate,P.pig.out,V(8,-7.4),V(18,-4),V(18,8.4),V(15.8,9.65)];
    return[P.yardN.inside,P.yardN.gate,P.yardN.out,V(5.8,12.6),V(8,9.65)];
  };

  function startShelter(r,i){
    if(shelter.has(r.g))return;
    const path=[];
    if((r.type==='hen'||r.type==='rooster')&&F.inside(r.g.position,F.rect(B.coop,-.1)))path.push(P.coop.inside.clone(),P.coop.gate.clone(),P.coop.out.clone());
    route(r.type).forEach(x=>path.push(x.clone()));
    const o=(i%5-2)*.22;
    path.push(P.barn.out.clone().add(V(o,0)),P.barn.gate.clone().add(V(o,0)),P.barn.inside.clone().add(V(o,0)),V(13+o,12.25+Math.floor(i/5)*.18));
    shelter.set(r.g,{
      g:r.g,data:r.data,type:r.type,pos:r.g.position.clone(),path,n:0,hidden:false,i,
      oldPos:r.g.position.clone(),oldRot:r.g.rotation.y,oldVisible:r.g.visible,
      oldState:r.data&&r.data.state,oldTimer:r.data&&r.data.stateTimer,
      oldTarget:r.data&&r.data.target&&r.data.target.clone?r.data.target.clone():null
    });
  }

  function moveShelter(r,dt){
    if(r.hidden)return;const t=r.path[r.n];
    if(!t){r.g.visible=false;r.hidden=true;return;}
    const dx=t.x-r.pos.x,dz=t.z-r.pos.z,d=Math.hypot(dx,dz);
    if(d<.16){r.pos.copy(t);r.n++;}
    else{
      const speed=r.type==='cow'?1.02:r.type==='sheep'?1.2:r.type==='duck'?1.34:r.type==='pig'?1.16:1.5,s=Math.min(d,speed*dt);
      r.pos.x+=dx/d*s;r.pos.z+=dz/d*s;r.g.rotation.y=Math.atan2(dx,dz);
    }
    r.g.visible=true;r.g.position.copy(r.pos);r.g.position.y=Math.abs(Math.sin(performance.now()*.007+r.i))*.025;
    if(r.data){r.data.state='structureShelter';r.data.stateTimer=999999;}
  }

  function releaseShelter(){
    shelter.forEach(r=>{
      r.g.visible=r.oldVisible;r.g.position.copy(r.oldPos);r.g.rotation.y=r.oldRot;
      if(!r.data)return;r.data._in=false;r.data._ws=null;
      if(r.data.currentEgg&&r.data.currentEgg.incubating&&r.data.nest){
        r.g.position.set(r.data.nest.x,0,r.data.nest.z);r.data.state='brooding';r.data.stateTimer=Math.max(5,Number(r.oldTimer)||12);
      }else{
        r.data.state=['weatherShelter','climateShelter','structureShelter'].includes(r.oldState)?'wander':r.oldState||'wander';
        r.data.stateTimer=Math.max(3,Number(r.oldTimer)||4+Math.random()*5);
      }
      if(r.oldTarget&&r.data.target&&r.data.target.copy)r.data.target.copy(r.oldTarget);
    });
    shelter.clear();
  }

  function updateAnimals(dt){
    const c=window.farmClimateState,danger=c&&hazardous.includes(c.weather);
    if(danger){let i=0;animals.forEach(r=>startShelter(r,i++));shelter.forEach(r=>moveShelter(r,dt));}
    else{if(shelter.size)releaseShelter();animals.forEach(normalCollision);}
  }

  const HF=V(-6,-14.72),HS=V(-6,-22),S=V(-10.5,-22),ES=V(22.5,-22),EM=V(22.5,-8),EN=V(22.5,18.8),WS=V(-20,-22),WN=V(-20,12.5);
  const TASKS=[
    {name:'paille l’enclos des vaches',type:'straw',path:[P.house.out,HF,HS,S,ES,V(22.5,.1),P.cow.out,P.cow.gate,P.cow.inside,V(8.4,4.2)]},
    {name:'nourrit les poules',type:'feed',path:[P.house.out,HF,HS,S,ES,EM,P.yardE.out,P.yardE.gate,P.yardE.inside,V(3.1,5.5)]},
    {name:'paille l’enclos des moutons',type:'straw',path:[P.house.out,HF,HS,S,ES,EN,V(5.6,18.8),V(5.6,12.65),P.sheep.out,P.sheep.gate,P.sheep.inside,V(0,15.1)]},
    {name:'nourrit les cochons',type:'feed',path:[P.house.out,HF,HS,S,V(8,-22),V(8,-8.25),P.pig.out,P.pig.gate,P.pig.inside,V(3,-11.2)]},
    {name:'ramasse les œufs dans les nids',type:'eggs',path:[P.house.out,HF,HS,S,ES,EM,P.yardE.out,P.yardE.gate,P.yardE.inside,V(-4,-4),V(-9.3,-4),V(-10.55,-4)]},
    {name:'remplit l’eau des canards',type:'water',path:[P.house.out,HF,HS,S,WS,WN,V(-15.5,12.65),P.duck.out,P.duck.gate,P.duck.inside,V(-11.5,15.2)]}
  ];

  const getEggs=()=>typeof eggs!=='undefined'&&Array.isArray(eggs)?eggs.filter(e=>e&&e.mesh&&e.mesh.visible!==false&&!e.incubating):[];

  function installWorkers(){
    const list=window.farmWorkerState;if(!Array.isArray(list))return;
    list.forEach((w,i)=>{
      if(!w||!w.group||workers.has(w))return;
      w.state='structureControlled';
      workers.set(w,{w,mode:'wait',wait:2+i*4,taskIndex:i,task:null,path:[],n:0,act:0,pos:w.group.position.clone(),safe:w.group.position.clone()});
    });
  }

  function startTask(c){
    let t=null,k=0;
    while(k<TASKS.length){t=TASKS[c.taskIndex++%TASKS.length];k++;if(t.type!=='eggs'||getEggs().length)break;t=null;}
    if(!t){c.wait=5;return;}
    c.task=t;c.path=t.path.map(x=>x.clone());c.n=0;c.mode='walk';c.w.status=t.name;
    if(c.w.fork)c.w.fork.visible=t.type==='straw'||t.type==='feed';
    if(c.w.basket)c.w.basket.visible=t.type==='eggs';
  }

  function walk(c,t,dt,time){
    const dx=t.x-c.pos.x,dz=t.z-c.pos.z,d=Math.hypot(dx,dz);
    if(d<.16){c.pos.copy(t);return true;}
    const s=Math.min(d,Math.max(1.25,Number(c.w.speed)||1.4)*dt),p=c.pos.clone();p.x+=dx/d*s;p.z+=dz/d*s;
    if(F.hitsWall(p,.22)){c.pos.copy(c.safe);return false;}
    c.pos.copy(p);c.safe.copy(p);c.w.group.position.copy(p);c.w.group.position.y=Math.abs(Math.sin(time*7.4+(c.w.phase||0)))*.025;c.w.group.rotation.y=Math.atan2(dx,dz);
    const a=Math.sin(time*7.4+(c.w.phase||0))*.58;
    if(c.w.leftLeg)c.w.leftLeg.rotation.x=a;if(c.w.rightLeg)c.w.rightLeg.rotation.x=-a;
    if(c.w.leftArm)c.w.leftArm.rotation.x=-a*.62;if(c.w.rightArm)c.w.rightArm.rotation.x=a*.42;return false;
  }

  function takeEggs(){
    const list=getEggs();list.forEach(e=>{if(typeof removeEgg==='function')removeEgg(e);else if(e.mesh&&e.mesh.parent)e.mesh.parent.remove(e.mesh);});
    if(list.length&&typeof setFarmStatus==='function')setFarmStatus(`Le fermier a ramassé ${list.length} œuf${list.length>1?'s':''} dans les nids du poulailler.`);
  }

  function updateWorker(c,dt,time){
    const w=c.w;w.state='structureControlled';w.group.visible=true;
    if(c.mode==='wait'){c.wait-=dt;if(c.wait<=0)startTask(c);return;}
    if(c.mode==='walk'||c.mode==='return'){
      const t=c.path[c.n];
      if(!t){
        if(c.mode==='walk'){c.mode='act';c.act=c.task.type==='eggs'?3.2:3.8;}
        else{c.mode='wait';c.wait=8+Math.random()*10;c.task=null;w.status='à la maison';if(w.fork)w.fork.visible=true;if(w.basket)w.basket.visible=false;}
        return;
      }
      if(walk(c,t,dt,time))c.n++;return;
    }
    if(c.mode!=='act')return;c.act-=dt;const a=Math.sin(time*7.5);
    if(c.task.type==='straw'){if(w.rightArm)w.rightArm.rotation.x=-1+a*.34;if(w.leftArm)w.leftArm.rotation.x=-.45;if(w.fork)w.fork.rotation.z=-.55+a*.18;}
    else if(c.task.type==='feed'){if(w.rightArm)w.rightArm.rotation.x=-.65+a*.18;if(w.fork)w.fork.rotation.z=-.8;}
    else if(c.task.type==='water'){if(w.rightArm)w.rightArm.rotation.x=-.72+a*.16;}
    else{if(w.rightArm)w.rightArm.rotation.x=-.95+a*.13;if(w.leftArm)w.leftArm.rotation.x=-.82;}
    if(c.act>0)return;if(c.task.type==='eggs')takeEggs();
    if(w.rightArm)w.rightArm.rotation.x=0;if(w.leftArm)w.leftArm.rotation.x=0;if(w.fork)w.fork.rotation.z=0;
    c.mode='return';c.path=c.task.path.slice(0,-1).reverse().map(x=>x.clone());c.n=0;w.status='retourne à la maison';
  }

  function correctTruck(){
    const t=window.farmTruckState;if(!t||!t.group)return;
    if(t.state==='arriving'||t.state==='leaving'){
      const p=THREE.MathUtils.clamp(Number(t.progress)||0,0,1),x=F.truckCurve.getPointAt(p),d=F.truckCurve.getTangentAt(p).normalize(),s=t.state==='arriving'?1:-1;
      t.group.position.copy(x);t.group.rotation.y=Math.atan2(s*d.x,s*d.z);
    }else if(t.state==='waitingPlayer'||t.state==='loading'){t.group.position.copy(V(13.2,-9.2,.045));t.group.rotation.y=0;}
  }

  let last=performance.now(),scan=0;
  function loop(now){
    requestAnimationFrame(loop);
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;scan-=dt;F.initWorld();
    if(scan<=0){scan=.7;scanAnimals();installWorkers();}
    updateAnimals(dt);workers.forEach(c=>updateWorker(c,dt,now/1000));correctTruck();
  }
  setTimeout(()=>requestAnimationFrame(loop),0);
})();
