'use strict';
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || typeof renderer === 'undefined') return;

  const BARN_ENTRY = new THREE.Vector3(13, 0, 10.55);
  const BARN_INSIDE = new THREE.Vector3(13, 0, 13.45);
  const HOUSE_DOOR = new THREE.Vector3(-10.5, 0, -14.9);
  const NEST_POINT = new THREE.Vector3(-10.55, 0, -4.0);
  const shelter = new Map();
  let roadRoot = null;
  let collector = null;
  let collectCooldown = 2;
  let wasRaining = false;
  let lastFrame = performance.now();

  const mat = (color, roughness = 0.9, metalness = 0) => new THREE.MeshStandardMaterial({
    color, roughness, metalness, flatShading: false
  });

  function mesh(geometry, material, position, scale, rotation) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(position[0], position[1], position[2]);
    if (scale) item.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) item.rotation.set(rotation[0], rotation[1], rotation[2]);
    item.castShadow = true;
    item.receiveShadow = true;
    return item;
  }

  function largestColor(group, fallback) {
    let result = new THREE.Color(fallback);
    let score = -1;
    group.traverse(object => {
      if (!object.isMesh || !object.geometry || !object.material) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      if (!material || !material.color) return;
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const volume = size.x * size.y * size.z;
      if (volume > score) {
        score = volume;
        result = material.color.clone();
      }
    });
    return result;
  }

  // Routes sous les barrières et arrêtées avant chaque enclos.
  function makeRoadTexture(cobble) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = cobble ? '#887968' : '#98704c';
    ctx.fillRect(0, 0, 192, 192);
    if (cobble) {
      for (let row = 0; row < 8; row += 1) {
        for (let column = 0; column < 7; column += 1) {
          const x = column * 30 + (row % 2 ? 15 : 0) - 8;
          const y = row * 25 - 4;
          const shade = 108 + Math.floor(Math.random() * 38);
          ctx.fillStyle = `rgb(${shade + 16},${shade + 8},${shade})`;
          ctx.strokeStyle = 'rgba(54,43,35,.42)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, y, 27, 21, 5); else ctx.rect(x, y, 27, 21);
          ctx.fill();
          ctx.stroke();
        }
      }
    } else {
      for (let index = 0; index < 1200; index += 1) {
        const tone = 70 + Math.floor(Math.random() * 90);
        ctx.fillStyle = `rgba(${tone + 54},${tone + 29},${tone + 8},${0.08 + Math.random() * 0.2})`;
        ctx.fillRect(Math.random() * 192, Math.random() * 192, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  const dirtTexture = makeRoadTexture(false);
  const cobbleTexture = makeRoadTexture(true);

  function road(x1, z1, x2, z2, width, cobble = false) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const texture = (cobble ? cobbleTexture : dirtTexture).clone();
    texture.needsUpdate = true;
    texture.repeat.set(Math.max(1, width / 2.2), Math.max(1, length / 4.5));
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 3,
      polygonOffsetUnits: 3
    });
    const segment = mesh(
      new THREE.BoxGeometry(width, 0.026, length),
      material,
      [(x1 + x2) / 2, 0.014, (z1 + z2) / 2],
      null,
      [0, Math.atan2(dx, dz), 0]
    );
    segment.castShadow = false;
    segment.renderOrder = -20;
    segment.userData.farmRoad = true;
    segment.userData.safeRoad = true;
    roadRoot.add(segment);
  }

  function rebuildRoads() {
    if (scene.getObjectByName('farm-safe-road-network-v2')) return;
    const remove = [];
    scene.traverse(object => {
      if (object.userData && object.userData.farmRoad && !object.userData.safeRoad) remove.push(object);
      if (
        object.isMesh && object.geometry && object.geometry.type === 'PlaneGeometry' &&
        Math.abs(object.position.x - 20) < 0.2 && Math.abs(object.position.z + 2) < 0.2
      ) remove.push(object);
    });
    remove.forEach(object => object.parent && object.parent.remove(object));

    roadRoot = new THREE.Group();
    roadRoot.name = 'farm-safe-road-network-v2';
    scene.add(roadRoot);

    road(20, -40, 20, 24, 5.2, true);
    road(-29, -23, 28, -23, 5.3, false);
    road(-18, 22.5, 20, 22.5, 4.1, false);
    road(-10.5, -23, -10.5, -15.8, 2.8, false);
    road(20, -15.6, 13.6, -15.6, 3.6, true);
    road(13.6, -16.25, 3, -16.25, 2.35, false);
    road(20, -6, 5.85, -6, 3.25, false);
    road(20, 0, 15.35, 0, 2.7, false);
    road(0, 22.5, 0, 21.35, 2.25, false);
    road(-11.5, 22.5, -11.5, 20.35, 2.25, false);
  }

  function raiseClouds() {
    let index = 0;
    scene.traverse(object => {
      if (!object.isGroup || object.name !== 'moving-cloud') return;
      if (!object.userData.highCloudFixed) {
        object.userData.highCloudFixed = true;
        object.scale.multiplyScalar(0.92);
      }
      object.position.y = Math.max(object.position.y, 28 + (index % 5) * 2 + Math.random() * 0.08);
      index += 1;
    });
  }

  // Taches de vache en décals plats.
  function decalMaterial(color) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.93,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3
    });
  }

  function patchCluster(parent, material, position, rotation, pieces) {
    const cluster = new THREE.Group();
    cluster.position.set(position[0], position[1], position[2]);
    cluster.rotation.set(rotation[0], rotation[1], rotation[2]);
    pieces.forEach((piece, index) => {
      const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 22), material);
      spot.position.set(piece[2], piece[3], index * 0.0008);
      spot.scale.set(piece[0], piece[1], 1);
      spot.castShadow = false;
      spot.renderOrder = 4;
      cluster.add(spot);
    });
    parent.add(cluster);
  }

  function flattenCow(group) {
    if (!group || group.userData.flatCowPatchesV2) return;
    group.userData.flatCowPatchesV2 = true;
    const old = group.getObjectByName('visual-cow-details');
    if (old && old.parent) old.parent.remove(old);

    group.children.forEach(child => {
      if (!child.isMesh || !child.geometry || child.geometry.type !== 'SphereGeometry') return;
      const radius = Number((child.geometry.parameters || {}).radius || 0);
      const maxScale = Math.max(child.scale.x, child.scale.y, child.scale.z);
      if (radius >= 0.9 && maxScale < 0.62 && child.position.y > 0.62) child.visible = false;
    });

    const coat = largestColor(group, 0xeee4d2);
    const patch = decalMaterial(coat.r + coat.g + coat.b > 1.55 ? 0x40312b : 0xe5d2b6);
    const root = new THREE.Group();
    root.name = 'cow-flat-patches-v2';
    patchCluster(root, patch, [-0.2, 1.455, -0.22], [-Math.PI / 2, 0, 0.18], [
      [0.28, 0.38, 0, 0], [0.17, 0.22, 0.18, -0.11], [0.12, 0.18, -0.18, 0.12]
    ]);
    patchCluster(root, patch, [0.25, 1.44, 0.34], [-Math.PI / 2, 0, -0.24], [
      [0.23, 0.31, 0, 0], [0.12, 0.18, -0.15, -0.1]
    ]);
    patchCluster(root, patch, [-0.602, 0.95, 0.02], [0, -Math.PI / 2, 0.16], [
      [0.26, 0.34, 0, 0], [0.14, 0.19, 0.16, -0.13]
    ]);
    patchCluster(root, patch, [0.602, 0.93, -0.38], [0, Math.PI / 2, -0.18], [
      [0.22, 0.3, 0, 0], [0.13, 0.16, -0.14, 0.1]
    ]);
    group.add(root);
  }

  // Poules affinées et plus plumeuses sans changer leurs données de gameplay.
  function refineChicken(group, bird) {
    if (!group || group.userData.refinedChickenV2) return;
    group.userData.refinedChickenV2 = true;
    ['visual-bird-details', 'chicken-refined-details-v2'].forEach(name => {
      const old = group.getObjectByName(name);
      if (old && old.parent) old.parent.remove(old);
    });
    if (bird.head) {
      ['visual-bird-head-details', 'chicken-refined-head-v2'].forEach(name => {
        const old = bird.head.getObjectByName(name);
        if (old && old.parent) old.parent.remove(old);
      });
    }

    const base = largestColor(group, bird.role === 'rooster' ? 0x302a20 : 0xb5824a);
    const light = mat(base.clone().lerp(new THREE.Color(0xffffff), 0.24).getHex(), 0.93);
    const mid = mat(base.clone().lerp(new THREE.Color(0xffffff), 0.06).getHex(), 0.91);
    const dark = mat(base.clone().lerp(new THREE.Color(0x17120f), bird.role === 'rooster' ? 0.48 : 0.3).getHex(), 0.88);
    const warm = mat(base.clone().lerp(new THREE.Color(0xc66e32), 0.18).getHex(), 0.92);
    const red = mat(bird.role === 'rooster' ? 0xd62c2c : 0xc7443a, 0.62);
    const beak = mat(0xe1a03a, 0.58);
    const leg = mat(0xd78e2e, 0.72);

    group.children.forEach(child => {
      if (!child.isMesh || !child.geometry) return;
      if (child.geometry.type === 'SphereGeometry') {
        if (Math.abs(child.position.x) < 0.05 && child.position.y > 0.46 && child.position.y < 0.56 && Math.abs(child.position.z) < 0.12) {
          child.scale.multiply(new THREE.Vector3(0.9, 1.06, 1.03));
        } else if (Math.abs(child.position.x) < 0.05 && child.position.y > 0.36 && child.position.y < 0.49 && child.position.z > 0.18) {
          child.scale.multiply(new THREE.Vector3(0.86, 1.1, 0.94));
        }
      }
      if (child.geometry.type === 'ConeGeometry' && child.position.z < -0.4) child.visible = false;
    });

    const root = new THREE.Group();
    root.name = 'chicken-refined-details-v2';
    [
      [0.69, 0.34, 3, 0.105, light],
      [0.59, 0.39, 4, 0.095, light],
      [0.49, 0.39, 3, 0.11, warm]
    ].forEach(row => {
      for (let index = 0; index < row[2]; index += 1) {
        const centered = index - (row[2] - 1) / 2;
        root.add(mesh(
          new THREE.SphereGeometry(1, 10, 7), row[4],
          [centered * 0.12, row[0], row[1] - Math.abs(centered) * 0.015],
          [row[3], 0.035, 0.155], [-0.18, 0, centered * 0.055]
        ));
      }
    });

    [-1, 1].forEach(side => {
      for (let row = 0; row < 3; row += 1) {
        const count = row === 0 ? 4 : 5;
        for (let index = 0; index < count; index += 1) {
          root.add(mesh(
            new THREE.SphereGeometry(1, 10, 7), row === 0 ? mid : dark,
            [side * (0.35 + row * 0.018), 0.64 - row * 0.085, 0.19 - index * 0.145 - row * 0.025],
            [0.065 + row * 0.006, 0.027, 0.18 - row * 0.014],
            [0.16 + index * 0.025, side * 0.27, side * (0.1 + row * 0.035)]
          ));
        }
      }
    });

    const tails = bird.role === 'rooster' ? 8 : 6;
    for (let index = 0; index < tails; index += 1) {
      const centered = index - (tails - 1) / 2;
      const special = bird.role === 'rooster' && index % 2 === 0;
      const tailMat = special ? mat(index % 4 === 0 ? 0x164c3c : 0x223f58, 0.72) : dark;
      root.add(mesh(
        new THREE.ConeGeometry(bird.role === 'rooster' ? 0.052 : 0.048, (bird.role === 'rooster' ? 0.72 : 0.43) - Math.abs(centered) * 0.04, 8),
        tailMat,
        [centered * 0.055, 0.73 + Math.abs(centered) * 0.026, -0.52],
        null,
        [-1.18 - Math.abs(centered) * 0.045, 0, centered * 0.12]
      ));
    }

    [-1, 1].forEach(side => [-0.05, 0, 0.05].forEach((spread, index) => {
      root.add(mesh(
        new THREE.CylinderGeometry(0.011, 0.016, 0.17, 7), leg,
        [side * 0.13 + spread, 0.02, 0.055 + index * 0.02],
        null,
        [Math.PI / 2.22, 0, spread * 5.2]
      ));
    }));
    group.add(root);

    if (!bird.head) return;
    bird.head.children.forEach(child => {
      if (
        child.isMesh && child.geometry && child.geometry.type === 'ConeGeometry' &&
        child.position.y > 0.1 && Math.abs(child.position.z) < 0.12
      ) child.visible = false;
    });
    const head = new THREE.Group();
    head.name = 'chicken-refined-head-v2';
    const lobes = bird.role === 'rooster' ? 6 : 4;
    for (let index = 0; index < lobes; index += 1) {
      const ratio = index / Math.max(1, lobes - 1);
      const height = (bird.role === 'rooster' ? 0.13 : 0.082) * (0.82 + Math.sin(ratio * Math.PI) * 0.22);
      head.add(mesh(new THREE.SphereGeometry(1, 10, 8), red, [0, 0.19 + height * 0.34, -0.1 + ratio * 0.2], [0.052, height, 0.052]));
    }
    head.add(mesh(new THREE.ConeGeometry(0.057, 0.155, 9), beak, [0, 0.004, 0.225], null, [Math.PI / 2, 0, 0]));
    head.add(mesh(new THREE.ConeGeometry(0.043, 0.115, 9), beak, [0, -0.036, 0.207], null, [Math.PI / 2 + 0.16, 0, 0]));
    [-1, 1].forEach(side => head.add(mesh(
      new THREE.SphereGeometry(1, 9, 7), red,
      [side * 0.035, -0.15, 0.16],
      [bird.role === 'rooster' ? 0.052 : 0.035, bird.role === 'rooster' ? 0.095 : 0.06, 0.035],
      [0, 0, side * 0.13]
    )));
    bird.head.add(head);
  }

  function scanVisuals() {
    const seen = new Set();
    scene.traverse(object => {
      if (!object.userData) return;
      if (object.userData.bird) {
        const bird = object.userData.bird;
        const root = bird.group || object;
        if (!seen.has(root.uuid)) {
          seen.add(root.uuid);
          refineChicken(root, bird);
        }
        return;
      }
      const data = object.userData.farmAnimal;
      if (data) {
        const root = data.group || object;
        if (!seen.has(root.uuid)) {
          seen.add(root.uuid);
          if (data.type === 'cow') flattenCow(root);
        }
      } else if (object.userData.cowStyleFixed && !seen.has(object.uuid)) {
        seen.add(object.uuid);
        flattenCow(object);
      }
    });
  }

  // Un fermier va physiquement jusqu'aux nids avant de retirer les œufs.
  const freeEggs = () => typeof eggs !== 'undefined' && Array.isArray(eggs)
    ? eggs.filter(egg => egg && !egg.incubating && egg.mesh && egg.mesh.visible !== false)
    : [];

  function setCollectorPath(worker, points, phase) {
    worker._eggPath = points.map(point => point.clone());
    worker._eggWaypoint = 0;
    worker._eggPhase = phase;
    worker.state = 'egg-hotfix-controlled';
  }

  function startCollection(worker) {
    worker._eggActive = true;
    worker._savedTaskIndex = worker.taskIndex;
    worker.status = 'va ramasser les œufs au poulailler';
    setCollectorPath(worker, [
      new THREE.Vector3(-8.2, 0, -12.5),
      new THREE.Vector3(-7.4, 0, -7.5),
      new THREE.Vector3(-9.3, 0, -4.2),
      NEST_POINT
    ], 'to-nests');
  }

  function walkWorker(worker, target, dt, time) {
    const dx = target.x - worker.group.position.x;
    const dz = target.z - worker.group.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.16) return true;
    const step = Math.min(distance, Math.max(1.25, Number(worker.speed) || 1.35) * dt);
    worker.group.position.x += dx / distance * step;
    worker.group.position.z += dz / distance * step;
    worker.group.rotation.y = Math.atan2(dx, dz);
    worker.group.position.y = Math.abs(Math.sin(time * 7.5 + (worker.phase || 0))) * 0.025;
    const stride = Math.sin(time * 7.5 + (worker.phase || 0)) * 0.58;
    if (worker.leftLeg) worker.leftLeg.rotation.x = stride;
    if (worker.rightLeg) worker.rightLeg.rotation.x = -stride;
    if (worker.leftArm) worker.leftArm.rotation.x = -stride * 0.62;
    if (worker.rightArm) worker.rightArm.rotation.x = stride * 0.4;
    return false;
  }

  function updateCollector(dt, time, raining) {
    collectCooldown -= dt;
    if (!collector) {
      const workers = window.farmWorkerState;
      if (Array.isArray(workers) && workers.length) collector = workers[0];
    }
    const worker = collector;
    if (!worker || !worker.group) return;

    if (!worker._eggActive) {
      if (!raining && collectCooldown <= 0 && freeEggs().length && worker.state === 'wait') {
        collectCooldown = 5;
        startCollection(worker);
      }
      return;
    }

    if (worker._eggPhase === 'to-nests' || worker._eggPhase === 'return-home') {
      const target = worker._eggPath[worker._eggWaypoint];
      if (!target) {
        if (worker._eggPhase === 'to-nests') {
          worker._eggPhase = 'collecting';
          worker._eggTimer = 2.8;
          worker.status = 'ramasse les œufs dans les nids';
        } else {
          worker._eggActive = false;
          worker._eggPhase = null;
          worker.state = 'wait';
          worker.wait = 7 + Math.random() * 5;
          worker.taskIndex = worker._savedTaskIndex;
          worker.status = 'à la maison';
        }
        return;
      }
      if (walkWorker(worker, target, dt, time)) worker._eggWaypoint += 1;
      return;
    }

    if (worker._eggPhase === 'collecting') {
      worker._eggTimer -= dt;
      worker.group.position.y = 0;
      if (worker.leftArm) worker.leftArm.rotation.x = -0.75;
      if (worker.rightArm) worker.rightArm.rotation.x = -0.9 + Math.sin(time * 8) * 0.12;
      if (worker.bucket) worker.bucket.rotation.z = -0.65;
      if (worker._eggTimer > 0) return;

      const collected = freeEggs();
      collected.forEach(egg => {
        if (typeof removeEgg === 'function') removeEgg(egg);
        else if (egg.mesh && egg.mesh.parent) egg.mesh.parent.remove(egg.mesh);
      });
      if (worker.bucket) worker.bucket.rotation.z = 0;
      if (worker.leftArm) worker.leftArm.rotation.x = 0;
      if (worker.rightArm) worker.rightArm.rotation.x = 0;
      if (collected.length && typeof setFarmStatus === 'function') {
        setFarmStatus(`Le fermier a ramassé ${collected.length} œuf${collected.length > 1 ? 's' : ''} directement dans les nids.`);
      }
      worker.status = 'rapporte les œufs à la maison';
      setCollectorPath(worker, [
        new THREE.Vector3(-9.3, 0, -4.2),
        new THREE.Vector3(-7.4, 0, -7.5),
        new THREE.Vector3(-8.2, 0, -12.5),
        HOUSE_DOOR
      ], 'return-home');
    }
  }

  // Tous les animaux interrompent leur routine et entrent dans la grange sous la pluie.
  function animals() {
    const list = [];
    const seen = new Set();
    scene.traverse(object => {
      if (!object.userData) return;
      let root = null;
      let data = null;
      let type = null;
      if (object.userData.bird) {
        data = object.userData.bird;
        root = data.group || object;
        type = data.role === 'rooster' ? 'rooster' : 'hen';
      } else if (object.userData.farmAnimal) {
        data = object.userData.farmAnimal;
        root = data.group || object;
        type = data.type;
      }
      if (!root || seen.has(root.uuid) || !['hen', 'rooster', 'cow', 'sheep', 'duck', 'pig'].includes(type)) return;
      seen.add(root.uuid);
      list.push({ root, data, type });
    });
    return list;
  }

  function rainActive() {
    const label = document.getElementById('wx');
    return Boolean(label && /pluie|orage/i.test(label.textContent || ''));
  }

  function speed(type) {
    if (type === 'cow') return 1.05;
    if (type === 'sheep') return 1.22;
    if (type === 'duck') return 1.35;
    if (type === 'pig') return 1.18;
    return 1.55;
  }

  function capture(animal, index) {
    if (shelter.has(animal.root)) return shelter.get(animal.root);
    const record = {
      root: animal.root,
      data: animal.data,
      type: animal.type,
      index,
      position: animal.root.position.clone(),
      rotationY: animal.root.rotation.y,
      visible: animal.root.visible,
      state: animal.data && animal.data.state,
      stateTimer: animal.data && animal.data.stateTimer,
      target: animal.data && animal.data.target && animal.data.target.clone ? animal.data.target.clone() : null,
      phase: 'entry',
      hidden: false,
      entry: BARN_ENTRY.clone().add(new THREE.Vector3(((index % 5) - 2) * 0.28, 0, Math.floor(index / 5) * 0.16)),
      inside: BARN_INSIDE.clone().add(new THREE.Vector3(((index % 5) - 2) * 0.22, 0, Math.floor(index / 5) * 0.18))
    };
    if (animal.data) {
      animal.data.state = 'rainBarnShelter';
      animal.data.stateTimer = 999999;
    }
    animal.root.visible = true;
    shelter.set(animal.root, record);
    return record;
  }

  function moveAnimal(record, target, dt) {
    const dx = target.x - record.root.position.x;
    const dz = target.z - record.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.18) return true;
    const step = Math.min(distance, speed(record.type) * dt);
    record.root.position.x += dx / distance * step;
    record.root.position.z += dz / distance * step;
    record.root.rotation.y = Math.atan2(dx, dz);
    record.root.position.y = Math.abs(Math.sin(performance.now() * 0.007 + record.index)) * 0.025;
    return false;
  }

  function updateShelter(dt, raining) {
    if (raining) {
      animals().forEach((animal, index) => capture(animal, index));
      shelter.forEach(record => {
        if (!record.root || !record.root.parent || record.hidden) return;
        if (record.data) {
          record.data.state = 'rainBarnShelter';
          record.data.stateTimer = 999999;
        }
        if (record.phase === 'entry') {
          if (moveAnimal(record, record.entry, dt)) record.phase = 'inside';
        } else if (moveAnimal(record, record.inside, dt)) {
          record.root.visible = false;
          record.hidden = true;
        }
      });
      if (!wasRaining && typeof setFarmStatus === 'function') {
        setFarmStatus('La pluie commence : tous les animaux se dirigent vers la grange.');
      }
      wasRaining = true;
      return;
    }

    if (wasRaining) {
      shelter.forEach(record => {
        record.root.visible = record.visible;
        record.root.position.copy(record.position);
        record.root.rotation.y = record.rotationY;
        if (record.data) {
          record.data.state = record.state;
          record.data.stateTimer = record.stateTimer;
          if (record.target && record.data.target && record.data.target.copy) record.data.target.copy(record.target);
        }
      });
      shelter.clear();
      if (typeof setFarmStatus === 'function') setFarmStatus('La pluie cesse : les animaux ressortent de la grange.');
    }
    wasRaining = false;
  }

  function polish() {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const anisotropy = renderer.capabilities && renderer.capabilities.getMaxAnisotropy
      ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
      : 1;
    scene.traverse(object => {
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (!material) return;
        if (material.map) material.map.anisotropy = anisotropy;
        if (material.isMeshStandardMaterial) {
          material.flatShading = false;
          material.needsUpdate = true;
        }
      });
    });
  }

  rebuildRoads();
  raiseClouds();
  scanVisuals();
  polish();
  window.setInterval(() => {
    raiseClouds();
    scanVisuals();
  }, 900);

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const raining = rainActive();
    updateShelter(dt, raining);
    updateCollector(dt, now / 1000, raining);
  }
  requestAnimationFrame(loop);
})();
