'use strict';
  const COLORS = {
    grass: 0x7FA65C, grassDark: 0x5C8046, soil: 0x9A6B3E,
    barn: 0xB5482E, trim: 0xF3E9D2, roof: 0x4A5559,
    egg: 0xFDF8EF, wood: 0x6B4A32, woodDark: 0x4A3728,
    metal: 0x36322C, leaf: 0x4F7A3D, leafLight: 0x6C9A52,
    fence: 0x8A6642, road: 0x716658
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xBFE3F0);
  scene.fog = new THREE.FogExp2(0xE9DDBB, 0.0095);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 400);
  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ---------- LIGHTS ----------
  const hemi = new THREE.HemisphereLight(0xBFE3F0, 0x6b8c4a, 0.65);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFE7B8, 1.15);
  sun.position.set(-30, 35, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  const fill = new THREE.PointLight(0xFFD98E, 0.4, 30);
  fill.position.set(0, 4, -6);
  scene.add(fill);

  function mat(color, rough=0.85, metal=0.05){
    return new THREE.MeshStandardMaterial({color, roughness:rough, metalness:metal, flatShading:true});
  }

  // ---------- PROCEDURAL CANVAS TEXTURES ----------
  function makeCanvasTexture(draw, w=128, h=128){
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function strawTexture(){
    return makeCanvasTexture((ctx,w,h)=>{
      ctx.fillStyle = '#C9A24E';
      ctx.fillRect(0,0,w,h);
      for(let i=0;i<260;i++){
        const x=Math.random()*w, y=Math.random()*h;
        const len=6+Math.random()*16;
        const ang = Math.random()*Math.PI;
        ctx.strokeStyle = `hsl(${36+Math.random()*20},${55+Math.random()*20}%,${40+Math.random()*35}%)`;
        ctx.lineWidth = 0.8+Math.random()*1.3;
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(x+Math.cos(ang)*len, y+Math.sin(ang)*len);
        ctx.stroke();
      }
    }, 160,160);
  }

  function metalTexture(){
    return makeCanvasTexture((ctx,w,h)=>{
      const grad = ctx.createLinearGradient(0,0,0,h);
      grad.addColorStop(0,'#5a5a5a'); grad.addColorStop(0.5,'#7e7e7e'); grad.addColorStop(1,'#464646');
      ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
      for(let i=0;i<700;i++){
        const y = Math.random()*h;
        ctx.strokeStyle = `rgba(255,255,255,${0.03+Math.random()*0.08})`;
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w, y+(Math.random()-0.5)*3); ctx.stroke();
      }
      for(let x=10; x<w; x+=28){
        ctx.fillStyle='rgba(20,20,20,0.5)';
        ctx.beginPath(); ctx.arc(x,6,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x,h-6,2,0,Math.PI*2); ctx.fill();
      }
    }, 256,64);
  }

  function featherTexture(baseHex, darkHex){
    return makeCanvasTexture((ctx,w,h)=>{
      const base = '#'+baseHex.toString(16).padStart(6,'0');
      const dark = '#'+darkHex.toString(16).padStart(6,'0');
      ctx.fillStyle = base; ctx.fillRect(0,0,w,h);
      const rows=7, cols=7;
      for(let r=0;r<rows;r++){
        for(let col=0; col<cols; col++){
          const x = col*(w/cols) + (r%2 ? (w/cols)/2 : 0);
          const y = r*(h/rows*0.7);
          ctx.fillStyle = (r+col)%2===0 ? base : dark;
          ctx.beginPath();
          ctx.ellipse(x, y, w/cols*0.58, h/rows*0.62, 0, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }, 128,128);
  }

  // ---------- SOUNDS ----------
  let audioCtx = null;
  let noiseBuffer = null;
  const clackEl = document.getElementById('clackAudio');
  const crowEl = document.getElementById('crowAudio');
  let clackReady = false, crowReady = false, clackFailed = false, crowFailed = false;
  if(clackEl){
    clackEl.addEventListener('canplaythrough', ()=>clackReady=true, {once:true});
    clackEl.addEventListener('error', ()=>clackFailed=true);
  }
  if(crowEl){
    crowEl.addEventListener('canplaythrough', ()=>crowReady=true, {once:true});
    crowEl.addEventListener('error', ()=>crowFailed=true);
  }

  function ensureAudio(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) audioCtx = new AC();
    }
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if(audioCtx && !noiseBuffer){
      const len = Math.floor(audioCtx.sampleRate*0.3);
      noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for(let i=0;i<len;i++) data[i] = Math.random()*2-1;
    }
    if(clackEl) try{ clackEl.load(); }catch(e){}
    if(crowEl) try{ crowEl.load(); }catch(e){}
    const hint = document.getElementById('soundHint');
    if(hint) hint.remove();
  }
  window.addEventListener('pointerdown', ensureAudio, {once:true});

  function playCluck(){
    if(clackEl && !clackFailed && clackEl.readyState >= 2){
      const inst = clackEl.cloneNode(true);
      inst.volume = 0.85;
      inst.play().catch(()=>{});
      return;
    }
    playClackSynth();
  }
  function playClackSynth(){
    if(!audioCtx || !noiseBuffer) return;
    const now = audioCtx.currentTime;
    const pulses = 2 + (Math.random()<0.5 ? 1 : 0);
    let t0 = now;
    for(let i=0;i<pulses;i++){
      const dur = 0.09 + Math.random()*0.03;
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(700-i*40, t0);
      bp.frequency.exponentialRampToValueAtTime(350, t0+dur);
      bp.Q.value = 4;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, t0);
      noiseGain.gain.exponentialRampToValueAtTime(0.5, t0+0.012);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      src.connect(bp); bp.connect(noiseGain); noiseGain.connect(audioCtx.destination);
      src.start(t0); src.stop(t0+dur+0.02);
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, t0);
      osc.frequency.exponentialRampToValueAtTime(160, t0+dur);
      const oscGain = audioCtx.createGain();
      oscGain.gain.setValueAtTime(0.0001, t0);
      oscGain.gain.exponentialRampToValueAtTime(0.15, t0+0.015);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
      osc.connect(oscGain); oscGain.connect(audioCtx.destination);
      osc.start(t0); osc.stop(t0+dur+0.02);
      t0 += dur + 0.05 + Math.random()*0.03;
    }
    const fdur = 0.28;
    const fosc = audioCtx.createOscillator();
    fosc.type = 'sawtooth';
    fosc.frequency.setValueAtTime(380, t0);
    fosc.frequency.exponentialRampToValueAtTime(700, t0+fdur*0.5);
    fosc.frequency.exponentialRampToValueAtTime(300, t0+fdur);
    const flp = audioCtx.createBiquadFilter();
    flp.type = 'lowpass'; flp.frequency.value = 1500;
    const fgain = audioCtx.createGain();
    fgain.gain.setValueAtTime(0.0001, t0);
    fgain.gain.exponentialRampToValueAtTime(0.22, t0+0.03);
    fgain.gain.exponentialRampToValueAtTime(0.0001, t0+fdur);
    fosc.connect(flp); flp.connect(fgain); fgain.connect(audioCtx.destination);
    fosc.start(t0); fosc.stop(t0+fdur+0.02);
  }

  function playCrow(){
    if(crowEl && !crowFailed && crowEl.readyState >= 2){
      const inst = crowEl.cloneNode(true);
      inst.volume = 0.85;
      inst.play().catch(()=>{});
      return;
    }
    playCrowSynth();
  }
  function playCrowSynth(){
    if(!audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = [
      {f0:440, f1:660, t0:0.00, dur:0.16, vib:0},
      {f0:660, f1:740, t0:0.15, dur:0.13, vib:0},
      {f0:740, f1:820, t0:0.27, dur:0.22, vib:6},
      {f0:820, f1:280, t0:0.47, dur:0.65, vib:7}
    ];
    notes.forEach(n=>{
      const t0 = now+n.t0;
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f0, t0);
      osc.frequency.linearRampToValueAtTime(n.f1, t0+n.dur);
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'bandpass'; filt.frequency.value = 1100; filt.Q.value = 0.8;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0+0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0+n.dur);
      if(n.vib > 0){
        const lfo = audioCtx.createOscillator();
        lfo.frequency.value = n.vib;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 18;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        lfo.start(t0); lfo.stop(t0+n.dur+0.05);
      }
      osc.connect(filt); filt.connect(gain); gain.connect(audioCtx.destination);
      osc.start(t0); osc.stop(t0+n.dur+0.05);
    });
  }
