'use strict';
(() => {
  if (
    typeof THREE === 'undefined' ||
    typeof scene === 'undefined' ||
    typeof camera === 'undefined' ||
    typeof renderer === 'undefined' ||
    !window.FarmStructureV2
  ) return;

  const old = scene.getObjectByName('farm-living-world-v3');
  if (old && old.parent) old.parent.remove(old);

  const root = new THREE.Group();
  root.name = 'farm-living-world-v3';
  scene.add(root);

  const state = {
    F: window.FarmStructureV2,
    root,
    animals: [],
    scans: [],
    updates: [],
    unlockCallbacks: [],
    audioUnlocked: false,
    audioContext: null,
    last: performance.now(),
    scanTimer: 0
  };

  state.V = (x, z, y = 0) => new THREE.Vector3(x, y, z);
  state.mat = (color, roughness = 0.9, metalness = 0) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: false
    });

  state.mesh = (geometry, material, x, y, z, scale = null, rotation = null) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    if (scale) object.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
    object.castShadow = true;
    object.receiveShadow = true;
    return object;
  };

  state.notify = message => {
    if (typeof setFarmStatus === 'function') setFarmStatus(message);
  };

  state.hour = () => {
    const element = document.getElementById('tm');
    const match = element && String(element.textContent).match(/(\d{1,2}):/);
    return match ? Number(match[1]) : 12;
  };

  state.isNight = () => {
    const hour = state.hour();
    return hour >= 20 || hour < 6;
  };

  state.weather = () =>
    window.farmClimateState && window.farmClimateState.weather || 'sun';

  state.season = () =>
    window.farmClimateState && window.farmClimateState.season || 'spring';

  state.audio = () => {
    if (!state.audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context) state.audioContext = new Context();
    }

    if (state.audioContext && state.audioContext.state === 'suspended') {
      state.audioContext.resume().catch(() => {});
    }

    return state.audioContext;
  };

  state.onAudioUnlock = callback => {
    if (state.audioUnlocked) callback();
    else state.unlockCallbacks.push(callback);
  };

  state.addUpdate = callback => state.updates.push(callback);
  state.addScan = callback => state.scans.push(callback);

  state.scanAnimals = () => {
    state.animals.length = 0;
    const seen = new Set();

    scene.traverse(object => {
      if (!object.userData) return;

      let group = null;
      let data = null;
      let type = null;

      if (object.userData.bird) {
        data = object.userData.bird;
        group = data.group || object;
        type = data.role === 'rooster' ? 'rooster' : 'hen';
      } else if (object.userData.farmAnimal) {
        data = object.userData.farmAnimal;
        group = data.group || object;
        type = data.type;
      }

      if (
        !group ||
        seen.has(group.uuid) ||
        !['hen', 'rooster', 'cow', 'sheep', 'duck', 'pig'].includes(type)
      ) return;

      seen.add(group.uuid);
      state.animals.push({ group, data, type });
    });
  };

  renderer.domElement.addEventListener('pointerdown', () => {
    state.audioUnlocked = true;
    state.audio();

    const callbacks = state.unlockCallbacks.splice(0);
    callbacks.forEach(callback => {
      try { callback(); } catch (error) { console.error(error); }
    });
  }, { passive: true });

  function loop(now) {
    requestAnimationFrame(loop);

    const delta = Math.min(
      0.05,
      Math.max(0, (now - state.last) / 1000)
    );

    state.last = now;
    state.scanTimer -= delta;

    if (state.scanTimer <= 0) {
      state.scanTimer = 0.75;
      state.scanAnimals();
      state.scans.forEach(callback => {
        try { callback(state.animals); } catch (error) { console.error(error); }
      });
    }

    const time = now / 1000;
    state.updates.forEach(callback => {
      try { callback(delta, time); } catch (error) { console.error(error); }
    });
  }

  window.FarmLivingV3 = state;
  requestAnimationFrame(loop);
})();