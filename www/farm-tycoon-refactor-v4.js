'use strict';
(() => {
  if (
    typeof THREE === 'undefined' ||
    typeof scene === 'undefined' ||
    typeof camera === 'undefined' ||
    typeof renderer === 'undefined'
  ) return;

  window.FARM_TYCOON_REFACTOR_V4_ACTIVE = true;

  const ROOT_NAME = 'farm-tycoon-refactor-v4';
  const previousRoot = scene.getObjectByName(ROOT_NAME);
  if (previousRoot && previousRoot.parent) previousRoot.parent.remove(previousRoot);

  const root = new THREE.Group();
  root.name = ROOT_NAME;
  scene.add(root);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const V = (x, z, y = 0) => new THREE.Vector3(x, y, z);
  const clamp = THREE.MathUtils.clamp;
  const animals = new Map();
  const shelter = new Map();
  const workerControllers = new Map();
  const proxies = [];
  const interiorClones = [];
  const lamps = [];
  const puddleSplashes = [];
  const bees = [];
  const tmp = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const TYPES = ['hen', 'rooster', 'cow', 'sheep', 'duck', 'pig'];
  const BIRDS = new Set(['hen', 'rooster']);
  const LARGE_ANIMALS = new Set(['cow', 'sheep', 'duck', 'pig']);
  const DANGEROUS_WEATHER = new Set(['rain', 'snow', 'heat']);

  const PENS = {
    hen: { minX: -15.2, maxX: 5.2, minZ: -7.2, maxZ: 12.2, portal: 'yardEast' },
    rooster: { minX: -15.2, maxX: 5.2, minZ: -7.2, maxZ: 12.2, portal: 'yardEast' },
    cow: { minX: 5.45, maxX: 14.55, minZ: 0.75, maxZ: 8.25, portal: 'cow' },
    sheep: { minX: -4.75, maxX: 4.75, minZ: 13.35, maxZ: 20.65, portal: 'sheep' },
    duck: { minX: -15.45, maxX: -7.55, minZ: 13.35, maxZ: 19.65, portal: 'duck' },
    pig: { minX: -1.0, maxX: 7.0, minZ: -15.05, maxZ: -8.95, portal: 'pig' }
  };

  const PORTALS = {
    yardEast: {
      inside: V(4.7, -5.9), gate: V(5.45, -5.9), outside: V(6.4, -5.9), axis: 'x', half: 1.25
    },
    cow: {
      inside: V(14.05, 4.5), gate: V(14.75, 4.5), outside: V(15.7, 4.5), axis: 'x', half: 1.15
    },
    sheep: {
      inside: V(4.25, 17.0), gate: V(5.0, 17.0), outside: V(5.9, 17.0), axis: 'x', half: 1.0
    },
    duck: {
      inside: V(-7.95, 16.5), gate: V(-7.2, 16.5), outside: V(-6.2, 16.5), axis: 'x', half: 0.95
    },
    pig: {
      inside: V(6.55, -11.9), gate: V(7.3, -11.9), outside: V(8.25, -11.9), axis: 'x', half: 0.95
    },
    coop: {
      outside: V(-10.7, -5.55), gate: V(-11.45, -5.55), inside: V(-12.35, -5.55), axis: 'x', half: 1.6
    },
    barn: {
      outside: V(13.0, 8.15), gate: V(13.0, 9.0), inside: V(13.0, 10.15), axis: 'z', half: 1.35
    },
    house: {
      outside: V(-10.5, -14.75), gate: V(-10.5, -15.45), inside: V(-10.5, -16.2), axis: 'z', half: 0.75
    }
  };

  const BUILDINGS = {
    coop: { x: -13.25, z: -5.55, width: 5.7, depth: 5.0, height: 3.8, portal: PORTALS.coop },
    barn: { x: 13.0, z: 13.5, width: 7.2, depth: 9.0, height: 5.4, portal: PORTALS.barn },
    house: { x: -10.5, z: -18.1, width: 7.4, depth: 5.5, height: 4.2, portal: PORTALS.house },
    warehouse: { x: 13.6, z: -15.6, width: 8.5, depth: 6.4, height: 4.8, portal: null }
  };

  const INTERIOR_CENTER = {
    coop: new THREE.Vector3(-15, 60, 120),
    barn: new THREE.Vector3(15, 60, 120)
  };

  const state = {
    interior: null,
    scanTimer: 0,
    lastTime: performance.now(),
    lastTruckState: '',
    audioUnlocked: false,
    thunderTimer: 10 + Math.random() * 12,
    lightning: 0,
    splashTimer: 0,
    leaves: null,
    flowers: null,
    snowLayer: null,
    truckCurve: null,
    pointerDown: null
  };

  function mat(color, roughness = 0.9, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: false });
  }

  function mesh(geometry, material, x, y, z, scale = null, rotation = null) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    if (scale) object.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
    object.castShadow = true;
    object.receiveShadow = true;
    return object;
  }

  function notify(message) {
    if (typeof setFarmStatus === 'function') setFarmStatus(message);
  }

  function currentHour() {
    const element = document.getElementById('tm');
    const match = element && String(element.textContent || '').match(/(\d{1,2}):/);
    return match ? Number(match[1]) : 12;
  }

  function isNight() {
    const hour = currentHour();
    return hour >= 20 || hour < 6;
  }

  function weather() {
    return window.farmClimateState && window.farmClimateState.weather || 'sun';
  }

  function season() {
    return window.farmClimateState && window.farmClimateState.season || 'spring';
  }

  function shelterRequired() {
    return isNight() || DANGEROUS_WEATHER.has(weather());
  }

  function radiusFor(type) {
    if (type === 'cow') return 0.58;
    if (type === 'sheep') return 0.46;
    if (type === 'pig') return 0.42;
    if (type === 'duck') return 0.3;
    return 0.27;
  }

  function speedFor(type) {
    if (type === 'cow') return 1.02;
    if (type === 'sheep') return 1.2;
    if (type === 'pig') return 1.15;
    if (type === 'duck') return 1.32;
    return 1.48;
  }

  function insideRect(point, building, margin = 0) {
    return point.x > building.x - building.width / 2 - margin &&
      point.x < building.x + building.width / 2 + margin &&
      point.z > building.z - building.depth / 2 - margin &&
      point.z < building.z + building.depth / 2 + margin;
  }

  function inDoorCorridor(point, portal, radius = 0) {
    if (!portal) return false;
    if (portal.axis === 'x') {
      const minX = Math.min(portal.inside.x, portal.outside.x) - radius;
      const maxX = Math.max(portal.inside.x, portal.outside.x) + radius;
      return point.x >= minX && point.x <= maxX && Math.abs(point.z - portal.gate.z) <= portal.half + radius;
    }
    const minZ = Math.min(portal.inside.z, portal.outside.z) - radius;
    const maxZ = Math.max(portal.inside.z, portal.outside.z) + radius;
    return point.z >= minZ && point.z <= maxZ && Math.abs(point.x - portal.gate.x) <= portal.half + radius;
  }

  function collidesWithBuilding(point, radius, allowedPortal = null, ignoredBuilding = null) {
    return Object.entries(BUILDINGS).some(([name, building]) => {
      if (name === ignoredBuilding || !insideRect(point, building, radius)) return false;
      return !(building.portal && building.portal === allowedPortal && inDoorCorridor(point, allowedPortal, radius));
    });
  }

  function clampToPen(record) {
    const pen = PENS[record.type];
    if (!pen || shelter.has(record.group) || !record.group.visible) return;

    const radius = radiusFor(record.type);
    const position = record.group.position;
    position.x = clamp(position.x, pen.minX + radius, pen.maxX - radius);
    position.z = clamp(position.z, pen.minZ + radius, pen.maxZ - radius);

    const bird = BIRDS.has(record.type);
    const insideCoopNow = bird && insideRect(position, BUILDINGS.coop, -radius * 0.15);
    const insideCoopBefore = bird && insideRect(record.safe, BUILDINGS.coop, -radius * 0.15);
    const crossedCoopWall = bird && insideCoopNow !== insideCoopBefore;
    const crossedThroughDoor = inDoorCorridor(position, PORTALS.coop, radius) || inDoorCorridor(record.safe, PORTALS.coop, radius);
    const forbiddenCoop = LARGE_ANIMALS.has(record.type) && insideRect(position, BUILDINGS.coop, radius);
    const forbiddenBarn = bird && insideRect(position, BUILDINGS.barn, radius);
    const wallCollision = collidesWithBuilding(position, radius, bird ? PORTALS.coop : null, bird ? 'coop' : null);

    if (forbiddenCoop || forbiddenBarn || wallCollision || (crossedCoopWall && !crossedThroughDoor)) {
      position.copy(record.safe);
      if (record.data && record.data.target && record.data.target.copy) record.data.target.copy(record.safe);
    } else {
      record.safe.copy(position);
    }
  }

  function realisticBird(group, type, data) {
    if (!BIRDS.has(type) || group.userData.realisticBirdV4) return;
    group.userData.realisticBirdV4 = true;

    ['visual-bird-details', 'chicken-refined-details-v2', 'realistic-chicken-details', 'realistic-bird-v3', 'realistic-bird-v4'].forEach(name => {
      const old = group.getObjectByName(name);
      if (old && old.parent) old.parent.remove(old);
    });

    const rooster = type === 'rooster';
    const feather = mat(rooster ? 0x8a482e : 0xb6804b, 0.93);
    const cream = mat(rooster ? 0xd4a263 : 0xe2bf87, 0.94);
    const dark = mat(0x30201c, 0.9);
    const copper = mat(0x8f3e29, 0.88);
    const burgundy = mat(0x5c2424, 0.9);
    const red = mat(rooster ? 0xd52f2f : 0xc7463c, 0.65);
    const beak = mat(0xdf9e38, 0.62);
    const leg = mat(0xd18b2f, 0.74);

    group.traverse(object => {
      if (!object.isMesh || !object.material) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      if (material && material.color && material.color.g > material.color.r * 1.1 && material.color.g > material.color.b * 1.08) object.material = dark;
      if (object.geometry && object.geometry.type === 'ConeGeometry' && object.position.z < -0.25) object.visible = false;
    });

    const details = new THREE.Group();
    details.name = 'realistic-bird-v4';

    for (let row = 0; row < 3; row += 1) {
      const count = 3 + row;
      for (let index = 0; index < count; index += 1) {
        const centered = index - (count - 1) / 2;
        details.add(mesh(new THREE.SphereGeometry(1, 11, 8), row === 2 ? feather : cream,
          centered * 0.11, 0.72 - row * 0.11, 0.32 + row * 0.03,
          [0.095, 0.032, 0.15], [-0.2, 0, centered * 0.05]));
      }
    }

    [-1, 1].forEach(side => {
      for (let row = 0; row < 3; row += 1) {
        for (let index = 0; index < 5; index += 1) {
          details.add(mesh(new THREE.SphereGeometry(1, 11, 7), row === 0 ? feather : dark,
            side * (0.35 + row * 0.017), 0.64 - row * 0.085, 0.2 - index * 0.145,
            [0.066, 0.028, 0.19 - row * 0.015],
            [0.14 + index * 0.025, side * 0.26, side * (0.09 + row * 0.035)]));
        }
      }
    });

    const tailMaterials = rooster
      ? [dark, burgundy, copper, dark, cream, copper, burgundy, dark]
      : [dark, feather, cream, feather, dark, cream];

    tailMaterials.forEach((tailMaterial, index) => {
      const centered = index - (tailMaterials.length - 1) / 2;
      details.add(mesh(new THREE.ConeGeometry(rooster ? 0.052 : 0.047,
        (rooster ? 0.72 : 0.43) - Math.abs(centered) * 0.04, 9),
        tailMaterial, centered * 0.055, 0.75 + Math.abs(centered) * 0.024, -0.52,
        null, [-1.18 - Math.abs(centered) * 0.045, 0, centered * 0.12]));
    });

    [-1, 1].forEach(side => {
      [-0.05, 0, 0.05].forEach((spread, index) => {
        details.add(mesh(new THREE.CylinderGeometry(0.011, 0.016, 0.17, 7), leg,
          side * 0.13 + spread, 0.02, 0.055 + index * 0.02,
          null, [Math.PI / 2.22, 0, spread * 5.2]));
      });
    });
    group.add(details);

    if (!data || !data.head) return;
    const headDetails = new THREE.Group();
    headDetails.name = 'realistic-bird-head-v4';
    const lobes = rooster ? 6 : 4;
    for (let index = 0; index < lobes; index += 1) {
      const ratio = index / Math.max(1, lobes - 1);
      const height = (rooster ? 0.13 : 0.082) * (0.82 + Math.sin(ratio * Math.PI) * 0.22);
      headDetails.add(mesh(new THREE.SphereGeometry(1, 10, 8), red,
        0, 0.19 + height * 0.34, -0.1 + ratio * 0.2, [0.052, height, 0.052]));
    }
    headDetails.add(
      mesh(new THREE.ConeGeometry(0.057, 0.155, 9), beak, 0, 0.004, 0.225, null, [Math.PI / 2, 0, 0]),
      mesh(new THREE.ConeGeometry(0.043, 0.115, 9), beak, 0, -0.036, 0.207, null, [Math.PI / 2 + 0.16, 0, 0])
    );
    data.head.add(headDetails);
  }

  function scanAnimals() {
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
      if (!group || seen.has(group.uuid) || !TYPES.includes(type)) return;
      seen.add(group.uuid);
      if (!animals.has(group)) animals.set(group, { group, data, type, safe: group.position.clone() });
      else Object.assign(animals.get(group), { data, type });
      realisticBird(group, type, data);
    });
    animals.forEach((record, group) => {
      if (!seen.has(group.uuid) || !group.parent) {
        animals.delete(group);
        shelter.delete(group);
      }
    });
  }

  function penExitPath(type) {
    const pen = PENS[type];
    const portal = pen && PORTALS[pen.portal];
    return portal ? [portal.inside.clone(), portal.gate.clone(), portal.outside.clone()] : [];
  }

  function routeToShelter(record, index) {
    const path = [];
    if (BIRDS.has(record.type) && insideRect(record.group.position, BUILDINGS.coop, -0.08)) {
      path.push(PORTALS.coop.inside.clone(), V(-13 + (index % 5 - 2) * 0.33, -5.55 + Math.floor(index / 5) * 0.4));
      return path;
    }
    path.push(...penExitPath(record.type));
    if (BIRDS.has(record.type)) {
      path.push(V(3.8, -5.9), V(-7.8, -5.9), PORTALS.coop.outside.clone(), PORTALS.coop.gate.clone(), PORTALS.coop.inside.clone(),
        V(-13 + (index % 5 - 2) * 0.33, -5.55 + Math.floor(index / 5) * 0.4));
      return path;
    }
    if (record.type === 'cow') path.push(V(16.5, 4.5), V(18, 7.7));
    else if (record.type === 'sheep') path.push(V(6.2, 17), V(8, 11.8));
    else if (record.type === 'duck') path.push(V(-5.6, 16.5), V(4.8, 12), V(8, 9.5));
    else if (record.type === 'pig') path.push(V(8.8, -11.9), V(18, -5.2), V(18, 7.7));
    const offset = (index % 5 - 2) * 0.26;
    path.push(PORTALS.barn.outside.clone().add(V(offset, 0)), PORTALS.barn.gate.clone().add(V(offset, 0)),
      PORTALS.barn.inside.clone().add(V(offset, 0)), V(13 + offset, 11.2 + Math.floor(index / 5) * 0.3));
    return path;
  }

  function beginShelter(record, index) {
    if (shelter.has(record.group)) return;
    const path = routeToShelter(record, index);
    shelter.set(record.group, {
      record, path, reversePath: [], waypoint: 0, phase: 'entering',
      position: record.group.position.clone(), originalPosition: record.group.position.clone(),
      originalRotation: record.group.rotation.y, originalVisible: record.group.visible,
      originalState: record.data && record.data.state,
      originalTimer: record.data && record.data.stateTimer,
      originalTarget: record.data && record.data.target && record.data.target.clone ? record.data.target.clone() : null,
      index
    });
  }

  function moveAlong(controller, target, delta) {
    const dx = target.x - controller.position.x;
    const dz = target.z - controller.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.16) {
      controller.position.copy(target);
      return true;
    }
    const step = Math.min(distance, speedFor(controller.record.type) * delta);
    controller.position.x += dx / distance * step;
    controller.position.z += dz / distance * step;
    controller.record.group.rotation.y = Math.atan2(dx, dz);
    return false;
  }

  function enforceShelter(delta) {
    if (shelterRequired()) {
      let index = 0;
      animals.forEach(record => beginShelter(record, index++));
      shelter.forEach(controller => {
        const animal = controller.record;
        if (!animal.group.parent || controller.phase === 'sheltered') return;
        animal.group.visible = true;
        if (animal.data) {
          animal.data.state = 'v4ShelterControlled';
          animal.data.stateTimer = 999999;
        }
        const target = controller.path[controller.waypoint];
        if (!target) {
          controller.phase = 'sheltered';
          animal.group.visible = false;
          controller.reversePath = controller.path.slice(0, -1).reverse().map(point => point.clone());
          controller.reversePath.push(controller.originalPosition.clone());
          controller.waypoint = 0;
          return;
        }
        if (moveAlong(controller, target, delta)) controller.waypoint += 1;
        animal.group.position.copy(controller.position);
        animal.group.position.y = Math.abs(Math.sin(performance.now() * 0.007 + controller.index)) * 0.025;
      });
      return;
    }

    shelter.forEach(controller => {
      const animal = controller.record;
      if (controller.phase === 'sheltered') {
        controller.phase = 'exiting';
        controller.position.copy(controller.path[controller.path.length - 1]);
        animal.group.visible = true;
        controller.waypoint = 0;
      }
      if (controller.phase !== 'exiting') return;
      if (animal.data) {
        animal.data.state = 'v4ShelterControlled';
        animal.data.stateTimer = 999999;
      }
      const target = controller.reversePath[controller.waypoint];
      if (!target) {
        animal.group.visible = controller.originalVisible;
        animal.group.position.copy(controller.originalPosition);
        animal.group.rotation.y = controller.originalRotation;
        if (animal.data) {
          animal.data._in = false;
          animal.data._ws = null;
          animal.data.state = ['weatherShelter', 'climateShelter', 'structureShelter', 'livingWorldShelter', 'v4ShelterControlled'].includes(controller.originalState)
            ? 'wander' : controller.originalState || 'wander';
          animal.data.stateTimer = Math.max(3, Number(controller.originalTimer) || 4 + Math.random() * 5);
          if (controller.originalTarget && animal.data.target && animal.data.target.copy) animal.data.target.copy(controller.originalTarget);
        }
        animal.safe.copy(animal.group.position);
        shelter.delete(animal.group);
        return;
      }
      if (moveAlong(controller, target, delta)) controller.waypoint += 1;
      animal.group.visible = true;
      animal.group.position.copy(controller.position);
      animal.group.position.y = Math.abs(Math.sin(performance.now() * 0.007 + controller.index)) * 0.025;
    });
    animals.forEach(clampToPen);
  }

  function brickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = '#d6c6b1';
    context.fillRect(0, 0, 256, 128);
    for (let row = 0; row < 6; row += 1) {
      for (let column = -1; column < 7; column += 1) {
        const offset = row % 2 ? -24 : 0;
        const random = Math.random();
        context.fillStyle = random < 0.24 ? '#b45b46' : random > 0.82 ? '#743127' : '#984534';
        context.fillRect(column * 48 + offset + 2, row * 22 + 2, 44, 18);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    return texture;
  }

  function hideLegacyBuilding(centerX, centerZ, widthHint, depthHint) {
    const candidates = [];
    scene.traverse(object => {
      if (!object.isGroup || object === root) return;
      object.getWorldPosition(tmp);
      if (Math.abs(tmp.x - centerX) > 0.7 || Math.abs(tmp.z - centerZ) > 0.7) return;
      const match = object.children.some(child => {
        if (!child.isMesh || !child.geometry || child.geometry.type !== 'BoxGeometry') return false;
        const p = child.geometry.parameters || {};
        return Math.abs(Number(p.width || 0) - widthHint) < 1.2 && Math.abs(Number(p.depth || 0) - depthHint) < 1.2;
      });
      if (match) candidates.push(object);
    });
    candidates.forEach(object => { object.visible = false; });
  }

  function buildCoop() {
    hideLegacyBuilding(-15, -6, 8, 6);
    const building = BUILDINGS.coop;
    const group = new THREE.Group();
    group.name = 'exclusive-realistic-coop-v4';
    group.userData.farmInteriorType = 'coop';
    const brick = new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.96 });
    const stone = mat(0x696159, 0.98);
    const wood = mat(0x63432f, 0.96);
    const roof = mat(0x814033, 0.92);
    const straw = mat(0xd2ad58, 0.98);
    const dark = mat(0x211a17, 1);
    const frontX = building.x + building.width / 2;
    const doorWidth = 3.1;
    const sideDepth = (building.depth - doorWidth) / 2;
    group.add(mesh(new THREE.BoxGeometry(building.width + 0.35, 0.45, building.depth + 0.35), stone, building.x, 0.23, building.z));
    group.add(
      mesh(new THREE.BoxGeometry(building.width, building.height, 0.2), brick, building.x, building.height / 2, building.z - building.depth / 2),
      mesh(new THREE.BoxGeometry(building.width, building.height, 0.2), brick, building.x, building.height / 2, building.z + building.depth / 2),
      mesh(new THREE.BoxGeometry(0.2, building.height, building.depth), brick, building.x - building.width / 2, building.height / 2, building.z),
      mesh(new THREE.BoxGeometry(0.2, building.height, sideDepth), brick, frontX, building.height / 2, building.z - doorWidth / 2 - sideDepth / 2),
      mesh(new THREE.BoxGeometry(0.2, building.height, sideDepth), brick, frontX, building.height / 2, building.z + doorWidth / 2 + sideDepth / 2),
      mesh(new THREE.BoxGeometry(0.2, 1.1, doorWidth), brick, frontX, building.height - 0.55, building.z)
    );
    group.add(
      mesh(new THREE.BoxGeometry(0.08, 2.35, 2.9), dark, frontX + 0.12, 1.18, building.z),
      mesh(new THREE.BoxGeometry(0.1, 2.2, 1.1), wood, frontX + 0.28, 1.1, building.z - 1.05, null, [0, -0.8, 0]),
      mesh(new THREE.BoxGeometry(0.1, 2.2, 1.1), wood, frontX + 0.28, 1.1, building.z + 1.05, null, [0, 0.8, 0])
    );
    group.add(
      mesh(new THREE.BoxGeometry(3.45, 0.28, 5.6), roof, building.x - 1.38, 4.35, building.z, null, [0, 0, -0.64]),
      mesh(new THREE.BoxGeometry(3.45, 0.28, 5.6), roof, building.x + 1.38, 4.35, building.z, null, [0, 0, 0.64])
    );
    for (let index = 0; index < 6; index += 1) {
      const x = building.x - 1.6 + index % 3 * 1.6;
      const z = building.z - 1.25 + Math.floor(index / 3) * 2.5;
      group.add(
        mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.22, 14), wood, x, 0.34, z),
        mesh(new THREE.TorusGeometry(0.36, 0.1, 8, 22), straw, x, 0.5, z, [1, 0.58, 1], [Math.PI / 2, 0, 0])
      );
    }
    root.add(group);
  }

  function buildBarn() {
    hideLegacyBuilding(13, 14, 9, 7);
    const building = BUILDINGS.barn;
    const group = new THREE.Group();
    group.name = 'exclusive-vertical-barn-v4';
    group.userData.farmInteriorType = 'barn';
    const brick = new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.96 });
    const stone = mat(0x696159, 0.98);
    const wood = mat(0x5d3e2b, 0.96);
    const roof = mat(0x78372c, 0.92);
    const dark = mat(0x201916, 1);
    const cream = mat(0xe9dcc8, 0.92);
    const straw = mat(0xcda64f, 0.98);
    const frontZ = building.z - building.depth / 2;
    const backZ = building.z + building.depth / 2;
    const doorWidth = 2.9;
    const sideWidth = (building.width - doorWidth) / 2;
    group.add(mesh(new THREE.BoxGeometry(building.width + 0.4, 0.5, building.depth + 0.4), stone, building.x, 0.25, building.z));
    group.add(
      mesh(new THREE.BoxGeometry(sideWidth, building.height, 0.22), brick, building.x - doorWidth / 2 - sideWidth / 2, building.height / 2, frontZ),
      mesh(new THREE.BoxGeometry(sideWidth, building.height, 0.22), brick, building.x + doorWidth / 2 + sideWidth / 2, building.height / 2, frontZ),
      mesh(new THREE.BoxGeometry(doorWidth, 1.9, 0.22), brick, building.x, 4.45, frontZ),
      mesh(new THREE.BoxGeometry(building.width, building.height, 0.22), brick, building.x, building.height / 2, backZ),
      mesh(new THREE.BoxGeometry(0.22, building.height, building.depth), brick, building.x - building.width / 2, building.height / 2, building.z),
      mesh(new THREE.BoxGeometry(0.22, building.height, building.depth), brick, building.x + building.width / 2, building.height / 2, building.z)
    );
    group.add(
      mesh(new THREE.BoxGeometry(doorWidth - 0.12, 3.35, 0.08), dark, building.x, 1.68, frontZ - 0.13),
      mesh(new THREE.BoxGeometry(1.32, 3.2, 0.15), wood, building.x - 1.08, 1.6, frontZ - 0.3, null, [0, -0.9, 0]),
      mesh(new THREE.BoxGeometry(1.32, 3.2, 0.15), wood, building.x + 1.08, 1.6, frontZ - 0.3, null, [0, 0.9, 0]),
      mesh(new THREE.BoxGeometry(doorWidth + 0.4, 0.18, 0.22), cream, building.x, 3.42, frontZ - 0.16)
    );
    group.add(
      mesh(new THREE.BoxGeometry(7.7, 0.35, 5.3), roof, building.x, 6.35, building.z - 2.25, null, [0.68, 0, 0]),
      mesh(new THREE.BoxGeometry(7.7, 0.35, 5.3), roof, building.x, 6.35, building.z + 2.25, null, [-0.68, 0, 0])
    );
    for (let index = 0; index < 4; index += 1) {
      group.add(mesh(new THREE.BoxGeometry(2.6, 0.14, 1.55), straw,
        building.x + (index % 2 ? 1.8 : -1.8), 0.32, building.z + (index < 2 ? 1.6 : -1.6)));
    }
    root.add(group);
  }

  function buildInterior(type) {
    const center = INTERIOR_CENTER[type];
    const group = new THREE.Group();
    group.name = `${type}-interior-v4`;
    group.visible = false;
    const floor = mat(type === 'coop' ? 0xa78655 : 0x705943, 1);
    const wall = mat(type === 'coop' ? 0xa84c3b : 0x8e4434, 0.97);
    const wood = mat(0x5a3d2b, 0.98);
    const straw = mat(0xcda64f, 0.99);
    const width = type === 'coop' ? 11 : 14;
    const depth = type === 'coop' ? 8 : 10;
    const height = type === 'coop' ? 4.5 : 5.2;
    group.add(
      mesh(new THREE.BoxGeometry(width, 0.38, depth), floor, center.x, center.y, center.z),
      mesh(new THREE.BoxGeometry(width, height, 0.32), wall, center.x, center.y + height / 2, center.z + depth / 2),
      mesh(new THREE.BoxGeometry(0.32, height, depth), wall, center.x - width / 2, center.y + height / 2, center.z),
      mesh(new THREE.BoxGeometry(0.32, height, depth), wall, center.x + width / 2, center.y + height / 2, center.z)
    );
    if (type === 'coop') {
      for (let index = 0; index < 8; index += 1) {
        const x = center.x - 3.6 + index % 4 * 2.4;
        const z = center.z + 2.55 - Math.floor(index / 4) * 2.05;
        group.add(
          mesh(new THREE.CylinderGeometry(0.5, 0.58, 0.22, 14), wood, x, center.y + 0.28, z),
          mesh(new THREE.TorusGeometry(0.4, 0.11, 8, 24), straw, x, center.y + 0.45, z, [1, 0.58, 1], [Math.PI / 2, 0, 0])
        );
      }
    } else {
      for (let index = 0; index < 6; index += 1) {
        const side = index < 3 ? -1 : 1;
        const row = index % 3;
        const x = center.x + side * 4.4;
        const z = center.z + 2.7 - row * 2.7;
        group.add(
          mesh(new THREE.BoxGeometry(3.7, 0.16, 2.15), straw, x, center.y + 0.16, z),
          mesh(new THREE.BoxGeometry(0.15, 1.35, 2.4), wood, center.x + side * 2.55, center.y + 0.7, z)
        );
      }
    }
    const light = new THREE.PointLight(0xffc26c, 1.1, 22);
    light.position.set(center.x, center.y + 3.4, center.z);
    group.add(light);
    root.add(group);
    return group;
  }

  const interiors = { coop: null, barn: null };

  function clearInteriorClones() {
    interiorClones.forEach(clone => clone.parent && clone.parent.remove(clone));
    interiorClones.length = 0;
  }

  function populateInterior(type) {
    clearInteriorClones();
    const parent = interiors[type];
    const center = INTERIOR_CENTER[type];
    const list = [...animals.values()].filter(animal => type === 'coop' ? BIRDS.has(animal.type) : LARGE_ANIMALS.has(animal.type));
    list.forEach((animal, index) => {
      const clone = animal.group.clone(true);
      clone.traverse(child => { child.userData = {}; });
      clone.visible = true;
      if (type === 'coop') {
        clone.position.set(center.x - 3.6 + index % 4 * 2.4, center.y + 0.5,
          center.z + 2.55 - Math.floor(index / 4) * 2.05);
        clone.rotation.y = Math.PI;
        clone.scale.multiply(new THREE.Vector3(1, 0.63, 1.04));
      } else {
        const side = index % 2 ? 1 : -1;
        const row = Math.floor(index / 2) % 3;
        clone.position.set(center.x + side * 4.35, center.y + 0.42, center.z + 2.7 - row * 2.7);
        clone.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        clone.rotation.z = side * 0.05;
        clone.scale.multiply(new THREE.Vector3(1.05, 0.68, 1.08));
      }
      parent.add(clone);
      interiorClones.push(clone);
    });
  }

  function addProxy(type, building) {
    const object = mesh(new THREE.BoxGeometry(building.width + 0.4, building.height + 0.6, building.depth + 0.4),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      building.x, building.height / 2, building.z);
    object.userData.farmInteriorType = type;
    object.castShadow = false;
    object.receiveShadow = false;
    root.add(object);
    proxies.push(object);
  }

  const exitButton = document.createElement('button');
  exitButton.type = 'button';
  exitButton.textContent = '← Retour à la ferme';
  exitButton.style.cssText = 'position:fixed;left:50%;bottom:calc(78px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:240;display:none;border:0;border-radius:14px;padding:11px 16px;background:#fff8e9;color:#4a3728;box-shadow:0 8px 25px #23191247;font:700 13px Inter,sans-serif;pointer-events:auto';
  document.body.appendChild(exitButton);
  ['pointerdown', 'pointerup', 'click'].forEach(type => exitButton.addEventListener(type, event => event.stopPropagation()));

  function enterInterior(type) {
    if (!interiors[type]) return;
    state.interior = type;
    interiors.coop.visible = type === 'coop';
    interiors.barn.visible = type === 'barn';
    populateInterior(type);
    exitButton.style.display = 'block';
    const hud = document.getElementById('tycoonHud');
    if (hud) hud.style.opacity = '0.2';
    notify(type === 'coop'
      ? 'Intérieur du poulailler : seules les poules et le coq reposent dans les nids.'
      : 'Intérieur de la grange : les grands animaux sont allongés au chaud.');
  }

  function leaveInterior() {
    state.interior = null;
    interiors.coop.visible = false;
    interiors.barn.visible = false;
    clearInteriorClones();
    exitButton.style.display = 'none';
    const hud = document.getElementById('tycoonHud');
    if (hud) hud.style.opacity = '';
  }
  exitButton.addEventListener('click', leaveInterior);

  function hitProxy(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(proxies, false)[0];
    return hit && hit.object.userData.farmInteriorType || null;
  }

  function installInteriorInput() {
    renderer.domElement.addEventListener('pointerdown', event => {
      state.audioUnlocked = true;
      state.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
    }, { passive: true });
    window.addEventListener('pointerup', event => {
      if (!state.pointerDown || state.interior) {
        state.pointerDown = null;
        return;
      }
      const start = state.pointerDown;
      state.pointerDown = null;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8 || performance.now() - start.time > 800) return;
      const type = hitProxy(event.clientX, event.clientY);
      if (!type) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      enterInterior(type);
    }, true);
  }

  function roadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#936d49';
    context.fillRect(0, 0, 128, 256);
    for (let index = 0; index < 1200; index += 1) {
      const value = 65 + Math.floor(Math.random() * 95);
      context.fillStyle = `rgba(${value + 58},${value + 32},${value + 10},${0.07 + Math.random() * 0.2})`;
      context.fillRect(Math.random() * 128, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    context.strokeStyle = 'rgba(67,42,26,.34)';
    context.lineWidth = 3;
    [38, 90].forEach(x => {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, 256);
      context.stroke();
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 22);
    return texture;
  }

  function buildBridgeAndTunnel() {
    const group = new THREE.Group();
    group.name = 'mountain-bridge-tunnel-v4';
    const wood = mat(0x684830, 0.97);
    const metal = mat(0x696f72, 0.56, 0.32);
    const rock = mat(0x62615c, 1);
    const grass = mat(0x486b3d, 1);
    const dark = new THREE.MeshBasicMaterial({ color: 0x090b0d, side: THREE.DoubleSide });
    for (let index = 0; index < 20; index += 1) {
      const ratio = 0.035 + index * 0.0065;
      const point = state.truckCurve.getPointAt(ratio);
      const tangent = state.truckCurve.getTangentAt(ratio).normalize();
      const rotationY = Math.atan2(tangent.x, tangent.z);
      group.add(mesh(new THREE.BoxGeometry(4.7, 0.24, 0.55), wood, point.x, point.y + 0.12, point.z, null, [0, rotationY, 0]));
      if (index % 2) continue;
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      [-1, 1].forEach(direction => {
        const rail = point.clone().addScaledVector(normal, direction * 2.15);
        group.add(
          mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.25, 7), wood, rail.x, 0.65, rail.z),
          mesh(new THREE.BoxGeometry(0.08, 0.08, 1.25), metal, rail.x, 1.08, rail.z, null, [0, rotationY, 0])
        );
      });
    }
    const entrance = state.truckCurve.getPointAt(0);
    const tangent = state.truckCurve.getTangentAt(0).normalize();
    const tunnel = new THREE.Group();
    tunnel.position.copy(entrance);
    tunnel.rotation.y = Math.atan2(tangent.x, tangent.z);
    tunnel.add(
      mesh(new THREE.PlaneGeometry(4.5, 3.7), dark, 0, 1.85, 0.18),
      mesh(new THREE.BoxGeometry(0.8, 3.5, 1.3), rock, -2.5, 1.75, 0),
      mesh(new THREE.BoxGeometry(0.8, 3.5, 1.3), rock, 2.5, 1.75, 0),
      mesh(new THREE.TorusGeometry(2.35, 0.5, 10, 32, Math.PI), rock, 0, 1.48, 0.05)
    );
    [[-5.5, 2.3, -2.5, 5.8, 5, 5.8], [5.5, 2.4, -2.4, 5.9, 5.2, 5.9], [0, 5, -5.5, 8.5, 7, 7.2], [-3.5, 6, -5.8, 5.2, 4.6, 5.1], [3.8, 5.8, -5.6, 5.1, 4.5, 5.2]].forEach((entry, index) => {
      tunnel.add(mesh(new THREE.DodecahedronGeometry(1, 1), index < 2 ? rock : grass,
        entry[0], entry[1], entry[2], [entry[3], entry[4], entry[5]], [index * 0.08, index * 0.18, index * 0.04]));
    });
    group.add(tunnel);
    root.add(group);
  }

  function buildRoadCurve() {
    state.truckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-52, 0.08, -31.8), new THREE.Vector3(-47, 0.08, -30.2),
      new THREE.Vector3(-42, 0.07, -27.7), new THREE.Vector3(-35, 0.055, -25.2),
      new THREE.Vector3(-27, 0.045, -23.7), new THREE.Vector3(-19, 0.045, -23.2),
      new THREE.Vector3(-11, 0.045, -23), new THREE.Vector3(-3, 0.045, -22.5),
      new THREE.Vector3(5, 0.045, -20.7), new THREE.Vector3(11, 0.045, -17.4),
      new THREE.Vector3(16.5, 0.045, -12.5), new THREE.Vector3(16.2, 0.045, -10),
      new THREE.Vector3(13.2, 0.045, -9.2)
    ], false, 'catmullrom', 0.35);
    const segments = 180;
    const width = 4.5;
    const positions = [];
    const uvs = [];
    const indices = [];
    const side = new THREE.Vector3();
    for (let index = 0; index <= segments; index += 1) {
      const ratio = index / segments;
      const point = state.truckCurve.getPointAt(ratio);
      const tangent = state.truckCurve.getTangentAt(ratio).normalize();
      side.set(-tangent.z, 0, tangent.x).normalize();
      const left = point.clone().addScaledVector(side, width / 2);
      const right = point.clone().addScaledVector(side, -width / 2);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      uvs.push(0, ratio * 22, 1, ratio * 22);
      if (index < segments) {
        const base = index * 2;
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      map: roadTexture(), roughness: 1, polygonOffset: true, polygonOffsetFactor: 5, polygonOffsetUnits: 5
    }));
    road.name = 'clean-mountain-road-v4';
    road.receiveShadow = true;
    road.castShadow = false;
    road.renderOrder = -40;
    root.add(road);
    buildBridgeAndTunnel();
  }

  function audioContext() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!window.FARM_V4_AUDIO_CONTEXT) window.FARM_V4_AUDIO_CONTEXT = new Context();
    const context = window.FARM_V4_AUDIO_CONTEXT;
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function playTruckHorn() {
    if (!state.audioUnlocked) return;
    const context = audioContext();
    if (!context) return;
    const start = context.currentTime;
    [0, 0.36].forEach(delay => {
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(0.3, start + delay + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.32);
      [182, 232].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = index ? 'square' : 'sawtooth';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(start + delay);
        oscillator.stop(start + delay + 0.34);
      });
      gain.connect(context.destination);
    });
  }

  function updateTruck() {
    const truck = window.farmTruckState;
    const logistics = window.farmLogisticsState;
    if (!truck || !truck.group || !state.truckCurve) return;
    const progress = clamp(Number(truck.progress) || 0, 0, 1);
    if (truck.state === 'arriving' || truck.state === 'leaving') {
      const point = state.truckCurve.getPointAt(progress);
      const tangent = state.truckCurve.getTangentAt(progress).normalize();
      const direction = truck.state === 'arriving' ? 1 : -1;
      truck.group.position.copy(point);
      truck.group.rotation.y = Math.atan2(direction * tangent.x, direction * tangent.z);
      truck.group.visible = progress > 0.055;
    } else if (truck.state === 'waitingPlayer' || truck.state === 'loading') {
      const point = state.truckCurve.getPointAt(1);
      const tangent = state.truckCurve.getTangentAt(1).normalize();
      truck.group.position.copy(point);
      truck.group.rotation.y = Math.atan2(tangent.x, tangent.z);
      truck.group.visible = true;
    } else if (truck.state === 'waiting') {
      truck.group.visible = false;
    }
    if (truck.state === 'waitingPlayer' && state.lastTruckState !== 'waitingPlayer') {
      playTruckHorn();
      notify('Le camion est garé derrière l’entrepôt. Touchez-le pour charger les œufs, le lait et le jambon.');
    }
    if (logistics) logistics.truckState = truck.state === 'waitingPlayer' ? 'attend le chargement manuel' : truck.status || logistics.truckState;
    state.lastTruckState = truck.state;
  }

  const WORKER_TASKS = [
    { name: 'paille l’enclos des vaches', type: 'straw', path: [PORTALS.house.outside, V(-10.5, -23), V(8, -23), V(18, -5), V(16, 4.5), PORTALS.cow.outside, PORTALS.cow.gate, PORTALS.cow.inside, V(8.4, 4.2)] },
    { name: 'nourrit les poules', type: 'feed', path: [PORTALS.house.outside, V(-10.5, -23), V(8, -23), V(8, -6), PORTALS.yardEast.outside, PORTALS.yardEast.gate, PORTALS.yardEast.inside, V(3.1, 5.5)] },
    { name: 'paille l’enclos des moutons', type: 'straw', path: [PORTALS.house.outside, V(-10.5, -23), V(8, -23), V(20, -8), V(20, 17), V(6, 17), PORTALS.sheep.outside, PORTALS.sheep.gate, PORTALS.sheep.inside, V(0, 15.1)] },
    { name: 'ramasse les œufs dans les nids', type: 'eggs', path: [PORTALS.house.outside, V(-10.5, -23), V(8, -23), V(8, -6), PORTALS.yardEast.outside, PORTALS.yardEast.gate, PORTALS.yardEast.inside, V(-7.8, -5.9), PORTALS.coop.outside, PORTALS.coop.gate, PORTALS.coop.inside, V(-13, -5.55)] },
    { name: 'nourrit les cochons', type: 'feed', path: [PORTALS.house.outside, V(-10.5, -23), V(8, -23), V(8.3, -11.9), PORTALS.pig.outside, PORTALS.pig.gate, PORTALS.pig.inside, V(3, -11.2)] }
  ];

  function collectableEggs() {
    return typeof eggs !== 'undefined' && Array.isArray(eggs)
      ? eggs.filter(egg => egg && egg.mesh && egg.mesh.visible !== false && !egg.incubating)
      : [];
  }

  function installWorkers() {
    const list = window.farmWorkerState;
    if (!Array.isArray(list)) return;
    list.forEach((worker, index) => {
      if (!worker || !worker.group || workerControllers.has(worker)) return;
      worker.state = 'v4Controlled';
      workerControllers.set(worker, {
        worker, mode: 'wait', wait: 2 + index * 4, taskIndex: index,
        task: null, path: [], waypoint: 0, action: 0, position: worker.group.position.clone()
      });
    });
  }

  function startWorkerTask(controller) {
    let task = null;
    let tries = 0;
    while (tries < WORKER_TASKS.length) {
      task = WORKER_TASKS[controller.taskIndex++ % WORKER_TASKS.length];
      tries += 1;
      if (task.type !== 'eggs' || collectableEggs().length) break;
      task = null;
    }
    if (!task) {
      controller.wait = 5;
      return;
    }
    controller.task = task;
    controller.path = task.path.map(point => point.clone());
    controller.waypoint = 0;
    controller.mode = 'walk';
    controller.worker.status = task.name;
    if (controller.worker.fork) controller.worker.fork.visible = task.type === 'straw' || task.type === 'feed';
    if (controller.worker.basket) controller.worker.basket.visible = task.type === 'eggs';
  }

  function walkWorker(controller, target, delta, time) {
    const worker = controller.worker;
    const dx = target.x - controller.position.x;
    const dz = target.z - controller.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.16) {
      controller.position.copy(target);
      return true;
    }
    const step = Math.min(distance, Math.max(1.25, Number(worker.speed) || 1.4) * delta);
    controller.position.x += dx / distance * step;
    controller.position.z += dz / distance * step;
    worker.group.position.copy(controller.position);
    worker.group.position.y = Math.abs(Math.sin(time * 7.4 + (worker.phase || 0))) * 0.025;
    worker.group.rotation.y = Math.atan2(dx, dz);
    const stride = Math.sin(time * 7.4 + (worker.phase || 0)) * 0.58;
    if (worker.leftLeg) worker.leftLeg.rotation.x = stride;
    if (worker.rightLeg) worker.rightLeg.rotation.x = -stride;
    if (worker.leftArm) worker.leftArm.rotation.x = -stride * 0.62;
    if (worker.rightArm) worker.rightArm.rotation.x = stride * 0.42;
    return false;
  }

  function collectEggsPhysically() {
    const list = collectableEggs();
    list.forEach(egg => {
      if (typeof removeEgg === 'function') removeEgg(egg);
      else if (egg.mesh && egg.mesh.parent) egg.mesh.parent.remove(egg.mesh);
    });
    if (list.length) notify(`Le fermier a ramassé ${list.length} œuf${list.length > 1 ? 's' : ''} à l’intérieur du poulailler.`);
  }

  function updateWorker(controller, delta, time) {
    const worker = controller.worker;
    worker.state = 'v4Controlled';
    worker.group.visible = true;
    if (controller.mode === 'wait') {
      controller.wait -= delta;
      if (controller.wait <= 0) startWorkerTask(controller);
      return;
    }
    if (controller.mode === 'walk' || controller.mode === 'return') {
      const target = controller.path[controller.waypoint];
      if (!target) {
        if (controller.mode === 'walk') {
          controller.mode = 'act';
          controller.action = controller.task.type === 'eggs' ? 3.2 : 3.8;
        } else {
          controller.mode = 'wait';
          controller.wait = 8 + Math.random() * 10;
          controller.task = null;
          worker.status = 'à la maison';
          if (worker.fork) worker.fork.visible = true;
          if (worker.basket) worker.basket.visible = false;
        }
        return;
      }
      if (walkWorker(controller, target, delta, time)) controller.waypoint += 1;
      return;
    }
    controller.action -= delta;
    const wave = Math.sin(time * 7.5);
    worker.group.position.y = 0;
    if (controller.task.type === 'straw') {
      if (worker.rightArm) worker.rightArm.rotation.x = -1 + wave * 0.34;
      if (worker.leftArm) worker.leftArm.rotation.x = -0.45;
      if (worker.fork) worker.fork.rotation.z = -0.55 + wave * 0.18;
    } else if (controller.task.type === 'feed') {
      if (worker.rightArm) worker.rightArm.rotation.x = -0.65 + wave * 0.18;
      if (worker.fork) worker.fork.rotation.z = -0.8;
    } else {
      if (worker.rightArm) worker.rightArm.rotation.x = -0.95 + wave * 0.13;
      if (worker.leftArm) worker.leftArm.rotation.x = -0.82;
    }
    if (controller.action > 0) return;
    if (controller.task.type === 'eggs') collectEggsPhysically();
    if (worker.rightArm) worker.rightArm.rotation.x = 0;
    if (worker.leftArm) worker.leftArm.rotation.x = 0;
    if (worker.fork) worker.fork.rotation.z = 0;
    controller.mode = 'return';
    controller.path = controller.task.path.slice(0, -1).reverse().map(point => point.clone());
    controller.path.push(PORTALS.house.outside.clone());
    controller.waypoint = 0;
    worker.status = 'retourne à la maison';
  }

  function buildAmbientEffects() {
    const metal = mat(0x4c5051, 0.62, 0.36);
    [[-10.5, -14.3], [-3, -6], [5.4, -6], [13, 8.2], [13.2, -10.5], [-11.5, 12.3], [0, 12.3]].forEach(([x, z], index) => {
      const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xffd38c, emissive: 0xffa63d, emissiveIntensity: 0, roughness: 0.36 });
      const group = new THREE.Group();
      group.add(
        mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.7, 9), metal, x, 1.35, z),
        mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), metal, x + 0.27, 2.55, z)
      );
      const bulb = mesh(new THREE.SphereGeometry(0.16, 12, 9), bulbMaterial, x + 0.58, 2.46, z);
      const light = new THREE.PointLight(0xffbd68, 0, 9, 1.8);
      light.position.set(x + 0.58, 2.45, z);
      group.add(bulb, light);
      root.add(group);
      lamps.push({ light, bulb, index });
    });

    state.snowLayer = mesh(new THREE.CircleGeometry(48, 64), new THREE.MeshStandardMaterial({
      color: 0xf4f7f7, roughness: 0.96, transparent: true, opacity: 0,
      polygonOffset: true, polygonOffsetFactor: 6, polygonOffsetUnits: 6
    }), 0, 0.028, 0, null, [-Math.PI / 2, 0, 0]);
    state.snowLayer.castShadow = false;
    state.snowLayer.renderOrder = -45;
    root.add(state.snowLayer);

    const leafCount = 190;
    const leafPositions = new Float32Array(leafCount * 3);
    for (let index = 0; index < leafCount; index += 1) {
      leafPositions[index * 3] = -28 + Math.random() * 56;
      leafPositions[index * 3 + 1] = 1 + Math.random() * 12;
      leafPositions[index * 3 + 2] = -22 + Math.random() * 48;
    }
    const leafGeometry = new THREE.BufferGeometry();
    leafGeometry.setAttribute('position', new THREE.BufferAttribute(leafPositions, 3));
    state.leaves = new THREE.Points(leafGeometry, new THREE.PointsMaterial({
      color: 0xc06b32, size: 0.16, transparent: true, opacity: 0.88, depthWrite: false
    }));
    state.leaves.visible = false;
    root.add(state.leaves);

    const flowerCount = 130;
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.018, 0.27, 5), mat(0x46913d, 0.98), flowerCount);
    const petals = new THREE.InstancedMesh(new THREE.SphereGeometry(0.062, 7, 5), mat(0xf1bd64, 0.88), flowerCount);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < flowerCount; index += 1) {
      const x = -29 + Math.random() * 58;
      const z = -20 + Math.random() * 44;
      const size = 0.65 + Math.random() * 0.9;
      quaternion.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI, 0));
      position.set(x, 0.15, z);
      scale.setScalar(size);
      matrix.compose(position, quaternion, scale);
      stems.setMatrixAt(index, matrix);
      position.y = 0.32;
      scale.setScalar(size * 0.85);
      matrix.compose(position, quaternion, scale);
      petals.setMatrixAt(index, matrix);
    }
    stems.instanceMatrix.needsUpdate = true;
    petals.instanceMatrix.needsUpdate = true;
    state.flowers = new THREE.Group();
    state.flowers.add(stems, petals);
    state.flowers.visible = false;
    root.add(state.flowers);

    for (let index = 0; index < 9; index += 1) {
      const bee = new THREE.Group();
      const wing = new THREE.MeshStandardMaterial({ color: 0xd9f3f5, transparent: true, opacity: 0.6, roughness: 0.25, side: THREE.DoubleSide });
      bee.add(
        mesh(new THREE.SphereGeometry(0.09, 9, 7), mat(0xe2ad2f, 0.72), 0, 0, 0, [1, 0.75, 1.3]),
        mesh(new THREE.TorusGeometry(0.065, 0.018, 5, 12), mat(0x26201c, 0.78), 0, 0, 0.01, null, [Math.PI / 2, 0, 0]),
        mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0x26201c, 0.78), 0, 0, 0.12),
        mesh(new THREE.SphereGeometry(0.08, 8, 5), wing, -0.08, 0.07, -0.01, [1.3, 0.25, 0.75], [0.2, 0, -0.35]),
        mesh(new THREE.SphereGeometry(0.08, 8, 5), wing, 0.08, 0.07, -0.01, [1.3, 0.25, 0.75], [0.2, 0, 0.35])
      );
      bee.visible = false;
      root.add(bee);
      bees.push({ group: bee, center: new THREE.Vector3(-10 + Math.random() * 20, 0.8, 5 + Math.random() * 12),
        phase: Math.random() * Math.PI * 2, radius: 0.8 + Math.random() * 1.6, speed: 0.7 + Math.random() * 0.9 });
    }

    for (let index = 0; index < 18; index += 1) {
      const ring = mesh(new THREE.RingGeometry(0.08, 0.11, 18), new THREE.MeshBasicMaterial({
        color: 0xbfe8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false
      }), 0, 0.085, 0, null, [-Math.PI / 2, 0, 0]);
      ring.visible = false;
      ring.userData.life = 0;
      ring.castShadow = false;
      root.add(ring);
      puddleSplashes.push(ring);
    }

    const lightning = new THREE.PointLight(0xd9ecff, 0, 100);
    lightning.position.set(0, 30, 0);
    lightning.name = 'v4-lightning';
    root.add(lightning);
  }

  function playThunder() {
    if (!state.audioUnlocked) return;
    const context = audioContext();
    if (!context) return;
    const duration = 1.8;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * Math.exp(-index / data.length * 4.2);
    const source = context.createBufferSource();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    const time = context.currentTime;
    source.buffer = buffer;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 320;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.3, time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(context.destination);
    source.start(time);
  }

  function updateAmbient(delta, time) {
    const currentSeason = season();
    const currentWeather = weather();
    const night = isNight();
    lamps.forEach((lamp, index) => {
      const target = night ? 1.05 : 0;
      lamp.light.intensity += (target - lamp.light.intensity) * Math.min(1, delta * 3.2);
      lamp.bulb.material.emissiveIntensity = lamp.light.intensity > 0.1 ? 1.5 + Math.sin(time * 2 + index) * 0.08 : 0;
    });
    const snowTarget = currentSeason === 'winter' ? currentWeather === 'snow' ? 0.84 : 0.62 : 0;
    state.snowLayer.material.opacity += (snowTarget - state.snowLayer.material.opacity) * Math.min(1, delta * 0.45);
    state.snowLayer.visible = state.snowLayer.material.opacity > 0.02;
    state.leaves.visible = currentSeason === 'autumn';
    if (state.leaves.visible) {
      const positions = state.leaves.geometry.attributes.position.array;
      for (let index = 0; index < positions.length; index += 3) {
        positions[index] += Math.sin(time + index) * delta * 0.12;
        positions[index + 1] -= delta * (0.45 + index % 7 * 0.04);
        positions[index + 2] += Math.cos(time * 0.7 + index) * delta * 0.08;
        if (positions[index + 1] < 0.1) {
          positions[index] = -28 + Math.random() * 56;
          positions[index + 1] = 7 + Math.random() * 7;
          positions[index + 2] = -22 + Math.random() * 48;
        }
      }
      state.leaves.geometry.attributes.position.needsUpdate = true;
    }
    state.flowers.visible = currentSeason === 'spring';
    bees.forEach(bee => {
      bee.group.visible = currentSeason === 'spring';
      if (!bee.group.visible) return;
      const angle = time * bee.speed + bee.phase;
      bee.group.position.set(bee.center.x + Math.cos(angle) * bee.radius,
        bee.center.y + Math.sin(time * 2.1 + bee.phase) * 0.25,
        bee.center.z + Math.sin(angle) * bee.radius * 0.7);
      bee.group.rotation.y = -angle + Math.PI / 2;
    });
    if (currentWeather === 'rain') {
      state.splashTimer -= delta;
      if (state.splashTimer <= 0) {
        state.splashTimer = 0.05 + Math.random() * 0.09;
        const available = puddleSplashes.find(ring => !ring.visible);
        if (available) {
          available.visible = true;
          available.userData.life = 0.55;
          available.position.set(-28 + Math.random() * 56, 0.085, -22 + Math.random() * 48);
          available.scale.setScalar(0.35);
          available.material.opacity = 0.72;
        }
      }
      state.thunderTimer -= delta;
      if (state.thunderTimer <= 0) {
        state.thunderTimer = 16 + Math.random() * 22;
        state.lightning = 0.26;
        playThunder();
      }
    }
    puddleSplashes.forEach(ring => {
      if (!ring.visible) return;
      ring.userData.life -= delta;
      ring.scale.multiplyScalar(1 + delta * 3.2);
      ring.material.opacity = Math.max(0, ring.userData.life * 1.3);
      if (ring.userData.life <= 0) {
        ring.visible = false;
        ring.scale.setScalar(1);
      }
    });
    const lightning = root.getObjectByName('v4-lightning');
    if (state.lightning > 0) {
      state.lightning -= delta;
      lightning.intensity = state.lightning > 0.13 ? 9 : 3.5;
    } else lightning.intensity = 0;
  }

  function buildFarmDetails() {
    const metal = mat(0x8c9697, 0.56, 0.42);
    const darkMetal = mat(0x53595b, 0.62, 0.38);
    const roof = mat(0x7b4a37, 0.9);
    const wood = mat(0x6d4b34, 0.96);
    const straw = mat(0xcaa24d, 0.98);
    [20.5, 23.6].forEach((x, index) => {
      const z = 13.8 + index * 0.3;
      root.add(
        mesh(new THREE.CylinderGeometry(1.28, 1.42, 5.5, 22), metal, x, 2.75, z),
        mesh(new THREE.ConeGeometry(1.48, 1.55, 22), roof, x, 6.28, z),
        mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.8, 8), darkMetal, x + 1.48, 2.7, z)
      );
    });
    [[2.8, 5.3, 2.4], [8.1, 4.4, 2.6], [0, 15.3, 2.8], [-11.5, 15.2, 2.2], [3, -11.2, 2.4]].forEach(([x, z, length]) => {
      const group = new THREE.Group();
      group.add(
        mesh(new THREE.BoxGeometry(length, 0.18, 0.62), wood, x, 0.28, z),
        mesh(new THREE.BoxGeometry(length, 0.58, 0.12), wood, x, 0.54, z - 0.32, null, [0.18, 0, 0]),
        mesh(new THREE.BoxGeometry(length, 0.58, 0.12), wood, x, 0.54, z + 0.32, null, [-0.18, 0, 0])
      );
      root.add(group);
    });
    [[8.2, 0.52, 15.8], [9.35, 0.52, 15.8], [10.5, 0.52, 15.8], [8.78, 1.34, 15.8], [9.93, 1.34, 15.8], [9.35, 2.16, 15.8]].forEach(([x, y, z]) => {
      root.add(mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.75, 14), straw, x, y, z, null, [0, 0, Math.PI / 2]));
    });
  }

  function updateInteriorCamera() {
    if (!state.interior) return;
    const center = INTERIOR_CENTER[state.interior];
    const offset = state.interior === 'coop' ? new THREE.Vector3(9.8, 6.2, -10.5) : new THREE.Vector3(12.5, 7.2, -13);
    camera.position.copy(center).add(offset);
    camera.lookAt(center.x, center.y + 1.1, center.z);
    renderer.render(scene, camera);
  }

  function initialize() {
    buildCoop();
    buildBarn();
    interiors.coop = buildInterior('coop');
    interiors.barn = buildInterior('barn');
    addProxy('coop', BUILDINGS.coop);
    addProxy('barn', BUILDINGS.barn);
    buildRoadCurve();
    buildAmbientEffects();
    buildFarmDetails();
    installInteriorInput();
    scanAnimals();
    installWorkers();
    window.farmInteriorView = { enter: enterInterior, exit: leaveInterior, current: () => state.interior };
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const delta = Math.min(0.05, Math.max(0, (now - state.lastTime) / 1000));
    state.lastTime = now;
    const time = now / 1000;
    state.scanTimer -= delta;
    if (state.scanTimer <= 0) {
      state.scanTimer = 0.75;
      scanAnimals();
      installWorkers();
    }
    enforceShelter(delta);
    workerControllers.forEach(controller => updateWorker(controller, delta, time));
    updateTruck();
    updateAmbient(delta, time);
    updateInteriorCamera();
  }

  initialize();
  setTimeout(() => requestAnimationFrame(loop), 0);
})();
