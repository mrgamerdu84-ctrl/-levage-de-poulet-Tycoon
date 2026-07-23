'use strict';
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || typeof camera === 'undefined' || typeof renderer === 'undefined') return;

  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let context = null;
  let down = null;
  let suppressBirdUntil = 0;

  function audio() {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function tone(type, start, end, delay, duration, volume, filterType, filterFrequency) {
    const ctx = audio();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
    let source = osc;
    if (filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFrequency;
      osc.connect(filter);
      source = filter;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  function hen(quiet) {
    const v = quiet ? 0.06 : 0.2;
    tone('triangle', 610, 300, 0, 0.11, v);
    tone('triangle', 520, 250, 0.12, 0.11, v * 0.9);
    tone('triangle', 455, 225, 0.24, 0.11, v * 0.8);
  }

  function rooster(quiet) {
    const v = quiet ? 0.06 : 0.18;
    tone('sawtooth', 360, 610, 0, 0.16, v, 'bandpass', 980);
    tone('sawtooth', 600, 790, 0.15, 0.17, v, 'bandpass', 1050);
    tone('sawtooth', 770, 260, 0.31, 0.58, v * 0.95, 'bandpass', 900);
  }

  function sheep() {
    tone('sawtooth', 470, 270, 0, 0.34, 0.2, 'bandpass', 850);
    tone('sawtooth', 380, 225, 0.35, 0.31, 0.18, 'bandpass', 760);
  }

  function pig() {
    tone('square', 245, 110, 0, 0.17, 0.17, 'lowpass', 560);
    tone('square', 205, 95, 0.2, 0.17, 0.16, 'lowpass', 520);
  }

  function cow() {
    tone('sawtooth', 165, 88, 0, 0.58, 0.22, 'lowpass', 700);
    tone('sawtooth', 92, 122, 0.56, 0.48, 0.18, 'lowpass', 660);
  }

  function duck() {
    tone('sawtooth', 620, 260, 0, 0.16, 0.16, 'bandpass', 730);
    tone('sawtooth', 540, 235, 0.19, 0.16, 0.15, 'bandpass', 680);
  }

  function findAnimal(object) {
    let current = object;
    while (current) {
      if (current.userData && current.userData.bird) {
        const bird = current.userData.bird;
        return { type: bird.role === 'rooster' ? 'rooster' : 'hen', group: bird.group || current };
      }
      if (current.userData && current.userData.farmAnimal) return current.userData.farmAnimal;
      current = current.parent;
    }
    return null;
  }

  function hit(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    for (const item of raycaster.intersectObjects(scene.children, true)) {
      const animal = findAnimal(item.object);
      if (animal) return animal;
    }
    return null;
  }

  function play(animal) {
    if (!animal) return;
    if (animal.type === 'hen') hen(false);
    else if (animal.type === 'rooster') rooster(false);
    else if (animal.type === 'sheep') sheep();
    else if (animal.type === 'pig') pig();
    else if (animal.type === 'cow') cow();
    else if (animal.type === 'duck') duck();
  }

  canvas.addEventListener('pointerdown', event => {
    audio();
    down = { x: event.clientX, y: event.clientY, time: performance.now() };
  }, { passive: true });

  window.addEventListener('pointerup', event => {
    if (!down) return;
    const start = down;
    down = null;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 14) return;
    if (performance.now() - start.time > 850) return;
    const animal = hit(event.clientX, event.clientY);
    if (!animal) return;
    if (animal.type === 'hen' || animal.type === 'rooster') suppressBirdUntil = performance.now() + 350;
    play(animal);
  }, true);

  if (typeof playCluck === 'function') {
    playCluck = function fixedCluck() {
      if (performance.now() < suppressBirdUntil) return;
      hen(true);
    };
  }

  if (typeof playCrow === 'function') {
    playCrow = function fixedCrow() {
      if (performance.now() < suppressBirdUntil) return;
      rooster(true);
    };
  }
})();
