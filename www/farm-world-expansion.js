'use strict';
(() => {
  if (
    typeof THREE === 'undefined' ||
    typeof scene === 'undefined' ||
    typeof renderer === 'undefined'
  ) return;

  const LOGISTICS_KEY = 'elevage.logistics.v2';
  const expansionRoot = new THREE.Group();
  expansionRoot.name = 'farm-major-expansion';
  scene.add(expansionRoot);

  const tmpVector = new THREE.Vector3();
  const clock = new THREE.Clock();
  const clouds = [];
  const workers = [];
  const roadSegments = [];
  const rainDrops = [];
  const productCrates = [];
  let lastEggCount = typeof eggCount === 'number' ? eggCount : 0;
  let productionTimer = 18;
  let weatherWasRainy = false;
  let stormActive = false;
  let lightningTimer = 4;
  let truckCountdown = 24;
  let lastFrameTime = performance.now();

  function readStoredLogistics() {
    try {
      const value = JSON.parse(localStorage.getItem(LOGISTICS_KEY) || 'null');
      if (!value || typeof value !== 'object') throw new Error('invalid');
      return {
        eggs: Math.max(0, Number(value.eggs) || 0),
        milk: Math.max(0, Number(value.milk) || 0),
        wool: Math.max(0, Number(value.wool) || 0),
        duck: Math.max(0, Number(value.duck) || 0),
        deliveries: Math.max(0, Number(value.deliveries) || 0),
        totalRevenue: Math.max(0, Number(value.totalRevenue) || 0)
      };
    } catch (_) {
      return { eggs: 0, milk: 0, wool: 0, duck: 0, deliveries: 0, totalRevenue: 0 };
    }
  }

  const logistics = readStoredLogistics();
  logistics.truckState = 'hors de la ferme';
  logistics.nextTruck = truckCountdown;
  logistics.lastRevenue = 0;
  window.farmLogisticsState = logistics;

  function saveLogistics() {
    try {
      localStorage.setItem(LOGISTICS_KEY, JSON.stringify({
        eggs: logistics.eggs,
        milk: logistics.milk,
        wool: logistics.wool,
        duck: logistics.duck,
        deliveries: logistics.deliveries,
        totalRevenue: logistics.totalRevenue
      }));
    } catch (_) {}
  }

  function saveCoins() {
    const economy = window.farmEconomyState;
    if (!economy) return;
    try {
      const key = 'elevage.systems.v1';
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      saved.coins = Math.max(0, Math.floor(Number(economy.coins) || 0));
      localStorage.setItem(key, JSON.stringify(saved));
    } catch (_) {}
  }

  function notify(message) {
    if (typeof setFarmStatus === 'function') setFarmStatus(message);
  }

  function mat(color, roughness = 0.86, metalness = 0) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: false
    });
  }

  function mesh(geometry, material, x, y, z, scale, rotation) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    if (scale) object.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
    object.castShadow = true;
    object.receiveShadow = true;
    return object;
  }

  function applyRenderingUpgrade() {
    if (typeof THREE.sRGBEncoding !== 'undefined') renderer.outputEncoding = THREE.sRGBEncoding;
    if (typeof THREE.ACESFilmicToneMapping !== 'undefined') {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.traverse(object => {
      if (!object.isMesh || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (!material || !material.isMeshStandardMaterial) return;
        material.flatShading = false;
        material.roughness = Math.min(1, Math.max(0.56, material.roughness || 0.84));
        material.needsUpdate = true;
      });
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }

  function makeGroundTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (type === 'cobble') {
      ctx.fillStyle = '#8f806e';
      ctx.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const x = col * 34 + (row % 2 ? 17 : 0) - 8;
          const y = row * 29 - 6;
          const shade = 116 + Math.floor(Math.random() * 45);
          ctx.fillStyle = `rgb(${shade + 14},${shade + 6},${shade - 4})`;
          ctx.strokeStyle = 'rgba(67,52,40,.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x, y, 31, 25, 6);
          ctx.fill();
          ctx.stroke();
        }
      }
    } else {
      ctx.fillStyle = '#9d7550';
      ctx.fillRect(0, 0, 256, 256);
      for (let index = 0; index < 1900; index += 1) {
        const value = 80 + Math.floor(Math.random() * 80);
        ctx.fillStyle = `rgba(${value + 45},${value + 20},${value},${0.08 + Math.random() * 0.2})`;
        ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
      for (let index = 0; index < 42; index += 1) {
        ctx.strokeStyle = 'rgba(87,55,32,.16)';
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        const x = Math.random() * 256;
        ctx.moveTo(x, -10);
        ctx.bezierCurveTo(x + 12, 70, x - 12, 170, x + 8, 266);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  const dirtTexture = makeGroundTexture('dirt');
  const cobbleTexture = makeGroundTexture('cobble');
  const dirtMaterial = new THREE.MeshStandardMaterial({ map: dirtTexture, roughness: 1, metalness: 0 });
  const cobbleMaterial = new THREE.MeshStandardMaterial({ map: cobbleTexture, roughness: 0.95, metalness: 0 });

  function roadSegment(x1, z1, x2, z2, width, style = 'dirt') {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const texture = style === 'cobble' ? cobbleTexture : dirtTexture;
    texture.repeat.set(Math.max(1, width / 2.4), Math.max(1, length / 5));

    const segment = mesh(
      new THREE.BoxGeometry(width, 0.055, length),
      style === 'cobble' ? cobbleMaterial : dirtMaterial,
      (x1 + x2) / 2,
      0.055,
      (z1 + z2) / 2,
      null,
      [0, Math.atan2(dx, dz), 0]
    );
    segment.receiveShadow = true;
    segment.castShadow = false;
    segment.userData.farmRoad = true;
    expansionRoot.add(segment);
    roadSegments.push(segment);

    const edgeMaterial = mat(style === 'cobble' ? 0x66584a : 0x6d5239, 0.98);
    [-1, 1].forEach(side => {
      const edge = mesh(
        new THREE.BoxGeometry(0.16, 0.08, length),
        edgeMaterial,
        side * (width / 2 + 0.05),
        0.075,
        0
      );
      segment.add(edge);
    });
    return segment;
  }

  function buildRoadNetwork() {
    roadSegment(20, -38, 20, 23, 5.3, 'cobble');
    roadSegment(-28, -23, 28, -23, 5.5, 'dirt');
    roadSegment(20, -15, 12, -15, 3.7, 'cobble');
    roadSegment(12, -15, 7, -8, 3.1, 'dirt');
    roadSegment(7, -8, 5.2, -6, 2.8, 'dirt');
    roadSegment(-10, -15.1, 12, -15.1, 2.7, 'dirt');
    roadSegment(-10, -15.1, -2, 3.2, 2.2, 'dirt');
    roadSegment(-2, 3.2, 0, 14, 2.1, 'dirt');
    roadSegment(-2, 3.2, -11.5, 13.3, 2.1, 'dirt');
    roadSegment(-2, 3.2, 8.1, 3.8, 2.1, 'dirt');
  }

  function makeSign(text, x, y, z, scale = 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6b4a32';
    ctx.roundRect(8, 14, 496, 100, 18);
    ctx.fill();
    ctx.strokeStyle = '#d9b36c';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.fillStyle = '#fff4d7';
    ctx.font = '700 42px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.position.set(x, y, z);
    sprite.scale.set(4.4 * scale, 1.1 * scale, 1);
    expansionRoot.add(sprite);
    return sprite;
  }

  function buildFarmersHouse() {
    const house = new THREE.Group();
    house.name = 'farmers-house';
    const walls = mat(0xd7b48d, 0.94);
    const stone = mat(0x817463, 0.98);
    const wood = mat(0x67442e, 0.91);
    const trim = mat(0xf3e9d2, 0.9);
    const roofMat = mat(0x93482f, 0.9);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9ed2e3, roughness: 0.2, metalness: 0.08, transparent: true, opacity: 0.82 });

    house.add(mesh(new THREE.BoxGeometry(7.4, 0.65, 5.5), stone, 0, 0.33, 0));
    house.add(mesh(new THREE.BoxGeometry(7, 3.8, 5.1), walls, 0, 2.18, 0));

    const roofLeft = mesh(new THREE.BoxGeometry(7.8, 0.28, 3.5), roofMat, 0, 4.45, -1.35, null, [0.62, 0, 0]);
    const roofRight = mesh(new THREE.BoxGeometry(7.8, 0.28, 3.5), roofMat, 0, 4.45, 1.35, null, [-0.62, 0, 0]);
    house.add(roofLeft, roofRight);

    const porch = mesh(new THREE.BoxGeometry(4.5, 0.28, 1.55), wood, 0, 0.26, 3.2);
    house.add(porch);
    [-1.9, 1.9].forEach(x => {
      house.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.7, 10), wood, x, 1.55, 3.45));
    });
    const porchRoof = mesh(new THREE.BoxGeometry(4.9, 0.2, 1.9), roofMat, 0, 3.02, 3.25, null, [-0.12, 0, 0]);
    house.add(porchRoof);

    const door = mesh(new THREE.BoxGeometry(1.18, 2.35, 0.16), wood, 0, 1.48, 2.65);
    house.add(door);
    door.add(mesh(new THREE.SphereGeometry(0.07, 9, 7), mat(0xd8b663, 0.45, 0.35), 0.39, 0, 0.11));

    [-2.25, 2.25].forEach(x => {
      const frame = mesh(new THREE.BoxGeometry(1.65, 1.6, 0.18), trim, x, 2.1, 2.63);
      house.add(frame);
      frame.add(mesh(new THREE.BoxGeometry(1.37, 1.32, 0.08), glass, 0, 0, 0.1));
      frame.add(mesh(new THREE.BoxGeometry(0.08, 1.32, 0.1), trim, 0, 0, 0.18));
      frame.add(mesh(new THREE.BoxGeometry(1.37, 0.08, 0.1), trim, 0, 0, 0.18));
      const flowerBox = mesh(new THREE.BoxGeometry(1.45, 0.28, 0.42), wood, 0, -0.95, 0.22);
      frame.add(flowerBox);
      [-0.45, 0, 0.45].forEach(offset => {
        flowerBox.add(mesh(new THREE.SphereGeometry(0.16, 9, 7), mat(offset === 0 ? 0xe7a54a : 0xc85c55, 0.9), offset, 0.25, 0));
      });
    });

    const chimney = mesh(new THREE.BoxGeometry(0.75, 2.2, 0.75), stone, 2.25, 5.3, -0.7);
    house.add(chimney);

    house.position.set(-10.5, 0, -18.1);
    expansionRoot.add(house);
    makeSign('MAISON DES FERMIERS', -10.5, 2.1, -14.85, 0.8);

    const lamp = new THREE.PointLight(0xffd28a, 0.45, 7);
    lamp.position.set(-10.5, 2.8, -14.7);
    expansionRoot.add(lamp);

    return { group: house, door: new THREE.Vector3(-10.5, 0, -14.9) };
  }

  function buildClouds() {
    const cloudGeometry = new THREE.SphereGeometry(1, 16, 11);
    for (let index = 0; index < 8; index += 1) {
      const group = new THREE.Group();
      group.name = 'moving-cloud';
      const cloudMaterial = new THREE.MeshStandardMaterial({
        color: 0xf7fbff,
        roughness: 1,
        transparent: true,
        opacity: 0.9,
        depthWrite: false
      });
      const puffs = 5 + Math.floor(Math.random() * 3);
      for (let puff = 0; puff < puffs; puff += 1) {
        const ball = mesh(
          cloudGeometry,
          cloudMaterial,
          (puff - (puffs - 1) / 2) * 1.15 + (Math.random() - 0.5) * 0.35,
          Math.sin((puff / Math.max(1, puffs - 1)) * Math.PI) * 0.85,
          (Math.random() - 0.5) * 1.1,
          [1.45 + Math.random() * 0.55, 0.75 + Math.random() * 0.4, 1.2 + Math.random() * 0.5]
        );
        ball.castShadow = false;
        ball.receiveShadow = false;
        group.add(ball);
      }
      group.position.set(-36 + Math.random() * 72, 15 + Math.random() * 6, -30 + Math.random() * 58);
      group.scale.setScalar(0.85 + Math.random() * 0.7);
      group.userData.speed = 0.22 + Math.random() * 0.18;
      group.userData.material = cloudMaterial;
      expansionRoot.add(group);
      clouds.push(group);
    }
  }

  function buildRain() {
    const dropCount = 900;
    const positions = new Float32Array(dropCount * 6);
    for (let index = 0; index < dropCount; index += 1) {
      const offset = index * 6;
      const x = (Math.random() - 0.5) * 65;
      const y = Math.random() * 25 + 1;
      const z = (Math.random() - 0.5) * 65;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      positions[offset + 3] = x + 0.06;
      positions[offset + 4] = y - 0.7;
      positions[offset + 5] = z + 0.04;
      rainDrops.push({ offset, speed: 12 + Math.random() * 9 });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0xccecff, transparent: true, opacity: 0.45, depthWrite: false });
    const rain = new THREE.LineSegments(geometry, material);
    rain.visible = false;
    rain.frustumCulled = false;
    expansionRoot.add(rain);

    const lightning = new THREE.PointLight(0xd8ecff, 0, 130, 1.2);
    lightning.position.set(0, 24, 0);
    expansionRoot.add(lightning);

    return { rain, lightning };
  }

  function makeTrough(x, z, water = false) {
    const group = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(1.45, 0.35, 0.62), mat(0x6d4b35, 0.94), 0, 0.2, 0);
    group.add(body);
    const interior = mesh(new THREE.BoxGeometry(1.18, 0.08, 0.4), mat(water ? 0x5fa6d6 : 0xc69a45, water ? 0.28 : 0.96, water ? 0.08 : 0), 0, 0.4, 0);
    group.add(interior);
    group.position.set(x, 0, z);
    expansionRoot.add(group);
    return { group, interior, water };
  }

  function makeWorker(index, houseDoor) {
    const group = new THREE.Group();
    group.name = `farm-worker-${index + 1}`;
    const skin = mat(index ? 0xc98f67 : 0xe1aa7c, 0.76);
    const denim = mat(index ? 0x425f78 : 0x4f7191, 0.88);
    const shirt = mat(index ? 0xb7553d : 0xc46d3d, 0.86);
    const boots = mat(0x493429, 0.94);
    const straw = mat(index ? 0xc8a160 : 0xd8b96e, 0.92);

    const leftLeg = new THREE.Group();
    const rightLeg = new THREE.Group();
    [-1, 1].forEach(side => {
      const legGroup = side < 0 ? leftLeg : rightLeg;
      legGroup.position.set(side * 0.14, 0.72, 0);
      legGroup.add(mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.68, 9), denim, 0, -0.3, 0));
      legGroup.add(mesh(new THREE.SphereGeometry(1, 10, 7), boots, 0, -0.69, 0.09, [0.12, 0.08, 0.2]));
      group.add(legGroup);
    });

    const torso = mesh(new THREE.CylinderGeometry(0.22, 0.29, 0.68, 11), shirt, 0, 1.12, 0);
    group.add(torso);
    torso.add(mesh(new THREE.BoxGeometry(0.42, 0.54, 0.14), denim, 0, -0.04, 0.23));

    const leftArm = new THREE.Group();
    const rightArm = new THREE.Group();
    [-1, 1].forEach(side => {
      const arm = side < 0 ? leftArm : rightArm;
      arm.position.set(side * 0.31, 1.35, 0);
      arm.add(mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.58, 9), shirt, 0, -0.27, 0));
      arm.add(mesh(new THREE.SphereGeometry(0.075, 10, 7), skin, 0, -0.59, 0));
      group.add(arm);
    });

    const head = mesh(new THREE.SphereGeometry(0.2, 16, 12), skin, 0, 1.62, 0);
    group.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.024, 8, 6), mat(0x1d1714, 0.6), -0.075, 0.03, 0.18));
    head.add(mesh(new THREE.SphereGeometry(0.024, 8, 6), mat(0x1d1714, 0.6), 0.075, 0.03, 0.18));
    head.add(mesh(new THREE.SphereGeometry(1, 10, 7), mat(index ? 0x3b261d : 0x6b4027, 0.92), 0, 0.09, -0.07, [0.21, 0.12, 0.19]));

    const brim = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.045, 18), straw, 0, 1.78, 0);
    const crown = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.22, 16), straw, 0, 1.9, 0);
    group.add(brim, crown);

    const bucket = new THREE.Group();
    bucket.add(mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.22, 12), mat(0x788087, 0.5, 0.45), 0, 0, 0));
    bucket.position.set(0, -0.62, 0.08);
    rightArm.add(bucket);

    group.position.copy(houseDoor);
    group.scale.setScalar(1.03);
    expansionRoot.add(group);

    return {
      group,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      bucket,
      state: 'wait',
      wait: 4 + index * 7,
      taskIndex: index,
      path: [],
      waypoint: 0,
      actionTime: 0,
      phase: Math.random() * Math.PI * 2,
      speed: 1.35 + index * 0.08,
      houseDoor: houseDoor.clone(),
      task: null,
      status: 'à la maison'
    };
  }

  function buildFarmWorkstations() {
    return [
      { name: 'nourrit les poules', type: 'feed', target: new THREE.Vector3(3, 0, 5.6), via: [new THREE.Vector3(-2, 0, 3.2)] },
      { name: 'remplit l’abreuvoir des poules', type: 'water', target: new THREE.Vector3(3, 0, 4.1), via: [new THREE.Vector3(-2, 0, 3.2)] },
      { name: 'nourrit les vaches', type: 'feed', target: new THREE.Vector3(7.9, 0, 3.2), via: [new THREE.Vector3(-2, 0, 3.2)] },
      { name: 'remplit l’eau des moutons', type: 'water', target: new THREE.Vector3(0, 0, 13.9), via: [new THREE.Vector3(-2, 0, 3.2)] },
      { name: 'nourrit les canards', type: 'feed', target: new THREE.Vector3(-11.5, 0, 13.2), via: [new THREE.Vector3(-2, 0, 3.2)] },
      { name: 's’occupe des cochons', type: 'feed', target: new THREE.Vector3(3, 0, -9.3), via: [new THREE.Vector3(-2, 0, 3.2)] }
    ];
  }

  const actionParticles = [];

  function createActionParticles(worker, type) {
    const count = type === 'water' ? 16 : 22;
    const color = type === 'water' ? 0x6eb9e5 : 0xd3a54a;
    const material = mat(color, type === 'water' ? 0.3 : 0.92, type === 'water' ? 0.08 : 0);
    for (let index = 0; index < count; index += 1) {
      const particle = mesh(
        new THREE.SphereGeometry(type === 'water' ? 0.025 : 0.035, 7, 5),
        material,
        worker.group.position.x + (Math.random() - 0.5) * 0.18,
        0.95 + Math.random() * 0.25,
        worker.group.position.z + 0.15,
        [1, type === 'water' ? 1.5 : 1, 1]
      );
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.65,
        0.8 + Math.random() * 0.45,
        0.55 + Math.random() * 0.55
      );
      particle.userData.life = 1 + Math.random() * 0.65;
      particle.userData.maxLife = particle.userData.life;
      expansionRoot.add(particle);
      actionParticles.push(particle);
    }
  }

  function nextTask(worker, tasks) {
    worker.task = tasks[worker.taskIndex % tasks.length];
    worker.taskIndex += 1;
    worker.path = worker.task.via.map(point => point.clone());
    worker.path.push(worker.task.target.clone());
    worker.waypoint = 0;
    worker.state = 'walking';
    worker.status = worker.task.name;
  }

  function updateWorker(worker, tasks, dt, time) {
    if (worker.state === 'wait') {
      worker.wait -= dt;
      if (worker.wait <= 0) nextTask(worker, tasks);
      worker.leftLeg.rotation.x *= 0.88;
      worker.rightLeg.rotation.x *= 0.88;
      worker.leftArm.rotation.x *= 0.88;
      worker.rightArm.rotation.x *= 0.88;
      return;
    }

    if (worker.state === 'walking' || worker.state === 'returning') {
      const target = worker.path[worker.waypoint];
      if (!target) {
        if (worker.state === 'walking') {
          worker.state = 'acting';
          worker.actionTime = 3.2;
          worker.status = worker.task.name;
          createActionParticles(worker, worker.task.type);
        } else {
          worker.state = 'wait';
          worker.wait = 12 + Math.random() * 13;
          worker.status = 'à la maison';
        }
        return;
      }

      const dx = target.x - worker.group.position.x;
      const dz = target.z - worker.group.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.18) {
        worker.waypoint += 1;
        return;
      }

      const step = Math.min(distance, worker.speed * dt);
      worker.group.position.x += dx / distance * step;
      worker.group.position.z += dz / distance * step;
      worker.group.rotation.y = Math.atan2(dx, dz);
      worker.group.position.y = Math.abs(Math.sin(time * 7.4 + worker.phase)) * 0.025;
      const stride = Math.sin(time * 7.4 + worker.phase) * 0.58;
      worker.leftLeg.rotation.x = stride;
      worker.rightLeg.rotation.x = -stride;
      worker.leftArm.rotation.x = -stride * 0.62;
      worker.rightArm.rotation.x = stride * 0.4;
      return;
    }

    if (worker.state === 'acting') {
      worker.actionTime -= dt;
      const progress = 1 - Math.max(0, worker.actionTime) / 3.2;
      worker.rightArm.rotation.x = -0.72 + Math.sin(progress * Math.PI * 5) * 0.18;
      worker.leftArm.rotation.x = -0.32;
      worker.bucket.rotation.z = worker.task.type === 'water' ? -0.9 : -0.65;
      worker.group.position.y = 0;
      if (worker.actionTime <= 0) {
        worker.bucket.rotation.z = 0;
        worker.rightArm.rotation.x = 0;
        worker.leftArm.rotation.x = 0;
        worker.state = 'returning';
        worker.path = worker.task.via.slice().reverse().map(point => point.clone());
        worker.path.push(worker.houseDoor.clone());
        worker.waypoint = 0;
        worker.status = 'retourne à la maison';
        notify(`Un fermier ${worker.task.name}.`);
      }
    }
  }

  function updateActionParticles(dt) {
    for (let index = actionParticles.length - 1; index >= 0; index -= 1) {
      const particle = actionParticles[index];
      particle.userData.life -= dt;
      particle.userData.velocity.y -= 1.9 * dt;
      particle.position.addScaledVector(particle.userData.velocity, dt);
      if (particle.position.y < 0.08 || particle.userData.life <= 0) {
        expansionRoot.remove(particle);
        actionParticles.splice(index, 1);
      }
    }
  }

  function countFarmAnimals() {
    const counts = { cow: 0, sheep: 0, duck: 0, pig: 0 };
    const seen = new Set();
    scene.traverse(object => {
      if (!object.userData || !object.userData.farmAnimal) return;
      const data = object.userData.farmAnimal;
      const group = data.group || object;
      const key = group.uuid || object.uuid;
      if (seen.has(key)) return;
      seen.add(key);
      if (Object.prototype.hasOwnProperty.call(counts, data.type)) counts[data.type] += 1;
    });
    return counts;
  }

  function accumulateProducts() {
    const currentEggs = typeof eggCount === 'number' ? eggCount : lastEggCount;
    const newEggs = Math.max(0, currentEggs - lastEggCount);
    lastEggCount = currentEggs;
    if (newEggs) logistics.eggs += newEggs;

    const counts = countFarmAnimals();
    logistics.milk += counts.cow * 0.55;
    logistics.wool += counts.sheep * 0.22;
    logistics.duck += counts.duck * 0.32;
    saveLogistics();
    refreshCrates();
  }

  function makeCrate(x, y, z, color) {
    const group = new THREE.Group();
    const wood = mat(0x825839, 0.94);
    group.add(mesh(new THREE.BoxGeometry(0.82, 0.52, 0.66), wood, 0, 0, 0));
    [-0.3, 0, 0.3].forEach(offset => {
      group.add(mesh(new THREE.BoxGeometry(0.09, 0.55, 0.7), mat(0x5e3f2c, 0.96), offset, 0, 0));
    });
    group.add(mesh(new THREE.BoxGeometry(0.55, 0.24, 0.05), mat(color, 0.8), 0, 0.04, 0.36));
    group.position.set(x, y, z);
    expansionRoot.add(group);
    productCrates.push(group);
    return group;
  }

  function refreshCrates() {
    const desired = Math.min(8, Math.ceil((logistics.eggs + logistics.milk + logistics.wool + logistics.duck) / 4));
    while (productCrates.length < desired) {
      const index = productCrates.length;
      const colors = [0xf0dfb4, 0x8ec8e8, 0xe8e0cf, 0xd7b66d];
      makeCrate(11.7 + (index % 4) * 0.92, 0.34 + Math.floor(index / 4) * 0.58, -12.6, colors[index % colors.length]);
    }
    while (productCrates.length > desired) {
      const crate = productCrates.pop();
      expansionRoot.remove(crate);
    }
  }

  function makeTruck() {
    const group = new THREE.Group();
    group.name = 'farm-transport-truck';
    const red = mat(0xb84a38, 0.78, 0.05);
    const cream = mat(0xf0dfbd, 0.88);
    const dark = mat(0x282b2d, 0.75, 0.2);
    const metal = mat(0x747b7e, 0.52, 0.42);
    const glass = new THREE.MeshStandardMaterial({ color: 0x8fc2d7, roughness: 0.2, metalness: 0.12, transparent: true, opacity: 0.84 });

    const chassis = mesh(new THREE.BoxGeometry(2.5, 0.32, 5.6), dark, 0, 0.7, 0);
    group.add(chassis);
    const cabin = mesh(new THREE.BoxGeometry(2.35, 1.8, 1.9), red, 0, 1.72, 1.65);
    group.add(cabin);
    cabin.add(mesh(new THREE.BoxGeometry(1.9, 0.68, 0.08), glass, 0, 0.25, 0.99));
    cabin.add(mesh(new THREE.BoxGeometry(0.08, 0.6, 1.05), glass, -1.19, 0.24, 0.22));
    cabin.add(mesh(new THREE.BoxGeometry(0.08, 0.6, 1.05), glass, 1.19, 0.24, 0.22));
    cabin.add(mesh(new THREE.BoxGeometry(0.45, 0.16, 0.12), cream, -0.62, -0.42, 1.02));
    cabin.add(mesh(new THREE.BoxGeometry(0.45, 0.16, 0.12), cream, 0.62, -0.42, 1.02));

    const cargo = mesh(new THREE.BoxGeometry(2.45, 1.8, 3.5), cream, 0, 1.62, -1.05);
    group.add(cargo);
    cargo.add(mesh(new THREE.BoxGeometry(2.15, 0.18, 0.08), red, 0, 0.48, 1.79));
    cargo.add(mesh(new THREE.BoxGeometry(2.15, 0.18, 0.08), red, 0, 0.05, 1.79));
    cargo.add(mesh(new THREE.BoxGeometry(2.15, 0.18, 0.08), red, 0, -0.38, 1.79));

    const wheels = [];
    [-1.17, 1.17].forEach(side => {
      [1.55, -1.35].forEach(z => {
        const wheel = mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.28, 18), dark, side, 0.58, z, null, [0, 0, Math.PI / 2]);
        wheel.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 14), metal, 0, 0, 0));
        group.add(wheel);
        wheels.push(wheel);
      });
    });

    group.position.set(20, 0, -39);
    group.visible = false;
    expansionRoot.add(group);

    return {
      group,
      wheels,
      state: 'waiting',
      target: new THREE.Vector3(20, 0, -39),
      speed: 5.2,
      loadingTime: 0,
      phase: 0,
      status: 'hors de la ferme'
    };
  }

  function updateTruck(truck, dt) {
    if (truck.state === 'waiting') {
      truckCountdown -= dt;
      logistics.nextTruck = Math.max(0, truckCountdown);
      if (truckCountdown <= 0) {
        truck.group.visible = true;
        truck.group.position.set(20, 0, -39);
        truck.target.set(20, 0, -15.3);
        truck.state = 'arriving-main';
        truck.status = 'arrive par la route';
        logistics.truckState = truck.status;
        notify('Le camion de transport arrive à la ferme.');
      }
      return;
    }

    if (truck.state === 'loading') {
      truck.loadingTime -= dt;
      truck.status = 'charge les produits';
      logistics.truckState = truck.status;
      if (truck.loadingTime <= 0) {
        const revenue = Math.floor(
          logistics.eggs * 8 +
          logistics.milk * 12 +
          logistics.wool * 10 +
          logistics.duck * 7
        );
        logistics.eggs = 0;
        logistics.milk = 0;
        logistics.wool = 0;
        logistics.duck = 0;
        logistics.deliveries += 1;
        logistics.lastRevenue = revenue;
        logistics.totalRevenue += revenue;
        if (window.farmEconomyState && revenue > 0) {
          window.farmEconomyState.coins = Math.max(0, Number(window.farmEconomyState.coins || 0) + revenue);
          saveCoins();
        }
        saveLogistics();
        refreshCrates();
        truck.target.set(20, 0, -15.3);
        truck.state = 'leaving-yard';
        notify(revenue > 0
          ? `Le camion a vendu la production : +${revenue} pièces.`
          : 'Le camion repart : aucun produit n’était prêt.');
      }
      return;
    }

    const dx = truck.target.x - truck.group.position.x;
    const dz = truck.target.z - truck.group.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.25) {
      if (truck.state === 'arriving-main') {
        truck.target.set(13.3, 0, -15.3);
        truck.state = 'arriving-yard';
      } else if (truck.state === 'arriving-yard') {
        truck.state = 'loading';
        truck.loadingTime = 6.5;
      } else if (truck.state === 'leaving-yard') {
        truck.target.set(20, 0, -39);
        truck.state = 'leaving-main';
      } else if (truck.state === 'leaving-main') {
        truck.group.visible = false;
        truck.state = 'waiting';
        truckCountdown = 72 + Math.random() * 38;
        logistics.nextTruck = truckCountdown;
        logistics.truckState = 'hors de la ferme';
      }
      return;
    }

    const step = Math.min(distance, truck.speed * dt);
    truck.group.position.x += dx / distance * step;
    truck.group.position.z += dz / distance * step;
    truck.group.rotation.y = Math.atan2(dx, dz);
    truck.phase += step * 1.8;
    truck.wheels.forEach(wheel => { wheel.rotation.x = truck.phase; });
    truck.status = truck.state.startsWith('arriving') ? 'arrive par la route' : 'repart vers la ville';
    logistics.truckState = truck.status;
  }

  function updateWeatherVisuals(dt, weatherVisuals) {
    const weatherLabel = document.getElementById('wx');
    const rainy = Boolean(weatherLabel && /pluie/i.test(weatherLabel.textContent));

    if (rainy && !weatherWasRainy) {
      stormActive = Math.random() < 0.48;
      lightningTimer = 2 + Math.random() * 5;
    }
    weatherWasRainy = rainy;

    weatherVisuals.rain.visible = rainy;
    weatherVisuals.rain.material.opacity = stormActive ? 0.62 : 0.38;
    clouds.forEach(cloud => {
      cloud.userData.material.color.lerp(new THREE.Color(rainy ? (stormActive ? 0x5d6872 : 0xa5afb6) : 0xf7fbff), 0.03);
      cloud.userData.material.opacity = rainy ? 0.96 : 0.88;
    });

    if (rainy) {
      const positions = weatherVisuals.rain.geometry.attributes.position.array;
      rainDrops.forEach(drop => {
        positions[drop.offset + 1] -= drop.speed * dt;
        positions[drop.offset + 4] -= drop.speed * dt;
        if (positions[drop.offset + 4] < 0) {
          const x = (Math.random() - 0.5) * 65;
          const y = 22 + Math.random() * 8;
          const z = (Math.random() - 0.5) * 65;
          positions[drop.offset] = x;
          positions[drop.offset + 1] = y;
          positions[drop.offset + 2] = z;
          positions[drop.offset + 3] = x + 0.06;
          positions[drop.offset + 4] = y - 0.7;
          positions[drop.offset + 5] = z + 0.04;
        }
      });
      weatherVisuals.rain.geometry.attributes.position.needsUpdate = true;
    }

    if (rainy && stormActive) {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        weatherVisuals.lightning.position.set((Math.random() - 0.5) * 35, 22, (Math.random() - 0.5) * 30);
        weatherVisuals.lightning.intensity = 5.5 + Math.random() * 5;
        lightningTimer = 4 + Math.random() * 9;
      }
      weatherVisuals.lightning.intensity *= Math.pow(0.03, dt);
    } else {
      weatherVisuals.lightning.intensity = 0;
    }
  }

  function updateClouds(dt) {
    clouds.forEach(cloud => {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 42) cloud.position.x = -42;
    });
  }

  function installWorkstationProps() {
    makeTrough(7.9, 3.2, false);
    makeTrough(8.4, 4.25, true);
    makeTrough(0, 13.9, true);
    makeTrough(-11.5, 13.2, false);
    makeTrough(-10.6, 14.1, true);
    makeTrough(3, -9.3, false);
    makeTrough(4.1, -9.3, true);

    const loadingPlatform = mesh(new THREE.BoxGeometry(5.4, 0.45, 2.4), mat(0x73513a, 0.95), 13.2, 0.25, -12.8);
    expansionRoot.add(loadingPlatform);
    makeSign('EXPÉDITIONS', 13.2, 1.7, -11.45, 0.65);
  }

  function hideLegacyFarmers() {
    if (typeof farmers === 'undefined' || !Array.isArray(farmers)) return;
    farmers.forEach(farmer => {
      if (farmer && farmer.group) farmer.group.visible = false;
    });
  }

  if (typeof updateFarmer === 'function') {
    updateFarmer = function hideOldFarmer(farmer) {
      if (farmer && farmer.group) farmer.group.visible = false;
    };
  }

  buildRoadNetwork();
  const house = buildFarmersHouse();
  buildClouds();
  const weatherVisuals = buildRain();
  installWorkstationProps();
  const tasks = buildFarmWorkstations();
  workers.push(makeWorker(0, house.door), makeWorker(1, house.door.clone().add(new THREE.Vector3(0.65, 0, 0))));
  window.farmWorkerState = workers;
  const truck = makeTruck();
  window.farmTruckState = truck;
  refreshCrates();
  applyRenderingUpgrade();
  window.setInterval(applyRenderingUpgrade, 5000);

  function animateFarmExpansion(now) {
    requestAnimationFrame(animateFarmExpansion);
    const dt = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;
    const time = now / 1000;

    hideLegacyFarmers();
    updateClouds(dt);
    updateWeatherVisuals(dt, weatherVisuals);
    workers.forEach(worker => updateWorker(worker, tasks, dt, time));
    updateActionParticles(dt);
    updateTruck(truck, dt);

    productionTimer -= dt;
    if (productionTimer <= 0) {
      productionTimer = 28;
      accumulateProducts();
    }

    logistics.nextTruck = Math.max(0, truckCountdown);
  }

  requestAnimationFrame(animateFarmExpansion);
})();
