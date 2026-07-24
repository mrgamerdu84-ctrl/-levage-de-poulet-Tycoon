'use strict';
(() => {
  if (!window.FarmLivingV3) return;

  const L = window.FarmLivingV3;
  const { root, mat, mesh } = L;
  const lamps = [];
  const splashes = [];
  const bees = [];

  let snow = null;
  let leaves = null;
  let flowers = null;
  let groundMaterial = null;
  let groundBase = null;
  let thunderTimer = 12 + Math.random() * 15;
  let lightningTimer = 0;
  let splashTimer = 0;

  const lightning = new THREE.PointLight(0xd9ecff, 0, 100);
  lightning.position.set(0, 30, 0);
  root.add(lightning);

  function findGround() {
    let best = null;
    let area = -1;

    scene.traverse(object => {
      if (!object.isMesh || !object.geometry || !object.material) return;
      const parameters = object.geometry.parameters || {};
      const currentArea =
        Number(parameters.width || 0) *
        Number(parameters.height || 0);

      if (
        object.geometry.type === 'PlaneGeometry' &&
        currentArea > area
      ) {
        best = object;
        area = currentArea;
      }
    });

    if (!best) return;

    groundMaterial = Array.isArray(best.material)
      ? best.material[0]
      : best.material;

    if (groundMaterial && groundMaterial.color) {
      groundBase = groundMaterial.color.clone();
    }
  }

  function buildLamps() {
    const positions = [
      [-10.5, -14.3],
      [-3, -6],
      [5.4, -6],
      [13, 8.4],
      [13.2, -10.5],
      [-11.5, 12.3],
      [0, 12.3]
    ];

    const metal = mat(0x4c5051, 0.62, 0.36);
    const bulbMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd38c,
      emissive: 0xffa63d,
      emissiveIntensity: 0,
      roughness: 0.36
    });

    positions.forEach(([x, z], index) => {
      const group = new THREE.Group();

      group.add(
        mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.7, 9),
          metal, x, 1.35, z),
        mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08),
          metal, x + 0.27, 2.55, z)
      );

      const bulb = mesh(
        new THREE.SphereGeometry(0.16, 12, 9),
        bulbMaterial.clone(),
        x + 0.58,
        2.46,
        z
      );

      const light = new THREE.PointLight(0xffbd68, 0, 9, 1.8);
      light.position.set(x + 0.58, 2.45, z);

      group.add(bulb, light);
      root.add(group);
      lamps.push({ light, bulb, index });
    });
  }

  function buildSeasonEffects() {
    snow = mesh(
      new THREE.CircleGeometry(48, 64),
      new THREE.MeshStandardMaterial({
        color: 0xf4f7f7,
        roughness: 0.96,
        transparent: true,
        opacity: 0,
        polygonOffset: true,
        polygonOffsetFactor: 6,
        polygonOffsetUnits: 6
      }),
      0,
      0.028,
      0,
      null,
      [-Math.PI / 2, 0, 0]
    );

    snow.castShadow = false;
    snow.renderOrder = -45;
    root.add(snow);

    const leafCount = 210;
    const leafPositions = new Float32Array(leafCount * 3);

    for (let index = 0; index < leafCount; index += 1) {
      leafPositions[index * 3] = -28 + Math.random() * 56;
      leafPositions[index * 3 + 1] = 1 + Math.random() * 12;
      leafPositions[index * 3 + 2] = -22 + Math.random() * 48;
    }

    const leafGeometry = new THREE.BufferGeometry();
    leafGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(leafPositions, 3)
    );

    leaves = new THREE.Points(
      leafGeometry,
      new THREE.PointsMaterial({
        color: 0xc06b32,
        size: 0.16,
        transparent: true,
        opacity: 0.88,
        depthWrite: false
      })
    );

    leaves.visible = false;
    root.add(leaves);

    const flowerCount = 140;
    const stems = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.014, 0.018, 0.27, 5),
      mat(0x46913d, 0.98),
      flowerCount
    );
    const petals = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.062, 7, 5),
      mat(0xf1bd64, 0.88),
      flowerCount
    );

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();

    for (let index = 0; index < flowerCount; index += 1) {
      const x = -29 + Math.random() * 58;
      const z = -20 + Math.random() * 44;
      const size = 0.65 + Math.random() * 0.9;

      position.set(x, 0.15, z);
      quaternion.setFromEuler(euler.set(0, Math.random() * Math.PI, 0));
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

    flowers = new THREE.Group();
    flowers.add(stems, petals);
    flowers.visible = false;
    root.add(flowers);

    for (let index = 0; index < 10; index += 1) {
      const bee = new THREE.Group();
      const yellow = mat(0xe2ad2f, 0.72);
      const black = mat(0x26201c, 0.78);
      const wing = new THREE.MeshStandardMaterial({
        color: 0xd9f3f5,
        transparent: true,
        opacity: 0.6,
        roughness: 0.25,
        side: THREE.DoubleSide
      });

      bee.add(
        mesh(new THREE.SphereGeometry(0.09, 9, 7),
          yellow, 0, 0, 0, [1, 0.75, 1.3]),
        mesh(new THREE.TorusGeometry(0.065, 0.018, 5, 12),
          black, 0, 0, 0.01, null, [Math.PI / 2, 0, 0]),
        mesh(new THREE.SphereGeometry(0.06, 8, 6),
          black, 0, 0, 0.12),
        mesh(new THREE.SphereGeometry(0.08, 8, 5),
          wing, -0.08, 0.07, -0.01, [1.3, 0.25, 0.75], [0.2, 0, -0.35]),
        mesh(new THREE.SphereGeometry(0.08, 8, 5),
          wing, 0.08, 0.07, -0.01, [1.3, 0.25, 0.75], [0.2, 0, 0.35])
      );

      bee.visible = false;
      root.add(bee);

      bees.push({
        group: bee,
        center: new THREE.Vector3(
          -10 + Math.random() * 20,
          0.8,
          5 + Math.random() * 12
        ),
        phase: Math.random() * Math.PI * 2,
        radius: 0.8 + Math.random() * 1.6,
        speed: 0.7 + Math.random() * 0.9
      });
    }

    for (let index = 0; index < 16; index += 1) {
      const ring = mesh(
        new THREE.RingGeometry(0.08, 0.11, 18),
        new THREE.MeshBasicMaterial({
          color: 0xbfe8ff,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false
        }),
        0,
        0.085,
        0,
        null,
        [-Math.PI / 2, 0, 0]
      );

      ring.visible = false;
      ring.userData.life = 0;
      ring.castShadow = false;
      root.add(ring);
      splashes.push(ring);
    }
  }

  function playThunder() {
    if (!L.audioUnlocked) return;

    const context = L.audio();
    if (!context) return;

    const duration = 1.8;
    const buffer = context.createBuffer(
      1,
      Math.floor(context.sampleRate * duration),
      context.sampleRate
    );
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      data[index] =
        (Math.random() * 2 - 1) *
        Math.exp(-index / data.length * 4.2);
    }

    const source = context.createBufferSource();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    const time = context.currentTime;

    source.buffer = buffer;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 320;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.32, time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(context.destination);
    source.start(time);
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
        mesh(new THREE.CylinderGeometry(1.28, 1.42, 5.5, 22),
          metal, x, 2.75, z),
        mesh(new THREE.ConeGeometry(1.48, 1.55, 22),
          roof, x, 6.28, z),
        mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.8, 8),
          darkMetal, x + 1.48, 2.7, z)
      );

      for (let level = 0; level < 7; level += 1) {
        root.add(mesh(
          new THREE.BoxGeometry(0.65, 0.06, 0.08),
          darkMetal,
          x + 1.48,
          0.65 + level * 0.62,
          z
        ));
      }
    });

    [
      [2.8, 5.3, 2.4],
      [8.1, 4.4, 2.6],
      [0, 15.3, 2.8],
      [-11.5, 15.2, 2.2],
      [3, -11.2, 2.4]
    ].forEach(([x, z, length]) => {
      const group = new THREE.Group();

      group.add(
        mesh(new THREE.BoxGeometry(length, 0.18, 0.62),
          wood, x, 0.28, z),
        mesh(new THREE.BoxGeometry(length, 0.58, 0.12),
          wood, x, 0.54, z - 0.32, null, [0.18, 0, 0]),
        mesh(new THREE.BoxGeometry(length, 0.58, 0.12),
          wood, x, 0.54, z + 0.32, null, [-0.18, 0, 0]),
        mesh(new THREE.BoxGeometry(0.15, 0.45, 0.72),
          wood, x - length / 2 + 0.08, 0.46, z),
        mesh(new THREE.BoxGeometry(0.15, 0.45, 0.72),
          wood, x + length / 2 - 0.08, 0.46, z)
      );

      root.add(group);
    });

    [
      [8.2, 0.52, 13.4],
      [9.35, 0.52, 13.4],
      [10.5, 0.52, 13.4],
      [8.78, 1.34, 13.4],
      [9.93, 1.34, 13.4],
      [9.35, 2.16, 13.4]
    ].forEach(([x, y, z]) => {
      root.add(mesh(
        new THREE.CylinderGeometry(0.52, 0.52, 0.75, 14),
        straw,
        x,
        y,
        z,
        null,
        [0, 0, Math.PI / 2]
      ));
    });
  }

  function update(delta, time) {
    const season = L.season();
    const weather = L.weather();
    const night = L.isNight();

    lamps.forEach((lamp, index) => {
      const target = night ? 1.05 : 0;

      lamp.light.intensity +=
        (target - lamp.light.intensity) *
        Math.min(1, delta * 3.2);

      lamp.bulb.material.emissiveIntensity =
        lamp.light.intensity > 0.1
          ? 1.5 + Math.sin(time * 2 + index) * 0.08
          : 0;
    });

    if (typeof sun !== 'undefined' && sun) {
      const target = night ? 0.12 : 1.15;
      sun.intensity +=
        (target - sun.intensity) *
        Math.min(1, delta * 1.8);
    }

    if (typeof hemi !== 'undefined' && hemi) {
      const target = night ? 0.22 : 0.65;
      hemi.intensity +=
        (target - hemi.intensity) *
        Math.min(1, delta * 1.8);
    }

    const snowTarget =
      season === 'winter'
        ? weather === 'snow' ? 0.84 : 0.62
        : 0;

    snow.material.opacity +=
      (snowTarget - snow.material.opacity) *
      Math.min(1, delta * 0.45);

    snow.visible = snow.material.opacity > 0.02;

    leaves.visible = season === 'autumn';

    if (leaves.visible) {
      const positions = leaves.geometry.attributes.position.array;

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

      leaves.geometry.attributes.position.needsUpdate = true;
    }

    flowers.visible = season === 'spring';

    bees.forEach(bee => {
      bee.group.visible = season === 'spring';
      if (!bee.group.visible) return;

      const angle = time * bee.speed + bee.phase;

      bee.group.position.set(
        bee.center.x + Math.cos(angle) * bee.radius,
        bee.center.y + Math.sin(time * 2.1 + bee.phase) * 0.25,
        bee.center.z + Math.sin(angle) * bee.radius * 0.7
      );

      bee.group.rotation.y = -angle + Math.PI / 2;
    });

    if (groundMaterial && groundBase) {
      const target =
        season === 'spring'
          ? new THREE.Color(0x4f9d46)
          : groundBase;

      groundMaterial.color.lerp(target, Math.min(1, delta * 0.35));
    }

    if (weather === 'rain') {
      splashTimer -= delta;

      if (splashTimer <= 0) {
        splashTimer = 0.05 + Math.random() * 0.09;
        const available = splashes.find(ring => !ring.visible);

        if (available) {
          available.visible = true;
          available.userData.life = 0.55;
          available.position.set(
            -28 + Math.random() * 56,
            0.085,
            -22 + Math.random() * 48
          );
          available.scale.setScalar(0.35);
          available.material.opacity = 0.72;
        }
      }

      thunderTimer -= delta;

      if (thunderTimer <= 0) {
        thunderTimer = 16 + Math.random() * 22;
        lightningTimer = 0.26;
        playThunder();
      }
    }

    splashes.forEach(ring => {
      if (!ring.visible) return;

      ring.userData.life -= delta;
      ring.scale.multiplyScalar(1 + delta * 3.2);
      ring.material.opacity = Math.max(0, ring.userData.life * 1.3);

      if (ring.userData.life <= 0) {
        ring.visible = false;
        ring.scale.setScalar(1);
      }
    });

    if (lightningTimer > 0) {
      lightningTimer -= delta;
      lightning.intensity = lightningTimer > 0.13 ? 9 : 3.5;
    } else {
      lightning.intensity = 0;
    }
  }

  findGround();
  buildLamps();
  buildSeasonEffects();
  buildFarmDetails();
  L.addUpdate(update);
})();