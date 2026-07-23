'use strict';
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || typeof camera === 'undefined' || typeof renderer === 'undefined') return;

  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let context = null;
  let down = null;
  let mediaUnlocked = false;
  let suppressBirdUntil = 0;

  // Vrais cris d'animaux. Ces URL sont volontairement regroupées ici pour
  // pouvoir remplacer facilement un fichier sans toucher au reste du jeu.
  const REAL_SOUND_URLS = window.FARM_ANIMAL_SOUND_FILES = {
    hen: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hen_announcing_shes_lain_an_egg.ogg',
    rooster: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rooster_crowing.ogg',
    cow: 'https://commons.wikimedia.org/wiki/Special:FilePath/Single_Cow_Moo.ogg',
    sheep: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sheep_bleat.ogg',
    duck: 'https://commons.wikimedia.org/wiki/Special:FilePath/Anas_platyrhynchos_-_Mallard_-_XC62258.ogg'
  };

  // Crédits conservés dans le code sans modifier l'interface du jeu.
  window.FARM_ANIMAL_SOUND_CREDITS = {
    hen: 'alys / PDSounds, domaine public, via Wikimedia Commons',
    rooster: 'Wikimedia Commons, voir la page du fichier Rooster_crowing.ogg',
    cow: 'MichaeltheFox8621, CC BY-SA 4.0, via Wikimedia Commons',
    sheep: 'Eviatar Bach, CC0, via Wikimedia Commons',
    duck: 'Jonathon Jongsma / xeno-canto, CC BY-SA 3.0, via Wikimedia Commons'
  };

  const SOUND_SETTINGS = {
    hen: { volume: 0.72, ambientVolume: 0.24, maxDuration: 3.2 },
    rooster: { volume: 0.72, ambientVolume: 0.24, maxDuration: 4.5 },
    cow: { volume: 0.78, ambientVolume: 0.28, maxDuration: 4.2 },
    sheep: { volume: 0.82, ambientVolume: 0.3, maxDuration: 1.1 },
    duck: { volume: 0.78, ambientVolume: 0.26, maxDuration: 3.8 }
  };

  const preloaded = {};
  Object.entries(REAL_SOUND_URLS).forEach(([type, url]) => {
    const element = new Audio();
    element.preload = 'auto';
    element.src = url;
    try { element.load(); } catch (_) {}
    preloaded[type] = element;
  });

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
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), t + duration);
    let source = oscillator;
    if (filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFrequency;
      oscillator.connect(filter);
      source = filter;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.03);
  }

  // Secours synthétique uniquement si un vrai fichier distant ne peut pas être lu.
  const synthFallback = {
    hen(quiet) {
      const volume = quiet ? 0.05 : 0.18;
      tone('triangle', 610, 300, 0, 0.11, volume);
      tone('triangle', 520, 250, 0.12, 0.11, volume * 0.9);
      tone('triangle', 455, 225, 0.24, 0.11, volume * 0.8);
    },
    rooster(quiet) {
      const volume = quiet ? 0.05 : 0.16;
      tone('sawtooth', 360, 610, 0, 0.16, volume, 'bandpass', 980);
      tone('sawtooth', 600, 790, 0.15, 0.17, volume, 'bandpass', 1050);
      tone('sawtooth', 770, 260, 0.31, 0.58, volume * 0.95, 'bandpass', 900);
    },
    cow(quiet) {
      const volume = quiet ? 0.07 : 0.2;
      tone('sawtooth', 165, 88, 0, 0.58, volume, 'lowpass', 700);
      tone('sawtooth', 92, 122, 0.56, 0.48, volume * 0.82, 'lowpass', 660);
    },
    sheep(quiet) {
      const volume = quiet ? 0.07 : 0.18;
      tone('sawtooth', 470, 270, 0, 0.34, volume, 'bandpass', 850);
      tone('sawtooth', 380, 225, 0.35, 0.31, volume * 0.9, 'bandpass', 760);
    },
    duck(quiet) {
      const volume = quiet ? 0.06 : 0.16;
      tone('sawtooth', 620, 260, 0, 0.16, volume, 'bandpass', 730);
      tone('sawtooth', 540, 235, 0.19, 0.16, volume * 0.92, 'bandpass', 680);
    },
    pig() {
      tone('square', 245, 110, 0, 0.17, 0.17, 'lowpass', 560);
      tone('square', 205, 95, 0.2, 0.17, 0.16, 'lowpass', 520);
    }
  };

  function playRealSound(type, quiet = false) {
    const base = preloaded[type];
    const settings = SOUND_SETTINGS[type];
    if (!base || !settings) {
      if (synthFallback[type]) synthFallback[type](quiet);
      return;
    }

    const clip = base.cloneNode(true);
    clip.preload = 'auto';
    clip.volume = quiet ? settings.ambientVolume : settings.volume;
    clip.playbackRate = 0.97 + Math.random() * 0.06;
    let fallbackPlayed = false;

    const useFallback = () => {
      if (fallbackPlayed) return;
      fallbackPlayed = true;
      if (synthFallback[type]) synthFallback[type](quiet);
    };

    clip.addEventListener('error', useFallback, { once: true });
    const promise = clip.play();
    if (promise && typeof promise.catch === 'function') promise.catch(useFallback);

    window.setTimeout(() => {
      if (!clip.paused) clip.pause();
      try { clip.currentTime = 0; } catch (_) {}
    }, settings.maxDuration * 1000);
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

  function playAnimal(animal, quiet = false) {
    if (!animal) return;
    if (animal.type === 'pig') synthFallback.pig();
    else if (REAL_SOUND_URLS[animal.type]) playRealSound(animal.type, quiet);
  }

  function hasAnimal(type) {
    let found = false;
    scene.traverse(object => {
      if (found || !object.userData) return;
      if (object.userData.bird) {
        const role = object.userData.bird.role === 'rooster' ? 'rooster' : 'hen';
        if (role === type) found = true;
      } else if (object.userData.farmAnimal && object.userData.farmAnimal.type === type) {
        found = true;
      }
    });
    return found;
  }

  function randomDelay(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function scheduleNaturalCall(type, minimum, maximum) {
    window.setTimeout(() => {
      if (mediaUnlocked && document.visibilityState === 'visible' && hasAnimal(type)) {
        playRealSound(type, true);
      }
      scheduleNaturalCall(type, minimum, maximum);
    }, randomDelay(minimum, maximum));
  }

  canvas.addEventListener('pointerdown', event => {
    mediaUnlocked = true;
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
    if (animal.type === 'hen' || animal.type === 'rooster') suppressBirdUntil = performance.now() + 450;
    playAnimal(animal, false);
  }, true);

  // Les appels existants du moteur gardent leur rythme, mais jouent maintenant
  // de vrais caquètements et de vrais chants de coq.
  if (typeof playCluck === 'function') {
    playCluck = function realCluck() {
      if (performance.now() < suppressBirdUntil) return;
      playRealSound('hen', true);
    };
  }

  if (typeof playCrow === 'function') {
    playCrow = function realCrow() {
      if (performance.now() < suppressBirdUntil) return;
      playRealSound('rooster', true);
    };
  }

  // Les autres espèces appellent naturellement à intervalles irréguliers.
  scheduleNaturalCall('cow', 22000, 43000);
  scheduleNaturalCall('sheep', 16000, 33000);
  scheduleNaturalCall('duck', 13000, 28000);

  // Fonction de test pratique depuis la console Android/WebView.
  window.playFarmAnimalSound = type => {
    mediaUnlocked = true;
    playRealSound(type, false);
  };
})();
