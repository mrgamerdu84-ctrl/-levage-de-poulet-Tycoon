'use strict';
(() => {
  if (!window.FarmLivingV3) return;

  const L = window.FarmLivingV3;
  const { F, root, mat, mesh } = L;
  let curve = null;
  let previousState = '';
  let pendingHorn = false;

  function hide(name) {
    const object = scene.getObjectByName(name);
    if (object) object.visible = false;
  }

  function roadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    context.fillStyle = '#95704e';
    context.fillRect(0, 0, 128, 256);

    for (let index = 0; index < 1200; index += 1) {
      const value = 65 + Math.floor(Math.random() * 95);
      context.fillStyle =
        `rgba(${value + 58},${value + 32},${value + 10},` +
        `${0.07 + Math.random() * 0.2})`;

      context.fillRect(
        Math.random() * 128,
        Math.random() * 256,
        1 + Math.random() * 2,
        1 + Math.random() * 2
      );
    }

    context.strokeStyle = 'rgba(70,43,27,.32)';
    context.lineWidth = 3;

    [38, 90].forEach(x => {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, 256);
      context.stroke();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 20);
    return texture;
  }

  function buildRoad(width) {
    const segments = 180;
    const positions = [];
    const uvs = [];
    const indices = [];
    const side = new THREE.Vector3();

    for (let index = 0; index <= segments; index += 1) {
      const ratio = index / segments;
      const point = curve.getPointAt(ratio);
      const tangent = curve.getTangentAt(ratio).normalize();

      side.set(-tangent.z, 0, tangent.x).normalize();

      const left = point.clone().addScaledVector(side, width / 2);
      const right = point.clone().addScaledVector(side, -width / 2);

      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      uvs.push(0, ratio * 20, 1, ratio * 20);

      if (index < segments) {
        const base = index * 2;
        indices.push(
          base, base + 2, base + 1,
          base + 1, base + 2, base + 3
        );
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(uvs, 2)
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const road = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        map: roadTexture(),
        roughness: 1,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4
      })
    );

    road.name = 'rear-farm-mountain-road-v3';
    road.receiveShadow = true;
    road.castShadow = false;
    road.renderOrder = -35;
    root.add(road);
  }

  function buildBridge() {
    const group = new THREE.Group();
    group.name = 'mountain-bridge-v3';

    const wood = mat(0x684830, 0.97);
    const metal = mat(0x696f72, 0.56, 0.32);

    for (let index = 0; index < 20; index += 1) {
      const ratio = 0.035 + index * 0.0065;
      const point = curve.getPointAt(ratio);
      const tangent = curve.getTangentAt(ratio).normalize();
      const rotationY = Math.atan2(tangent.x, tangent.z);

      group.add(mesh(
        new THREE.BoxGeometry(4.7, 0.24, 0.55),
        wood,
        point.x,
        point.y + 0.12,
        point.z,
        null,
        [0, rotationY, 0]
      ));

      if (index % 2 !== 0) continue;

      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      [-1, 1].forEach(direction => {
        const railPoint = point.clone().addScaledVector(side, direction * 2.15);

        group.add(
          mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.25, 7),
            wood, railPoint.x, 0.65, railPoint.z),
          mesh(new THREE.BoxGeometry(0.08, 0.08, 1.25),
            metal, railPoint.x, 1.08, railPoint.z,
            null, [0, rotationY, 0])
        );
      });
    }

    root.add(group);
  }

  function buildMountainPortal() {
    const point = curve.getPointAt(0);
    const tangent = curve.getTangentAt(0).normalize();

    const group = new THREE.Group();
    group.name = 'bridge-mountain-portal-v3';
    group.position.copy(point);
    group.rotation.y = Math.atan2(tangent.x, tangent.z);

    const rock = mat(0x64635d, 1);
    const grass = mat(0x496d3d, 1);
    const dark = new THREE.MeshBasicMaterial({
      color: 0x090b0d,
      side: THREE.DoubleSide
    });

    group.add(
      mesh(new THREE.PlaneGeometry(4.5, 3.65), dark, 0, 1.8, 0.18),
      mesh(new THREE.BoxGeometry(0.8, 3.4, 1.2), rock, -2.5, 1.7, 0),
      mesh(new THREE.BoxGeometry(0.8, 3.4, 1.2), rock, 2.5, 1.7, 0),
      mesh(new THREE.TorusGeometry(2.35, 0.48, 10, 32, Math.PI),
        rock, 0, 1.45, 0.05)
    );

    [
      [-5.5, 2.3, -2.5, 5.8, 5, 5.8],
      [5.5, 2.4, -2.4, 5.9, 5.2, 5.9],
      [0, 5, -5.5, 8.5, 7, 7.2],
      [-3.5, 6, -5.8, 5.2, 4.6, 5.1],
      [3.8, 5.8, -5.6, 5.1, 4.5, 5.2]
    ].forEach((entry, index) => {
      group.add(mesh(
        new THREE.DodecahedronGeometry(1, 1),
        index < 2 ? rock : grass,
        entry[0], entry[1], entry[2],
        [entry[3], entry[4], entry[5]],
        [index * 0.08, index * 0.18, index * 0.04]
      ));
    });

    root.add(group);
  }

  function installRoute() {
    [
      'realistic-mountain-road',
      'mountain-tunnel',
      'collision-safe-truck-road'
    ].forEach(hide);

    curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-50, 0.08, -31.5),
      new THREE.Vector3(-46, 0.08, -29.8),
      new THREE.Vector3(-41, 0.065, -27.2),
      new THREE.Vector3(-35, 0.05, -25),
      new THREE.Vector3(-28, 0.045, -23.8),
      new THREE.Vector3(-20, 0.045, -23.2),
      new THREE.Vector3(-12, 0.045, -23),
      new THREE.Vector3(-4, 0.045, -22.6),
      new THREE.Vector3(4, 0.045, -21),
      new THREE.Vector3(10, 0.045, -18),
      new THREE.Vector3(16, 0.045, -13),
      new THREE.Vector3(17.2, 0.045, -10),
      new THREE.Vector3(13.2, 0.045, -9.2)
    ], false, 'catmullrom', 0.35);

    F.truckCurve = curve;
    buildRoad(4.5);
    buildBridge();
    buildMountainPortal();
  }

  function playHorn() {
    if (!L.audioUnlocked) {
      if (!pendingHorn) {
        pendingHorn = true;
        L.onAudioUnlock(() => {
          pendingHorn = false;
          playHorn();
        });
      }
      return;
    }

    const context = L.audio();
    if (!context) return;

    const start = context.currentTime;

    [0, 0.38].forEach(delay => {
      const gain = context.createGain();

      gain.gain.setValueAtTime(0.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(0.28, start + delay + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.31);

      [185, 235].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = index ? 'square' : 'sawtooth';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(start + delay);
        oscillator.stop(start + delay + 0.33);
      });

      gain.connect(context.destination);
    });
  }

  function updateTruck() {
    const truck = window.farmTruckState;
    if (!truck || !truck.group || !curve) return;

    const progress = THREE.MathUtils.clamp(
      Number(truck.progress) || 0,
      0,
      1
    );

    if (truck.state === 'arriving' || truck.state === 'leaving') {
      const point = curve.getPointAt(progress);
      const tangent = curve.getTangentAt(progress).normalize();
      const direction = truck.state === 'arriving' ? 1 : -1;

      truck.group.position.copy(point);
      truck.group.rotation.y = Math.atan2(
        direction * tangent.x,
        direction * tangent.z
      );
      truck.group.visible = progress > 0.055;
    } else if (
      truck.state === 'waitingPlayer' ||
      truck.state === 'loading'
    ) {
      const point = curve.getPointAt(1);
      const tangent = curve.getTangentAt(1).normalize();

      truck.group.position.copy(point);
      truck.group.rotation.y = Math.atan2(tangent.x, tangent.z);
      truck.group.visible = true;
    } else if (truck.state === 'waiting') {
      truck.group.visible = false;
    }

    if (
      truck.state === 'waitingPlayer' &&
      previousState !== 'waitingPlayer'
    ) {
      playHorn();
      L.notify('Le camion vient de s’arrêter derrière l’entrepôt.');
    }

    previousState = truck.state;
  }

  installRoute();
  L.addUpdate(updateTruck);
})();