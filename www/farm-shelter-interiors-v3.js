'use strict';
(() => {
  if (!window.FarmLivingV3) return;

  const L = window.FarmLivingV3;
  const { F, root, V, mat, mesh } = L;
  const shelter = new Map();
  const proxies = [];
  const clones = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const temporary = new THREE.Vector3();

  const centers = {
    coop: new THREE.Vector3(-12, 60, 118),
    barn: new THREE.Vector3(12, 60, 118)
  };

  let interior = null;
  let pointerDown = null;
  let ready = false;

  function hideOldBarn() {
    ['barn-door-shell', 'barn-real-brick-facade'].forEach(name => {
      const object = scene.getObjectByName(name);
      if (object) object.visible = false;
    });

    scene.traverse(object => {
      if (!object.isGroup || object === root) return;
      object.getWorldPosition(temporary);

      if (
        Math.abs(temporary.x - 13) > 0.45 ||
        Math.abs(temporary.z - 14) > 0.45
      ) return;

      const oldBody = object.children.some(child => {
        if (
          !child.isMesh ||
          !child.geometry ||
          child.geometry.type !== 'BoxGeometry'
        ) return false;

        const parameters = child.geometry.parameters || {};
        return (
          Math.abs(Number(parameters.width || 0) - 9) < 0.4 &&
          Math.abs(Number(parameters.depth || 0) - 7) < 0.4 &&
          Number(parameters.height || 0) > 4
        );
      });

      if (oldBody) object.visible = false;
    });
  }

  function brickTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    context.fillStyle = '#d8c7b0';
    context.fillRect(0, 0, 256, 128);

    for (let row = 0; row < 6; row += 1) {
      for (let column = -1; column < 7; column += 1) {
        const width = 48;
        const height = 22;
        const offset = row % 2 ? -24 : 0;
        const x = column * width + offset + 2;
        const y = row * height + 2;
        const random = Math.random();

        context.fillStyle =
          random < 0.25 ? '#b65d48' :
          random > 0.8 ? '#773328' :
          '#984232';

        context.fillRect(x, y, width - 4, height - 4);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    return texture;
  }

  function buildVerticalBarn() {
    hideOldBarn();

    Object.assign(F.buildings.barn, {
      x: 13,
      z: 13.5,
      w: 7,
      d: 9,
      h: 5.25,
      front: -1
    });

    Object.assign(F.portals.barn, {
      axis: 'z',
      out: V(13, 7.95),
      gate: V(13, 9),
      inside: V(13, 10.15),
      half: 1.45
    });

    const group = new THREE.Group();
    group.name = 'vertical-real-barn-v3';
    group.userData.farmInteriorType = 'barn';

    const brick = new THREE.MeshStandardMaterial({
      map: brickTexture(),
      roughness: 0.95,
      flatShading: false
    });
    const stone = mat(0x696159, 0.98);
    const wood = mat(0x60402c, 0.96);
    const roof = mat(0x79382d, 0.92);
    const dark = mat(0x211b18, 1);
    const cream = mat(0xe8dbc8, 0.92);

    const building = F.buildings.barn;
    const x = building.x;
    const z = building.z;
    const front = z - building.d / 2;
    const back = z + building.d / 2;
    const doorWidth = 2.9;
    const sideWidth = (building.w - doorWidth) / 2;

    group.add(mesh(
      new THREE.BoxGeometry(building.w + 0.4, 0.5, building.d + 0.4),
      stone, x, 0.25, z
    ));

    group.add(
      mesh(new THREE.BoxGeometry(sideWidth, building.h, 0.22), brick,
        x - doorWidth / 2 - sideWidth / 2, building.h / 2, front),
      mesh(new THREE.BoxGeometry(sideWidth, building.h, 0.22), brick,
        x + doorWidth / 2 + sideWidth / 2, building.h / 2, front),
      mesh(new THREE.BoxGeometry(doorWidth, 1.9, 0.22), brick,
        x, 4.3, front),
      mesh(new THREE.BoxGeometry(building.w, building.h, 0.22), brick,
        x, building.h / 2, back),
      mesh(new THREE.BoxGeometry(0.22, building.h, building.d), brick,
        x - building.w / 2, building.h / 2, z),
      mesh(new THREE.BoxGeometry(0.22, building.h, building.d), brick,
        x + building.w / 2, building.h / 2, z)
    );

    group.add(
      mesh(new THREE.BoxGeometry(doorWidth - 0.12, 3.35, 0.08), dark,
        x, 1.68, front - 0.13),
      mesh(new THREE.BoxGeometry(1.35, 3.2, 0.15), wood,
        x - 1.1, 1.6, front - 0.28, null, [0, -0.88, 0]),
      mesh(new THREE.BoxGeometry(1.35, 3.2, 0.15), wood,
        x + 1.1, 1.6, front - 0.28, null, [0, 0.88, 0]),
      mesh(new THREE.BoxGeometry(doorWidth + 0.4, 0.18, 0.22), cream,
        x, 3.42, front - 0.16),
      mesh(new THREE.BoxGeometry(0.18, 3.35, 0.22), cream,
        x - doorWidth / 2 - 0.09, 1.7, front - 0.16),
      mesh(new THREE.BoxGeometry(0.18, 3.35, 0.22), cream,
        x + doorWidth / 2 + 0.09, 1.7, front - 0.16)
    );

    group.add(
      mesh(new THREE.BoxGeometry(7.7, 0.35, 5.3), roof,
        x, 6.2, z - 2.25, null, [0.68, 0, 0]),
      mesh(new THREE.BoxGeometry(7.7, 0.35, 5.3), roof,
        x, 6.2, z + 2.25, null, [-0.68, 0, 0])
    );

    root.add(group);
  }

  function nest(parent, x, y, z, scale = 1) {
    const straw = mat(0xd1ad58, 0.98);
    const wood = mat(0x6e4b33, 0.96);

    parent.add(
      mesh(new THREE.CylinderGeometry(0.48 * scale, 0.56 * scale, 0.22, 14),
        wood, x, y, z),
      mesh(new THREE.TorusGeometry(0.39 * scale, 0.11 * scale, 8, 24),
        straw, x, y + 0.17, z, [1, 0.58, 1], [Math.PI / 2, 0, 0])
    );
  }

  function buildCoopInterior() {
    const center = centers.coop;
    const group = new THREE.Group();
    group.name = 'coop-interior-v3';
    group.visible = false;

    const floor = mat(0xa98757, 1);
    const wall = mat(0xb25a43, 0.96);
    const wood = mat(0x5f402c, 0.97);

    group.add(
      mesh(new THREE.BoxGeometry(11, 0.35, 8), floor,
        center.x, center.y, center.z),
      mesh(new THREE.BoxGeometry(11, 4.5, 0.3), wall,
        center.x, center.y + 2.25, center.z + 4),
      mesh(new THREE.BoxGeometry(0.3, 4.5, 8), wall,
        center.x - 5.5, center.y + 2.25, center.z),
      mesh(new THREE.BoxGeometry(0.3, 4.5, 8), wall,
        center.x + 5.5, center.y + 2.25, center.z)
    );

    for (let index = 0; index < 8; index += 1) {
      nest(
        group,
        center.x - 3.6 + index % 4 * 2.4,
        center.y + 0.28,
        center.z + 2.55 - Math.floor(index / 4) * 2.05,
        1.05
      );
    }

    group.add(mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 8.2, 10),
      wood,
      center.x,
      center.y + 1.7,
      center.z - 2.6,
      null,
      [0, 0, Math.PI / 2]
    ));

    const light = new THREE.PointLight(0xffc777, 1.05, 18);
    light.position.set(center.x, center.y + 3.2, center.z);
    group.add(light);

    root.add(group);
    return group;
  }

  function buildBarnInterior() {
    const center = centers.barn;
    const group = new THREE.Group();
    group.name = 'barn-interior-v3';
    group.visible = false;

    const floor = mat(0x705943, 1);
    const brick = mat(0x934836, 0.96);
    const wood = mat(0x5b3d2a, 0.97);
    const straw = mat(0xcaa34f, 0.99);

    group.add(
      mesh(new THREE.BoxGeometry(14, 0.4, 10), floor,
        center.x, center.y, center.z),
      mesh(new THREE.BoxGeometry(14, 5.2, 0.35), brick,
        center.x, center.y + 2.6, center.z + 5),
      mesh(new THREE.BoxGeometry(0.35, 5.2, 10), brick,
        center.x - 7, center.y + 2.6, center.z),
      mesh(new THREE.BoxGeometry(0.35, 5.2, 10), brick,
        center.x + 7, center.y + 2.6, center.z)
    );

    for (let index = 0; index < 6; index += 1) {
      const side = index < 3 ? -1 : 1;
      const row = index % 3;
      const x = center.x + side * 4.4;
      const z = center.z + 2.7 - row * 2.7;

      group.add(
        mesh(new THREE.BoxGeometry(3.7, 0.16, 2.15), straw,
          x, center.y + 0.16, z),
        mesh(new THREE.BoxGeometry(0.15, 1.35, 2.4), wood,
          center.x + side * 2.55, center.y + 0.7, z),
        mesh(new THREE.BoxGeometry(3.8, 0.12, 0.12), wood,
          x, center.y + 1.25, z - 1.08)
      );
    }

    const light = new THREE.PointLight(0xffbf68, 1.1, 22);
    light.position.set(center.x, center.y + 3.5, center.z);
    group.add(light);

    root.add(group);
    return group;
  }

  const coopInterior = buildCoopInterior();
  const barnInterior = buildBarnInterior();

  function proxy(type, x, y, z, width, height, depth) {
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    const object = mesh(
      new THREE.BoxGeometry(width, height, depth),
      material, x, y, z
    );

    object.castShadow = false;
    object.receiveShadow = false;
    object.userData.farmInteriorType = type;
    root.add(object);
    proxies.push(object);
  }

  proxy('coop', -15, 2.2, -6, 8.4, 4.8, 6.4);
  proxy('barn', 13, 2.8, 13.5, 7.4, 5.8, 9.4);

  const exitButton = document.createElement('button');
  exitButton.type = 'button';
  exitButton.textContent = '← Retour à la ferme';
  exitButton.style.cssText =
    'position:fixed;left:50%;bottom:calc(78px + env(safe-area-inset-bottom));' +
    'transform:translateX(-50%);z-index:210;display:none;border:0;' +
    'border-radius:14px;padding:11px 16px;background:#fff8e9;color:#4a3728;' +
    'box-shadow:0 8px 25px #23191247;font:700 13px Inter,sans-serif;' +
    'pointer-events:auto';

  document.body.appendChild(exitButton);

  ['pointerdown', 'pointerup', 'click'].forEach(type => {
    exitButton.addEventListener(type, event => event.stopPropagation());
  });

  function clearClones() {
    clones.forEach(clone => {
      if (clone.parent) clone.parent.remove(clone);
    });
    clones.length = 0;
  }

  function cleanUserData(object) {
    object.traverse(item => {
      item.userData = {};
    });
  }

  function populate(type) {
    clearClones();

    const list = L.animals.filter(animal =>
      type === 'coop'
        ? animal.type === 'hen' || animal.type === 'rooster'
        : animal.type !== 'hen' && animal.type !== 'rooster'
    );

    const center = centers[type];
    const parent = type === 'coop' ? coopInterior : barnInterior;

    list.forEach((animal, index) => {
      const clone = animal.group.clone(true);
      cleanUserData(clone);
      clone.visible = true;

      if (type === 'coop') {
        clone.position.set(
          center.x - 3.6 + index % 4 * 2.4,
          center.y + 0.48,
          center.z + 2.55 - Math.floor(index / 4) * 2.05
        );
        clone.rotation.y = Math.PI;
        clone.scale.multiply(new THREE.Vector3(1, 0.65, 1.02));
      } else {
        const side = index % 2 ? 1 : -1;
        const row = Math.floor(index / 2) % 3;
        clone.position.set(
          center.x + side * 4.35,
          center.y + 0.42,
          center.z + 2.7 - row * 2.7
        );
        clone.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        clone.rotation.z = side * 0.05;
        clone.scale.multiply(new THREE.Vector3(1.04, 0.7, 1.08));
      }

      parent.add(clone);
      clones.push(clone);
    });
  }

  function enter(type) {
    interior = type;
    coopInterior.visible = type === 'coop';
    barnInterior.visible = type === 'barn';
    populate(type);
    exitButton.style.display = 'block';

    const hud = document.getElementById('tycoonHud');
    if (hud) hud.style.opacity = '0.25';

    L.notify(type === 'coop'
      ? 'Intérieur du poulailler : les poules et le coq reposent dans leurs nids.'
      : 'Intérieur de la grange : les animaux se reposent dans leurs stalles.'
    );
  }

  function leave() {
    interior = null;
    coopInterior.visible = false;
    barnInterior.visible = false;
    clearClones();
    exitButton.style.display = 'none';

    const hud = document.getElementById('tycoonHud');
    if (hud) hud.style.opacity = '';
  }

  exitButton.addEventListener('click', leave);

  function hitBuilding(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(proxies, true);
    return hits.length ? hits[0].object.userData.farmInteriorType : null;
  }

  renderer.domElement.addEventListener('pointerdown', event => {
    pointerDown = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
  }, { passive: true });

  window.addEventListener('pointerup', event => {
    if (!pointerDown || interior) {
      pointerDown = null;
      return;
    }

    const start = pointerDown;
    pointerDown = null;

    if (
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8 ||
      performance.now() - start.time > 800
    ) return;

    const type = hitBuilding(event.clientX, event.clientY);
    if (!type) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    enter(type);
  }, true);

  function largestColor(group, fallback) {
    let color = new THREE.Color(fallback);
    let score = -1;

    group.traverse(object => {
      if (!object.isMesh || !object.material) return;
      const material = Array.isArray(object.material)
        ? object.material[0]
        : object.material;

      if (!material || !material.color) return;

      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const volume = size.x * size.y * size.z;

      if (volume > score) {
        score = volume;
        color = material.color.clone();
      }
    });

    return color;
  }

  function refineBird(group, type) {
    if (
      (type !== 'hen' && type !== 'rooster') ||
      group.userData.realisticBirdV3
    ) return;

    group.userData.realisticBirdV3 = true;

    [
      'visual-bird-details',
      'chicken-refined-details-v2',
      'realistic-chicken-details',
      'realistic-bird-v3'
    ].forEach(name => {
      const old = group.getObjectByName(name);
      if (old && old.parent) old.parent.remove(old);
    });

    const rooster = type === 'rooster';
    const base = largestColor(group, rooster ? 0x4a2e22 : 0xb7804b);
    const cream = mat(base.clone().lerp(new THREE.Color(0xfff3d8), 0.42).getHex(), 0.94);
    const warm = mat(base.clone().lerp(new THREE.Color(0xb95a32), 0.26).getHex(), 0.92);
    const dark = mat(rooster ? 0x251b19 : base.clone().lerp(new THREE.Color(0x241813), 0.35).getHex(), 0.9);
    const copper = mat(0x8e3f28, 0.88);
    const burgundy = mat(0x5b2222, 0.9);
    const leg = mat(0xd49135, 0.72);

    group.traverse(object => {
      if (!object.isMesh) return;

      if (
        object.geometry &&
        object.geometry.type === 'ConeGeometry' &&
        object.position.z < -0.25
      ) {
        object.visible = false;
      }

      const material = Array.isArray(object.material)
        ? object.material[0]
        : object.material;

      if (
        material &&
        material.color &&
        material.color.g > material.color.r * 1.12 &&
        material.color.g > material.color.b * 1.1
      ) {
        object.material = dark;
      }
    });

    const details = new THREE.Group();
    details.name = 'realistic-bird-v3';

    for (let row = 0; row < 3; row += 1) {
      const count = 3 + row;

      for (let index = 0; index < count; index += 1) {
        const centered = index - (count - 1) / 2;
        details.add(mesh(
          new THREE.SphereGeometry(1, 11, 8),
          row === 2 ? warm : cream,
          centered * 0.11,
          0.72 - row * 0.11,
          0.32 + row * 0.03,
          [0.095, 0.032, 0.15],
          [-0.2, 0, centered * 0.05]
        ));
      }
    }

    [-1, 1].forEach(side => {
      for (let row = 0; row < 3; row += 1) {
        for (let index = 0; index < 5; index += 1) {
          details.add(mesh(
            new THREE.SphereGeometry(1, 11, 7),
            row === 0 ? warm : dark,
            side * (0.35 + row * 0.017),
            0.64 - row * 0.085,
            0.2 - index * 0.145,
            [0.066, 0.028, 0.19 - row * 0.015],
            [0.14 + index * 0.025, side * 0.26, side * (0.09 + row * 0.035)]
          ));
        }
      }
    });

    const count = rooster ? 8 : 6;
    const materials = rooster
      ? [dark, burgundy, copper, dark, cream, copper, burgundy, dark]
      : [dark, warm, cream, warm, dark, cream];

    for (let index = 0; index < count; index += 1) {
      const centered = index - (count - 1) / 2;
      details.add(mesh(
        new THREE.ConeGeometry(
          rooster ? 0.052 : 0.047,
          (rooster ? 0.72 : 0.43) - Math.abs(centered) * 0.04,
          9
        ),
        materials[index % materials.length],
        centered * 0.055,
        0.75 + Math.abs(centered) * 0.024,
        -0.52,
        null,
        [-1.18 - Math.abs(centered) * 0.045, 0, centered * 0.12]
      ));
    }

    [-1, 1].forEach(side => {
      [-0.05, 0, 0.05].forEach((spread, index) => {
        details.add(mesh(
          new THREE.CylinderGeometry(0.011, 0.016, 0.17, 7),
          leg,
          side * 0.13 + spread,
          0.02,
          0.055 + index * 0.02,
          null,
          [Math.PI / 2.22, 0, spread * 5.2]
        ));
      });
    });

    group.add(details);
  }

  function route(animal, index) {
    const path = [];
    const bird = animal.type === 'hen' || animal.type === 'rooster';

    if (bird) {
      path.push(
        F.portals.coop.out.clone(),
        F.portals.coop.gate.clone(),
        F.portals.coop.inside.clone()
      );

      const offset = (index % 6 - 2.5) * 0.32;
      path.push(V(-15 + offset, -5 - Math.floor(index / 6) * 0.45));
      return path;
    }

    const portal = F.portals[animal.type];
    if (portal) {
      path.push(
        portal.inside.clone(),
        portal.gate.clone(),
        portal.out.clone()
      );
    }

    if (animal.type === 'cow') {
      path.push(V(16.4, 0.2), V(18, 7.8));
    } else if (animal.type === 'sheep') {
      path.push(V(5.7, 12.6), V(8, 8));
    } else if (animal.type === 'duck') {
      path.push(V(-6.5, 12.55), V(5.5, 12.2), V(8, 8));
    } else if (animal.type === 'pig') {
      path.push(V(8, -7.4), V(18, -4), V(18, 7.8));
    }

    const offset = (index % 5 - 2) * 0.25;

    path.push(
      F.portals.barn.out.clone().add(V(offset, 0)),
      F.portals.barn.gate.clone().add(V(offset, 0)),
      F.portals.barn.inside.clone().add(V(offset, 0)),
      V(13 + offset, 11.6 + Math.floor(index / 5) * 0.24)
    );

    return path;
  }

  function startShelter(animal, index) {
    if (shelter.has(animal.group)) return;

    shelter.set(animal.group, {
      animal,
      path: route(animal, index),
      waypoint: 0,
      position: animal.group.position.clone(),
      oldPosition: animal.group.position.clone(),
      oldRotation: animal.group.rotation.y,
      oldVisible: animal.group.visible,
      oldState: animal.data && animal.data.state,
      oldTimer: animal.data && animal.data.stateTimer,
      oldTarget: animal.data && animal.data.target && animal.data.target.clone
        ? animal.data.target.clone()
        : null,
      hidden: false,
      index
    });
  }

  function moveShelter(record, delta) {
    if (record.hidden) return;

    const target = record.path[record.waypoint];

    if (!target) {
      record.animal.group.visible = false;
      record.hidden = true;
      return;
    }

    const dx = target.x - record.position.x;
    const dz = target.z - record.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance < 0.17) {
      record.position.copy(target);
      record.waypoint += 1;
    } else {
      const speed =
        record.animal.type === 'cow' ? 1.05 :
        record.animal.type === 'sheep' ? 1.22 :
        record.animal.type === 'duck' ? 1.35 :
        record.animal.type === 'pig' ? 1.18 :
        1.52;

      const step = Math.min(distance, speed * delta);
      record.position.x += dx / distance * step;
      record.position.z += dz / distance * step;
      record.animal.group.rotation.y = Math.atan2(dx, dz);
    }

    record.animal.group.visible = true;
    record.animal.group.position.copy(record.position);
    record.animal.group.position.y =
      Math.abs(Math.sin(performance.now() * 0.007 + record.index)) * 0.025;

    if (record.animal.data) {
      record.animal.data.state = 'livingWorldShelter';
      record.animal.data.stateTimer = 999999;
    }
  }

  function releaseShelter() {
    shelter.forEach(record => {
      const animal = record.animal;
      animal.group.visible = record.oldVisible;
      animal.group.position.copy(record.oldPosition);
      animal.group.rotation.y = record.oldRotation;

      if (!animal.data) return;

      animal.data._in = false;
      animal.data._ws = null;

      if (
        animal.data.currentEgg &&
        animal.data.currentEgg.incubating &&
        animal.data.nest
      ) {
        animal.group.position.set(animal.data.nest.x, 0, animal.data.nest.z);
        animal.data.state = 'brooding';
        animal.data.stateTimer = Math.max(5, Number(record.oldTimer) || 12);
      } else {
        animal.data.state = [
          'weatherShelter',
          'climateShelter',
          'structureShelter',
          'livingWorldShelter'
        ].includes(record.oldState)
          ? 'wander'
          : record.oldState || 'wander';

        animal.data.stateTimer = Math.max(
          3,
          Number(record.oldTimer) || 4 + Math.random() * 5
        );
      }

      if (
        record.oldTarget &&
        animal.data.target &&
        animal.data.target.copy
      ) {
        animal.data.target.copy(record.oldTarget);
      }
    });

    shelter.clear();
  }

  function updateShelter(delta) {
    const active =
      L.isNight() ||
      ['rain', 'snow', 'heat'].includes(L.weather());

    window.FARM_INTERIOR_SHELTER_V3_ACTIVE = active;

    if (!active) {
      if (shelter.size) {
        releaseShelter();
        L.notify('Le jour revient et les animaux ressortent de leurs abris.');
      }
      return;
    }

    L.animals.forEach(startShelter);
    shelter.forEach(record => moveShelter(record, delta));
  }

  function updateInteriorCamera() {
    if (!interior) return;

    const center = centers[interior];
    const offset = interior === 'coop'
      ? new THREE.Vector3(9.8, 6.2, -10.5)
      : new THREE.Vector3(12.5, 7.2, -13);

    camera.position.copy(center).add(offset);
    camera.lookAt(center.x, center.y + 1.1, center.z);
  }

  function initialize() {
    if (ready) return;
    if (F.initWorld && !F.initWorld()) {
      window.setTimeout(initialize, 250);
      return;
    }

    buildVerticalBarn();
    L.addScan(list => {
      list.forEach(animal => refineBird(animal.group, animal.type));
    });
    L.addUpdate(updateShelter);
    L.addUpdate(updateInteriorCamera);

    window.farmInteriorView = {
      enter,
      exit: leave,
      current: () => interior
    };

    ready = true;
  }

  initialize();
})();