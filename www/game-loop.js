'use strict';
try{
  const DEFAULT_CAM = { theta: 0.9, phi: 1.0, radius: 42, target: new THREE.Vector3(-2,2,2) };
  const camState = { theta: DEFAULT_CAM.theta, phi: DEFAULT_CAM.phi, radius: DEFAULT_CAM.radius, target: DEFAULT_CAM.target.clone() };
  document.getElementById('resetView').addEventListener('click', ()=>{
    camState.theta = DEFAULT_CAM.theta;
    camState.phi = DEFAULT_CAM.phi;
    camState.radius = DEFAULT_CAM.radius;
    camState.target.copy(DEFAULT_CAM.target);
  });
  let dragging=false, lastX=0, lastY=0, downX=0, downY=0;
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  function handleTap(clientX, clientY){
    pointerNDC.x = (clientX/window.innerWidth)*2-1;
    pointerNDC.y = -(clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for(const hit of hits){
      let obj = hit.object;
      while(obj){
        if(obj.userData && obj.userData.bird){
          const bird = obj.userData.bird;
          if(bird.role === 'rooster') playCrow(); else playCluck();
          return;
        }
        obj = obj.parent;
      }
    }
  }

  renderer.domElement.addEventListener('pointerdown', e=>{
    dragging=true; lastX=e.clientX; lastY=e.clientY; downX=e.clientX; downY=e.clientY;
  });
  window.addEventListener('pointerup', e=>{
    dragging=false;
    const moved = Math.hypot(e.clientX-downX, e.clientY-downY);
    if(moved < 6) handleTap(e.clientX, e.clientY);
  });
  window.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const dx=e.clientX-lastX, dy=e.clientY-lastY;
    lastX=e.clientX; lastY=e.clientY;
    camState.theta -= dx*0.005;
    camState.phi = Math.min(1.5, Math.max(0.35, camState.phi - dy*0.005));
  });
  renderer.domElement.addEventListener('wheel', e=>{
    camState.radius = Math.min(60, Math.max(10, camState.radius + e.deltaY*0.02));
    e.preventDefault();
  }, {passive:false});

  function updateCamera(){
    const {theta,phi,radius,target} = camState;
    camera.position.set(
      target.x + radius*Math.sin(phi)*Math.sin(theta),
      target.y + radius*Math.cos(phi),
      target.z + radius*Math.sin(phi)*Math.cos(theta)
    );
    camera.lookAt(target);
  }

  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let henAmbientTimer = 5+Math.random()*5;
  let roosterCrowTimer = 6+Math.random()*8;
  const clock = new THREE.Clock();
  let animErrorShown = false;
  function animate(){
    requestAnimationFrame(animate);
    try{
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      chickens.forEach(c=>{
        c.stateTimer -= dt;

        if(c.role==='rooster'){
          if(c.state==='wander'){
            const [hx,hz]=c.home;
            const nx=hx+Math.cos(t*c.speed+c.phase)*c.radius;
            const nz=hz+Math.sin(t*c.speed+c.phase)*c.radius*0.65;
            const dx=nx-c.group.position.x, dz=nz-c.group.position.z;
            if(Math.abs(dx)+Math.abs(dz)>0.001) c.group.rotation.y=Math.atan2(dx,dz);
            c.group.position.x=nx; c.group.position.z=nz;
            c.legs[0].rotation.x=Math.sin(t*8+c.phase)*0.4;
            c.legs[1].rotation.x=-Math.sin(t*8+c.phase)*0.4;
            c.head.rotation.x=Math.max(0,Math.sin(t*1.5))*0.35;
            if(c.stateTimer<=0){
              c.courtshipTarget=hens[Math.floor(Math.random()*hens.length)];
              c.state='toHen'; c.stateTimer=8;
              setFarmStatus('Le coq rejoint une poule : son prochain œuf pourra être fécondé.');
            }
          } else if(c.state==='toHen'){
            const h=c.courtshipTarget;
            if(!h){ c.state='wander'; c.stateTimer=8; return; }
            const dest=h.group.position.clone(); dest.x-=0.55;
            const dir=new THREE.Vector3(dest.x-c.group.position.x,0,dest.z-c.group.position.z);
            const dist=dir.length();
            if(dist>0.22){
              dir.normalize(); c.group.rotation.y=Math.atan2(dir.x,dir.z);
              c.group.position.x+=dir.x*1.25*dt; c.group.position.z+=dir.z*1.25*dt;
              c.legs[0].rotation.x=Math.sin(t*9)*0.5; c.legs[1].rotation.x=-Math.sin(t*9)*0.5;
            }else{
              h.fertileUntil=t+55; h.pauseUntil=t+2.2;
              c.state='courtship'; c.stateTimer=2.2;
              setFarmStatus('La poule est maintenant avec le coq : ses œufs peuvent donner des poussins s’ils sont couvés.');
            }
          } else if(c.state==='courtship'){
            c.head.rotation.x=Math.sin(t*6)*0.18;
            if(c.stateTimer<=0){ c.state='wander'; c.stateTimer=12+Math.random()*8; c.courtshipTarget=null; }
          }
          return;
        }

        if(c.state==='wander'){
          if(t<c.pauseUntil){ c.head.rotation.x=0.1; return; }
          const needsFood=!c.fed&&feedPellets.length>0;
          const needsWater=c.fed&&!c.hydrated;
          let nx,nz;
          if(needsFood||needsWater){
            const dest=needsFood?troughPos:waterPos;
            const dir=new THREE.Vector3(dest.x-c.group.position.x,0,dest.z-c.group.position.z);
            const dist=dir.length();
            if(dist>0.4){ dir.normalize(); nx=c.group.position.x+dir.x*1.3*dt; nz=c.group.position.z+dir.z*1.3*dt; }
            else { nx=c.group.position.x; nz=c.group.position.z; }
          }else{
            const [hx,hz]=c.home;
            nx=hx+Math.cos(t*c.speed+c.phase)*c.radius;
            nz=hz+Math.sin(t*c.speed+c.phase)*c.radius*0.7;
          }
          nx=Math.min(YARD.xMax-0.6,Math.max(YARD.xMin+0.6,nx));
          nz=Math.min(YARD.zMax-0.6,Math.max(YARD.zMin+0.6,nz));
          const dx=nx-c.group.position.x,dz=nz-c.group.position.z;
          if(Math.abs(dx)+Math.abs(dz)>0.001)c.group.rotation.y=Math.atan2(dx,dz);
          c.group.position.x=nx;c.group.position.z=nz;
          c.legs[0].rotation.x=Math.sin(t*8+c.phase)*0.4;
          c.legs[1].rotation.x=-Math.sin(t*8+c.phase)*0.4;
          c.head.rotation.x=Math.max(0,Math.sin(t*1.3+c.phase*2))*0.5;
          c.group.position.y=Math.abs(Math.sin(t*8+c.phase))*0.03;
          c.group.scale.y=c.baseScale;
          if(needsFood&&Math.hypot(c.group.position.x-troughPos.x,c.group.position.z-troughPos.z)<0.9){
            c.fed=true;
            const p=feedPellets.pop();
            if(p)scene.remove(p);
          }
          if(needsWater&&Math.hypot(c.group.position.x-waterPos.x,c.group.position.z-waterPos.z)<0.9)c.hydrated=true;
          if(c.stateTimer<=0){
            if(c.fed&&c.hydrated&&!eggInNest(c.nestIndex)){
              c.state='toNest';
              c.target.set(c.nest.x,0,c.nest.z);
            }else c.stateTimer=2+Math.random()*2;
          }
        }else if(c.state==='toNest'||c.state==='leaving'){
          const dest=c.state==='toNest'?c.target:new THREE.Vector3(c.home[0],0,c.home[1]);
          const dir=new THREE.Vector3(dest.x-c.group.position.x,0,dest.z-c.group.position.z);
          const dist=dir.length();
          if(dist>0.15){
            dir.normalize();
            c.group.rotation.y=Math.atan2(dir.x,dir.z);
            c.group.position.x+=dir.x*1.3*dt;
            c.group.position.z+=dir.z*1.3*dt;
            c.legs[0].rotation.x=Math.sin(t*10+c.phase)*0.5;
            c.legs[1].rotation.x=-Math.sin(t*10+c.phase)*0.5;
            c.group.position.y=Math.abs(Math.sin(t*10+c.phase))*0.03;
          }else if(c.state==='toNest'){
            if(eggInNest(c.nestIndex)){
              c.state='leaving';
            }else{
              c.state='laying';
              c.stateTimer=2.2+Math.random()*0.8;
              setFarmStatus('Une poule s’installe dans son nid pour pondre.');
            }
          }else{
            c.state='wander';
            c.stateTimer=8+Math.random()*8;
          }
        }else if(c.state==='laying'){
          c.group.scale.y=c.baseScale*0.74;
          c.group.position.y=-0.05*c.baseScale;
          c.head.rotation.x=0.14;
          if(c.stateTimer<=0){
            const fertilized=c.fertileUntil>t;
            c.currentEgg=spawnEgg(new THREE.Vector3(c.nest.x,0.36,c.nest.z),fertilized,c,c.nestIndex);
            playCluck();
            c.fed=false;
            c.hydrated=false;
            if(fertilized&&c.broody){
              c.currentEgg.incubating=true;
              c.state='brooding';
              c.stateTimer=24;
              setFarmStatus('La poule couve l’œuf fécondé. Le poussin n’apparaîtra qu’après toute la couvaison.');
            }else{
              c.state='leaving';
            }
          }
        }else if(c.state==='brooding'){
          c.group.scale.y=c.baseScale*0.70;
          c.group.position.y=-0.07*c.baseScale;
          c.head.rotation.x=0.12+Math.sin(t*2)*0.04;
          if(c.currentEgg)c.currentEgg.mesh.visible=(Math.sin(t*2.4)>-0.85);
          if(c.stateTimer<=0&&c.currentEgg){
            const hatchPos=c.currentEgg.mesh.position.clone();
            removeEgg(c.currentEgg);
            c.currentEgg=null;
            spawnChick(new THREE.Vector3(hatchPos.x+0.38,0,hatchPos.z+0.22));
            setFarmStatus('L’œuf fécondé vient d’éclore sous la poule : un poussin est né !');
            c.state='leaving';
          }
        }
      });

      henAmbientTimer -= dt;
      if(henAmbientTimer <= 0){
        playCluck();
        henAmbientTimer = 5+Math.random()*7;
      }
      roosterCrowTimer -= dt;
      if(roosterCrowTimer <= 0){
        playCrow();
        roosterCrowTimer = 16+Math.random()*14;
      }

      chicks.forEach(ch=>{
        ch.seed += dt*0.8;
        const nx = ch.home[0] + Math.cos(ch.seed)*0.55;
        const nz = ch.home[1] + Math.sin(ch.seed)*0.55;
        const dx = nx-ch.group.position.x, dz = nz-ch.group.position.z;
        if(Math.abs(dx)+Math.abs(dz) > 0.001) ch.group.rotation.y = Math.atan2(dx,dz);
        ch.group.position.x = nx;
        ch.group.position.z = nz;
        ch.group.position.y = Math.abs(Math.sin(t*11+ch.seed))*0.05;
      });

      updateFarmer(farmers[0], dt, t);
      updateFarmer(farmers[1], dt, t);

      for(let i=eggs.length-1;i>=0;i--){
        const eg=eggs[i];
        if(eg.incubating) continue;
        eg.age+=dt;
        eg.mesh.rotation.y+=dt*0.25;
        if(eg.age>32){
          removeEgg(eg);
          setFarmStatus(eg.fertilized ? 'Un œuf fécondé non couvé a été ramassé par le fermier.' : 'Le fermier a ramassé un œuf non fécondé dans le nid.');
        }
      }

      updateCamera();
      renderer.render(scene, camera);
    } catch(err){
      if(!animErrorShown){
        animErrorShown = true;
        console.error(err);
        const hint = document.getElementById('hint');
        if(hint){
          hint.textContent = 'Erreur en cours de route : ' + (err && err.message ? err.message : err);
          hint.style.background = 'rgba(255,220,220,0.95)';
        }
      }
    }
  }

  updateCamera();
  animate();
  document.getElementById('loading').style.opacity = '0';
  setTimeout(()=>document.getElementById('loading').remove(), 500);
} catch(err){
  const l = document.getElementById('loading');
  if(l){
    l.style.opacity = '1';
    l.innerHTML = '<div style="max-width:80%; text-align:center; font-family:monospace; font-size:13px; color:#B5482E;">Erreur : '+ (err && err.message ? err.message : err) +'</div>';
  }
  console.error(err);
}
