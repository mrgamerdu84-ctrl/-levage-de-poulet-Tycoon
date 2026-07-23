'use strict';
(() => {
  if (
    typeof THREE === 'undefined' ||
    typeof scene === 'undefined' ||
    typeof camera === 'undefined' ||
    typeof renderer === 'undefined'
  ) return;

  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let context = null;
  let down = null;
  let mediaUnlocked = false;
  let suppressBirdUntil = 0;
  let silenceAmbientUntil = 0;
  let lastHenCall = 0;
  let lastRoosterCall = 0;

  const activeMedia = new Set();
  const activeSynth = new Set();

  // Vrais cris d'animaux. Il suffit de remplacer une URL ici pour changer un son.
  const REAL_SOUND_URLS = window.FARM_ANIMAL_SOUND_FILES = {
    hen: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hen_announcing_shes_lain_an_egg.ogg',
    rooster: 'https://commons.wikimedia.org/wiki/Special:FilePath/Rooster_crowing.ogg',
    cow: 'https://commons.wikimedia.org/wiki/Special:FilePath/Single_Cow_Moo.ogg',
    sheep: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sheep_bleat.ogg',
    duck: 'https://commons.wikimedia.org/wiki/Special:FilePath/Anas_platyrhynchos_-_Mallard_-_XC62258.ogg',
    pig: 'https://commons.wikimedia.org/wiki/Special:FilePath/Pig_grunt_-_Erdie.ogg'
  };

  window.FARM_ANIMAL_SOUND_CREDITS = {
    hen: 'alys / PDSounds, domaine public, via Wikimedia Commons',
    rooster: 'Wikimedia Commons, page du fichier Rooster_crowing.ogg',
    cow: 'MichaeltheFox8621, CC BY-SA 4.0, via Wikimedia Commons',
    sheep: 'Eviatar Bach, CC0, via Wikimedia Commons',
    duck: 'Jonathon Jongsma / xeno-canto, CC BY-SA 3.0, via Wikimedia Commons',
    pig: 'Erdie, enregistrement de ferme, via Wikimedia Commons'
  };

  const SOUND_SETTINGS = {
    hen: { volume: 0.78, ambientVolume: 0.2, maxDuration: 3.2 },
    rooster: { volume: 0.78, ambientVolume: 0.22, maxDuration: 4.5 },
    cow: { volume: 0.9, ambientVolume: 0.32, maxDuration: 4.2 },
    sheep: { volume: 1, ambientVolume: 0.46, maxDuration: 1.25 },
    duck: { volume: 0.88, ambientVolume: 0.3, maxDuration: 3.8 },
    pig: { volume: 0.94, ambientVolume: 0.34, maxDuration: 1.35 }
  };

  const preloaded = {};
  Object.entries(REAL_SOUND_URLS).forEach(([type, url]) => {
    const element = new Audio();
    element.preload = 'auto';
    element.playsInline = true;
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

  function stopAllAnimalSounds() {
    activeMedia.forEach(clip => {
      try {
        clip.pause();
        clip.currentTime = 0;
      } catch (_) {}
    });
    activeMedia.clear();

    activeSynth.forEach(node => {
      try { node.stop(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    });
    activeSynth.clear();
  }

  function tone(type, start, end, delay, duration, volume, filterType, filterFrequency) {
    const ctx = audio();
    if (!ctx) return;

    const startTime = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), startTime + duration);

    let source = oscillator;
    if (filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFrequency;
      oscillator.connect(filter);
      source = filter;
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);

    activeSynth.add(oscillator);
    oscillator.addEventListener('ended', () => activeSynth.delete(oscillator), { once: true });
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  }

  // Secours synthétique si un fichier distant est momentanément indisponible.
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
      const volume = quiet ? 0.08 : 0.22;
      tone('sawtooth', 165, 88, 0, 0.58, volume, 'lowpass', 700);
      tone('sawtooth', 92, 122, 0.56, 0.48, volume * 0.82, 'lowpass', 660);
    },
    sheep(quiet) {
      const volume = quiet ? 0.12 : 0.3;
      tone('sawtooth', 470, 270, 0, 0.34, volume, 'bandpass', 850);
      tone('sawtooth', 380, 225, 0.35, 0.31, volume * 0.9, 'bandpass', 760);
    },
    duck(quiet) {
      const volume = quiet ? 0.07 : 0.18;
      tone('sawtooth', 620, 260, 0, 0.16, volume, 'bandpass', 730);
      tone('sawtooth', 540, 235, 0.19, 0.16, volume * 0.92, 'bandpass', 680);
    },
    pig(quiet) {
      const volume = quiet ? 0.1 : 0.24;
      tone('square', 245, 110, 0, 0.17, volume, 'lowpass', 560);
      tone('square', 205, 95, 0.2, 0.17, volume * 0.94, 'lowpass', 520);
    }
  };

  function canPlayAmbient() {
    return (
      mediaUnlocked &&
      document.visibilityState === 'visible' &&
      performance.now() >= silenceAmbientUntil &&
      activeMedia.size === 0 &&
      activeSynth.size === 0
    );
  }

  function playRealSound(type, quiet = false, source = 'manual') {
    const isAmbient = source === 'ambient';
    if (isAmbient && !canPlayAmbient()) return false;

    const base = preloaded[type];
    const settings = SOUND_SETTINGS[type];

    if (!base || !settings) {
      if (synthFallback[type]) synthFallback[type](quiet);
      return false;
    }

    if (!isAmbient) stopAllAnimalSounds();

    const clip = base.cloneNode(true);
    clip.preload = 'auto';
    clip.playsInline = true;
    clip.volume = quiet ? settings.ambientVolume : settings.volume;
    clip.playbackRate = 0.98 + Math.random() * 0.04;

    let fallbackPlayed = false;
    const cleanup = () => activeMedia.delete(clip);
    const useFallback = () => {
      cleanup();
      if (fallbackPlayed) return;
      fallbackPlayed = true;
      if (synthFallback[type]) synthFallback[type](quiet);
    };

    clip.addEventListener('ended', cleanup, { once: true });
    clip.addEventListener('error', useFallback, { once: true });
    activeMedia.add(clip);

    try {
      const promise = clip.play();
      if (promise && typeof promise.catch === 'function') promise.catch(useFallback);
    } catch (_) {
      useFallback();
    }

    window.setTimeout(() => {
      if (activeMedia.has(clip)) {
        try {
          clip.pause();
          clip.currentTime = 0;
        } catch (_) {}
        cleanup();
      }
    }, settings.maxDuration * 1000);

    return true;
  }

  function findAnimal(object) {
    let current = object;
    while (current) {
      if (current.userData && current.userData.bird) {
        const bird = current.userData.bird;
        return {
          type: bird.role === 'rooster' ? 'rooster' : 'hen',
          group: bird.group || current
        };
      }
      if (current.userData && current.userData.farmAnimal) {
        return current.userData.farmAnimal;
      }
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

  function playAnimal(animal, quiet = false, source = 'manual') {
    if (!animal || !REAL_SOUND_URLS[animal.type]) return;
    playRealSound(animal.type, quiet, source);
  }

  function hasAnimal(type) {
    let found = false;
    scene.traverse(object => {
      if (found || !object.userData) return;
      if (object.userData.bird) {
        const role = object.userData.bird.role === 'rooster' ? 'rooster' : 'hen';
        if (role === type) found = true;
      } else if (
        object.userData.farmAnimal &&
        object.userData.farmAnimal.type === type
      ) {
        found = true;
      }
    });
    return found;
  }

  function randomDelay(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function scheduleNaturalCall(type, minimum, maximum, chance = 0.68) {
    window.setTimeout(() => {
      if (
        hasAnimal(type) &&
        canPlayAmbient() &&
        Math.random() < chance
      ) {
        playRealSound(type, true, 'ambient');
      }
      scheduleNaturalCall(type, minimum, maximum, chance);
    }, randomDelay(minimum, maximum));
  }

  canvas.addEventListener('pointerdown', event => {
    mediaUnlocked = true;
    audio();
    down = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
  }, { passive: true });

  window.addEventListener('pointerup', event => {
    if (!down) return;

    const start = down;
    down = null;

    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 14) return;
    if (performance.now() - start.time > 850) return;

    const animal = hit(event.clientX, event.clientY);
    if (!animal) return;

    const now = performance.now();

    // Le gestionnaire historique passe ensuite : on bloque son éventuel son
    // supplémentaire, quel que soit l'animal réellement touché.
    suppressBirdUntil = now + 1800;

    // Pendant quelques secondes, aucun cri ambiant ne peut se superposer au
    // cri de l'animal touché.
    silenceAmbientUntil = now + 5000;

    stopAllAnimalSounds();
    playAnimal(animal, false, 'manual');
  }, true);

  // Le moteur appelle encore ces fonctions. Elles restent naturelles et rares,
  // sans jamais se superposer à un animal que le joueur vient de toucher.
  if (typeof playCluck === 'function') {
    playCluck = function occasionalRealCluck() {
      const now = performance.now();
      if (now < suppressBirdUntil || now < silenceAmbientUntil) return;
      if (now - lastHenCall < 22000 || Math.random() > 0.42) return;

      lastHenCall = now;
      playRealSound('hen', true, 'ambient');
    };
  }

  if (typeof playCrow === 'function') {
    playCrow = function occasionalRealCrow() {
      const now = performance.now();
      if (now < suppressBirdUntil || now < silenceAmbientUntil) return;
      if (now - lastRoosterCall < 50000 || Math.random() > 0.48) return;

      lastRoosterCall = now;
      playRealSound('rooster', true, 'ambient');
    };
  }

  // Cris naturels, espacés et non simultanés.
  scheduleNaturalCall('cow', 50000, 90000, 0.65);
  scheduleNaturalCall('sheep', 38000, 75000, 0.7);
  scheduleNaturalCall('duck', 32000, 65000, 0.62);
  scheduleNaturalCall('pig', 45000, 85000, 0.68);

  // Outil de test depuis la console Android/WebView.
  window.playFarmAnimalSound = type => {
    mediaUnlocked = true;
    silenceAmbientUntil = performance.now() + 4000;
    stopAllAnimalSounds();
    playRealSound(type, false, 'manual');
  };
})();
