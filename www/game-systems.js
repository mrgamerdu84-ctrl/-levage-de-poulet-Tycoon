'use strict';
(()=>{
const K='elevage.systems.v1',S=Object.assign({coins:360,cow:0,sheep:0,duck:0},(()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch{return{}}})()),A={cow:[],sheep:[],duck:[]},P={},W={type:'sun',timer:40,clock:.3,night:false,shelter:false,lastEgg:eggCount,income:22};
const save=()=>{try{localStorage.setItem(K,JSON.stringify({coins:S.coins,cow:A.cow.length,sheep:A.sheep.length,duck:A.duck.length}))}catch{}};
function css(){const e=document.createElement('style');e.textContent=`#sys{top:94px;left:18px;font-size:12px;line-height:1.55}#sys b{color:#B5482E}#shopBtn{position:fixed;right:18px;bottom:116px;z-index:30;border:0;border-radius:14px;padding:12px 15px;background:#FDF8EF;color:#4A3728;box-shadow:0 6px 20px #4a37282e;font:600 14px Fredoka}#shop{position:fixed;inset:0;z-index:40;display:none;place-items:center;background:#18201b99;padding:16px}#shop.open{display:grid}.sc{width:min(500px,92vw);background:#FDF8EF;border-radius:20px;padding:18px;color:#4A3728}.sh{display:flex;justify-content:space-between;align-items:center}.sh h2{margin:0;font-family:Fredoka}.x{border:0;border-radius:10px;width:38px;height:38px;font-size:22px}.bal{margin:12px 0;padding:9px;background:#F1E6D1;border-radius:10px}.row{display:grid;grid-template-columns:1fr auto;gap:5px 12px;padding:12px 0;border-top:1px solid #4a372826}.buy{grid-row:1/3;grid-column:2;border:0;border-radius:10px;padding:9px 12px;background:#7FA65C;color:white;font-weight:700}.buy:disabled{background:#aaa}@media(max-width:680px){#sys{top:152px;left:10px;padding:9px 11px}#shopBtn{right:10px;bottom:112px}}`;document.head.appendChild(e)}
function ui(){const h=document.createElement('div');h.id='sys';h.className='panel';h.innerHTML='<span id="wx">☀️ Soleil</span><br>Heure : <b id="tm">07:00</b><br>Pièces : <b id="co">0</b> 🪙';document.getElementById('ui').appendChild(h);const b=document.createElement('button');b.id='shopBtn';b.textContent='🐮 Boutique animaux';document.body.appendChild(b);const m=document.createElement('div');m.id='shop';m.innerHTML=`<div class="sc"><div class="sh"><h2>Boutique d’animaux</h2><button class="x">×</button></div><div class="bal">Solde : <b id="sco">0</b> 🪙</div>${[['cow','🐄 Vache',250,4],['sheep','🐑 Mouton',180,6],['duck','🦆 Canard',90,8]].map(x=>`<div class="row"><div><b>${x[1]}</b><small><br>Reste dans son enclos</small></div><button class="buy" data-k="${x[0]}">${x[2]} 🪙</button><small>Possédés : <span id="n${x[0]}">0</span>/${x[3]}</small></div>`).join('')}<small>Les œufs et les animaux rapportent des pièces.</small></div>`;document.body.appendChild(m);[b,m].forEach(x=>['pointerdown','pointerup','click'].forEach(n=>x.addEventListener(n,e=>e.stopPropagation())));b.onclick=()=>m.classList.add('open');m.querySelector('.x').onclick=()=>m.classList.remove('open');m.onclick=e=>{if(e.target===m)m.classList.remove('open')};m.querySelectorAll('.buy').forEach(x=>x.onclick=()=>buy(x.dataset.k))}
function label(t,x,y,z){const c=document.createElement('canvas');c.width=320;c.height=96;const q=c.getContext('2d');q.fillStyle='#6B4A32';q.fillRect(5,10,310,76);q.strokeStyle='#D9B36C';q.lineWidth=8;q.strokeRect(5,10,310,76);q.fillStyle='#FFF4D7';q.font='700 40px Arial';q.textAlign='center';q.textBaseline='middle';q.fillText(t,160,48);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true}));s.position.set(x,y,z);s.scale.set(2.6,.78,1);scene.add(s)}
function box(x,y,z,w,h,d,c){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c,.85,0));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m}
function buildings(){building(13,14,9,7,4.9,COLORS.barn,COLORS.roof,2.9,-.08);label('GRANGE',13,4,10.35);for(let i=0;i<8;i++){const b=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.8,12),mat(0xC9A24E,.95,0));b.rotation.z=Math.PI/2;b.position.set(10.2+i%4*1.25,.55+Math.floor(i/4)*.88,10);b.castShadow=true;scene.add(b)}building(15,-17,10,7.5,5.2,0xD8C3A5,0x8B4A32,3.1,.04);label('FERME',15,4.25,-13.15);box(15,.28,-12.65,7,.3,2,COLORS.wood);W.coop=new THREE.PointLight(0xFFD98E,0,7);W.coop.position.set(-15,2,-3.1);scene.add(W.coop);W.porch=new THREE.PointLight(0xFFD98E,0,8);W.porch.position.set(15,3,-12.2);scene.add(W.porch)}
function pen(n,x,z,w,d){const side=(a,b,c,e)=>{const N=Math.max(2,Math.round(Math.hypot(c-a,e-b)/1.8));for(let i=0;i<N;i++){let u=i/N,v=(i+1)/N,ax=a+(c-a)*u,az=b+(e-b)*u,bx=a+(c-a)*v,bz=b+(e-b)*v;fencePost(ax,az);fenceRail(ax,az,bx,bz,.35);fenceRail(ax,az,bx,bz,.82)}fencePost(c,e)};side(x-w,z-d,x+w,z-d);side(x+w,z-d,x+w,z+d);side(x+w,z+d,x-w,z+d);side(x-w,z+d,x-w,z-d);label(n,x,1.65,z-d-.15);return{x,z,w,d}}
function pens(){P.cow=pen('VACHES',10,4.5,4.6,3.8);P.sheep=pen('MOUTONS',0,17,4.8,3.7);P.duck=pen('CANARDS',-11.5,16.5,4,3.2);const p=new THREE.Mesh(new THREE.CircleGeometry(2.15,28),smoothMat(0x5B9BD5,.2,.15));p.rotation.x=-Math.PI/2;p.position.set(-11.5,.055,16.5);scene.add(p)}
const rp=(p,m=.8)=>new THREE.Vector3(p.x+(Math.random()*2-1)*(p.w-m),0,p.z+(Math.random()*2-1)*(p.d-m));
function rec(g,k,s){const o={g,k,p:P[k],s,t:rp(P[k]),wait:Math.random()*2,phase:Math.random()*6.28};A[k].push(o);scene.add(g);return o}
function cow(){
  const g=new THREE.Group();
  const lightCoat=Math.random()<.55;
  const coat=smoothMat(lightCoat?0xF1E7D2:0xA96F46,.88,0);
  const patch=smoothMat(lightCoat?0x754B35:0xF0DEBD,.9,0);
  const muzzleMat=smoothMat(0xD7A58B,.72,0);
  const dark=smoothMat(0x3F3029,.82,0);
  const hornMat=smoothMat(0xE8D3A5,.75,0);
  const eyeWhite=smoothMat(0xFFFDF5,.22,0);
  const eyeDark=smoothMat(0x17120F,.14,0);

  const body=new THREE.Mesh(new THREE.SphereGeometry(.72,12,10),coat);
  body.scale.set(.84,.78,1.38);
  body.position.y=.82;
  body.castShadow=true;
  g.add(body);

  const chest=new THREE.Mesh(new THREE.SphereGeometry(.48,11,9),coat);
  chest.scale.set(.88,.95,.82);
  chest.position.set(0,.82,.62);
  chest.castShadow=true;
  g.add(chest);

  [[-.47,.93,.08,.34,.2,.2],[.42,.83,-.28,.29,.23,.2],[-.28,.72,-.58,.23,.18,.18]].forEach(p=>{
    const spot=new THREE.Mesh(new THREE.SphereGeometry(1,9,7),patch);
    spot.scale.set(p[3],p[4],p[5]);
    spot.position.set(p[0],p[1],p[2]);
    spot.castShadow=true;
    g.add(spot);
  });

  const headGroup=new THREE.Group();
  headGroup.position.set(0,1.02,1.03);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.36,11,9),coat);
  head.scale.set(.92,.92,.84);
  head.castShadow=true;
  headGroup.add(head);

  const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.25,10,8),muzzleMat);
  muzzle.scale.set(1.05,.7,.72);
  muzzle.position.set(0,-.09,.28);
  muzzle.castShadow=true;
  headGroup.add(muzzle);

  [-.09,.09].forEach(x=>{
    const nostril=new THREE.Mesh(new THREE.SphereGeometry(.025,7,6),dark);
    nostril.position.set(x,-.09,.46);
    headGroup.add(nostril);
  });

  [-1,1].forEach(side=>{
    const ear=new THREE.Mesh(new THREE.SphereGeometry(.14,9,7),coat);
    ear.scale.set(1.45,.48,.72);
    ear.position.set(side*.34,.08,.02);
    ear.rotation.z=side*.22;
    ear.castShadow=true;
    headGroup.add(ear);

    const horn=new THREE.Mesh(new THREE.ConeGeometry(.055,.22,7),hornMat);
    horn.position.set(side*.22,.27,-.01);
    horn.rotation.z=side*-.5;
    horn.castShadow=true;
    headGroup.add(horn);

    const white=new THREE.Mesh(new THREE.SphereGeometry(.055,9,7),eyeWhite);
    white.position.set(side*.12,.07,.285);
    headGroup.add(white);
    const pupil=new THREE.Mesh(new THREE.SphereGeometry(.028,8,6),eyeDark);
    pupil.position.set(side*.12,.067,.331);
    headGroup.add(pupil);
    const shine=new THREE.Mesh(new THREE.SphereGeometry(.009,6,5),eyeWhite);
    shine.position.set(side*.112,.078,.354);
    headGroup.add(shine);
  });
  g.add(headGroup);

  const legs=[];
  [[-.32,.45],[.32,.45],[-.32,-.46],[.32,-.46]].forEach(([x,z])=>{
    const legGroup=new THREE.Group();
    legGroup.position.set(x,.63,z);
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.58,7),coat);
    leg.position.y=-.29;
    leg.castShadow=true;
    legGroup.add(leg);
    const hoof=new THREE.Mesh(new THREE.CylinderGeometry(.095,.105,.12,7),dark);
    hoof.position.set(0,-.61,.025);
    hoof.castShadow=true;
    legGroup.add(hoof);
    g.add(legGroup);
    legs.push(legGroup);
  });

  const udder=new THREE.Mesh(new THREE.SphereGeometry(.19,9,7),muzzleMat);
  udder.scale.set(1,.55,.85);
  udder.position.set(0,.39,-.05);
  g.add(udder);

  const tailGroup=new THREE.Group();
  tailGroup.position.set(0,1.02,-.98);
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.48,6),coat);
  tail.position.y=-.24;
  tail.rotation.z=.08;
  tail.castShadow=true;
  tailGroup.add(tail);
  const tuft=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),dark);
  tuft.scale.set(.7,1.25,.7);
  tuft.position.set(.02,-.5,0);
  tailGroup.add(tuft);
  g.add(tailGroup);

  g.scale.setScalar(.96);
  g.position.copy(rp(P.cow));
  const o=rec(g,'cow',.42);
  o.legs=legs;
  o.head=headGroup;
  o.tail=tailGroup;
  return o;
}
function sheep(){const g=new THREE.Group(),w=smoothMat(0xF2E9D8,.95,0),d=smoothMat(0x514239,.9,0);let b=new THREE.Mesh(new THREE.SphereGeometry(.65,10,8),w);b.scale.set(1.2,.85,.85);b.position.y=.7;g.add(b);for(let i=0;i<5;i++){let p=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),w);p.position.set((i-2)*.24,.86,i%2?.25:-.22);g.add(p)}let h=new THREE.Mesh(new THREE.SphereGeometry(.28,9,7),d);h.position.set(0,.82,.67);g.add(h);g.position.copy(rp(P.sheep));return rec(g,'sheep',.42)}
function duck(){const g=new THREE.Group(),m=smoothMat(Math.random()<.5?0xF1E4C5:0x8A6642,.82,0);let b=new THREE.Mesh(new THREE.SphereGeometry(.33,10,8),m);b.scale.set(1,.75,1.25);b.position.y=.28;g.add(b);let h=new THREE.Mesh(new THREE.SphereGeometry(.19,9,7),m);h.position.set(0,.52,.26);g.add(h);let k=new THREE.Mesh(new THREE.BoxGeometry(.18,.055,.16),smoothMat(0xE9A33B,.5,0));k.position.set(0,.49,.49);g.add(k);g.position.copy(rp(P.duck,.5));return rec(g,'duck',.55)}
const C={cow:{cost:250,max:4,spawn:cow,name:'une vache'},sheep:{cost:180,max:6,spawn:sheep,name:'un mouton'},duck:{cost:90,max:8,spawn:duck,name:'un canard'}};
function buy(k){const c=C[k];if(A[k].length>=c.max)return setFarmStatus('Cet enclos est plein.');if(S.coins<c.cost)return setFarmStatus('Il manque des pièces pour cet achat.');S.coins-=c.cost;c.spawn();save();draw();setFarmStatus(`La boutique a livré ${c.name}.`)}
function rain(){const n=450,a=new Float32Array(n*3);for(let i=0;i<a.length;i+=3){a[i]=(Math.random()-.5)*58;a[i+1]=Math.random()*24+2;a[i+2]=(Math.random()-.5)*58}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a,3));W.rain=new THREE.Points(g,new THREE.PointsMaterial({color:0xC9E8FF,size:.09,transparent:true,opacity:.7,depthWrite:false}));W.rain.visible=false;scene.add(W.rain)}
function weather(dt){W.clock=(W.clock+dt/210)%1;let old=W.night;W.night=W.clock<.19||W.clock>.79;W.timer-=dt;if(W.timer<=0){W.type=W.type==='sun'?'rain':'sun';W.timer=W.type==='rain'?25+Math.random()*15:40+Math.random()*25;W.rain.visible=W.type==='rain';setFarmStatus(W.type==='rain'?'La pluie commence : les poules rentrent au poulailler.':'Le soleil revient.')}if(!old&&W.night)setFarmStatus('La nuit tombe : les poules rentrent dormir.');let l=W.night?.1:(W.type==='rain'?.46:1);sun.intensity=1.15*l;hemi.intensity=.18+.47*l;fill.intensity=W.night?.18:.4*l;const c=new THREE.Color(W.night?0x17243B:(W.type==='rain'?0x718391:0xBFE3F0));scene.background.lerp(c,.035);scene.fog.color.lerp(c,.035);W.coop.intensity=W.night?1.2:(W.type==='rain'?.4:0);W.porch.intensity=W.night?1:0;if(W.rain.visible){const a=W.rain.geometry.attributes.position.array;for(let i=0;i<a.length;i+=3){a[i+1]-=dt*15;if(a[i+1]<0){a[i]=(Math.random()-.5)*58;a[i+1]=20;a[i+2]=(Math.random()-.5)*58}}W.rain.geometry.attributes.position.needsUpdate=true}}
const D=new THREE.Vector3(-15,0,-2.45);
function shelter(dt,t){let need=W.night||W.type==='rain';if(need&&!W.shelter){W.shelter=true;chickens.forEach((b,i)=>{b._ws={state:b.state,timer:b.stateTimer};b._in=false;b._off=(i-(chickens.length-1)/2)*.16;b.state='weatherShelter';b.stateTimer=9999;b.group.visible=true})}if(!need&&W.shelter){W.shelter=false;chickens.forEach((b,i)=>{b.group.visible=true;b._in=false;if(b.currentEgg&&b.currentEgg.incubating){b.group.position.set(b.nest.x,0,b.nest.z);b.state='brooding';b.stateTimer=Math.max(5,b._ws?.timer||12)}else{b.group.position.set(D.x+(i-(chickens.length-1)/2)*.28,0,D.z+.35);b.state='wander';b.stateTimer=4+Math.random()*5}b._ws=null})}if(!W.shelter)return;chickens.forEach(b=>{if(b._in)return;let x=D.x+b._off,z=D.z,dx=x-b.group.position.x,dz=z-b.group.position.z,d=Math.hypot(dx,dz);if(d<.28){b.group.visible=false;b._in=true;return}b.group.rotation.y=Math.atan2(dx,dz);b.group.position.x+=dx/d*Math.min(d,1.65*dt);b.group.position.z+=dz/d*Math.min(d,1.65*dt);b.legs[0].rotation.x=Math.sin(t*10+b.phase)*.52;b.legs[1].rotation.x=-b.legs[0].rotation.x})}
function animals(dt,t){Object.values(A).flat().forEach(a=>{a.wait-=dt;let dx=a.t.x-a.g.position.x,dz=a.t.z-a.g.position.z,d=Math.hypot(dx,dz);if(d<.18||a.wait<-8){a.t.copy(rp(a.p,a.k==='duck'?.5:.8));a.wait=1+Math.random()*3;dx=a.t.x-a.g.position.x;dz=a.t.z-a.g.position.z;d=Math.hypot(dx,dz)}const moving=a.wait<=0&&d>.001;if(moving){a.g.rotation.y=Math.atan2(dx,dz);let s=Math.min(d,a.s*dt);a.g.position.x+=dx/d*s;a.g.position.z+=dz/d*s;a.g.position.y=Math.abs(Math.sin(t*5+a.phase))*.025}else a.g.position.y=0;if(a.k==='cow'&&a.legs){const step=moving?Math.sin(t*5+a.phase)*.3:0;a.legs[0].rotation.x=step;a.legs[3].rotation.x=step;a.legs[1].rotation.x=-step;a.legs[2].rotation.x=-step;a.head.rotation.x=moving?Math.sin(t*5+a.phase)*.035:-.08+Math.sin(t*1.7+a.phase)*.025;a.tail.rotation.z=Math.sin(t*2.3+a.phase)*.32}})}
function economy(dt){if(eggCount>W.lastEgg){let g=(eggCount-W.lastEgg)*18;S.coins+=g;W.lastEgg=eggCount;save();setFarmStatus(`Vente des œufs : +${g} pièces.`)}W.income-=dt;if(W.income<=0){let g=A.cow.length*9+A.sheep.length*6+A.duck.length*3;if(g){S.coins+=g;save();setFarmStatus(`Revenus des enclos : +${g} pièces.`)}W.income=22}}
function draw(){let mins=Math.floor(W.clock*1440),h=Math.floor(mins/60)%24,m=mins%60;document.getElementById('wx').textContent=W.night?'🌙 Nuit':W.type==='rain'?'🌧️ Pluie':'☀️ Soleil';document.getElementById('tm').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;document.getElementById('co').textContent=Math.floor(S.coins);document.getElementById('sco').textContent=Math.floor(S.coins);Object.keys(C).forEach(k=>{document.getElementById('n'+k).textContent=A[k].length;document.querySelector(`[data-k="${k}"]`).disabled=A[k].length>=C[k].max||S.coins<C[k].cost})}
let last=performance.now();function loop(n){requestAnimationFrame(loop);let dt=Math.min(.05,(n-last)/1000);last=n;weather(dt);shelter(dt,n/1000);animals(dt,n/1000);economy(dt);draw()}
css();ui();buildings();pens();rain();for(let i=0;i<Math.min(S.cow,4);i++)cow();for(let i=0;i<Math.min(S.sheep,6);i++)sheep();for(let i=0;i<Math.min(S.duck,8);i++)duck();draw();setTimeout(()=>requestAnimationFrame(loop),0);
})();
