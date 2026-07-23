'use strict';

// Remplace uniquement l'ancienne vache cubique par une vache arrondie
// dans le même esprit low-poly chaleureux que les poules existantes.
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const approx = (a, b, epsilon = 0.03) => Math.abs(a - b) <= epsilon;
  const makeMat = (color, roughness = 0.82) => new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    flatShading: false
  });

  function isLegacyCow(group) {
    if (!group || !group.isGroup || group.userData.cowStyleFixed) return false;

    let legacyBody = false;
    let legacyHead = false;
    let legacyLegs = 0;

    group.children.forEach(child => {
      const geometry = child.geometry;
      const p = geometry && geometry.parameters;
      if (!p) return;

      if (geometry.type === 'BoxGeometry') {
        if (approx(p.width, 1.55) && approx(p.height, 0.85) && approx(p.depth, 0.72)) legacyBody = true;
        if (approx(p.width, 0.58) && approx(p.height, 0.58) && approx(p.depth, 0.52)) legacyHead = true;
      }

      if (geometry.type === 'CylinderGeometry' && approx(p.height, 0.72)) legacyLegs += 1;
    });

    return legacyBody && legacyHead && legacyLegs >= 4;
  }

  function mesh(geometry, material, position, scale, rotation) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(position[0], position[1], position[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) m.rotation.set(rotation[0], rotation[1], rotation[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function restyleCow(group) {
    if (!isLegacyCow(group)) return false;

    while (group.children.length) group.remove(group.children[group.children.length - 1]);

    const variant = Array.from(group.uuid).reduce((n, c) => n + c.charCodeAt(0), 0) % 2;
    const coat = makeMat(variant ? 0xF1E8D7 : 0xEDE4D4);
    const patch = makeMat(variant ? 0x6A4633 : 0x3F352F);
    const muzzle = makeMat(0xD9AA91, 0.72);
    const horn = makeMat(0xE8D6AA, 0.72);
    const hoof = makeMat(0x342820, 0.88);
    const eyeWhite = makeMat(0xFFFDF6, 0.35);
    const pupil = makeMat(0x17120F, 0.25);
    const udder = makeMat(0xDDAE9D, 0.75);

    const body = mesh(
      new THREE.SphereGeometry(0.72, 12, 9), coat,
      [0, 0.9, 0], [0.82, 0.72, 1.42]
    );
    group.add(body);

    const chest = mesh(
      new THREE.SphereGeometry(0.5, 11, 8), coat,
      [0, 0.96, 0.62], [0.9, 0.95, 0.85]
    );
    group.add(chest);

    const neck = mesh(
      new THREE.SphereGeometry(0.4, 10, 8), coat,
      [0, 1.08, 0.88], [0.82, 1.05, 0.78], [-0.16, 0, 0]
    );
    group.add(neck);

    const head = mesh(
      new THREE.SphereGeometry(0.39, 11, 9), coat,
      [0, 1.17, 1.2], [0.9, 0.82, 1.02]
    );
    group.add(head);

    const nose = mesh(
      new THREE.SphereGeometry(0.27, 10, 8), muzzle,
      [0, 1.03, 1.51], [1.08, 0.64, 0.82]
    );
    group.add(nose);

    // Taches visibles depuis la caméra en plongée.
    [[-0.22, 1.43, -0.27, 0.34, 0.08, 0.44],
     [0.24, 1.44, 0.2, 0.27, 0.075, 0.34],
     [-0.08, 1.4, 0.62, 0.22, 0.065, 0.28]].forEach(p => {
      group.add(mesh(new THREE.SphereGeometry(1, 9, 7), patch, [p[0], p[1], p[2]], [p[3], p[4], p[5]]));
    });

    // Oreilles, cornes et visage lisible comme sur les poules.
    [-1, 1].forEach(side => {
      group.add(mesh(
        new THREE.SphereGeometry(0.15, 9, 7), patch,
        [side * 0.34, 1.31, 1.17], [1.15, 0.38, 0.76], [0, 0, side * 0.24]
      ));

      group.add(mesh(
        new THREE.ConeGeometry(0.065, 0.28, 7), horn,
        [side * 0.24, 1.49, 1.18], [1, 1, 1], [0, 0, side * 0.72]
      ));

      group.add(mesh(
        new THREE.SphereGeometry(0.052, 9, 7), eyeWhite,
        [side * 0.18, 1.22, 1.53], [1, 1, 0.72]
      ));
      group.add(mesh(
        new THREE.SphereGeometry(0.027, 8, 6), pupil,
        [side * 0.18, 1.22, 1.568], [1, 1, 0.7]
      ));
      group.add(mesh(
        new THREE.SphereGeometry(0.022, 7, 5), pupil,
        [side * 0.09, 1.06, 1.705], [1, 0.72, 0.48]
      ));
    });

    const legs = [];
    [[-0.35, -0.52], [0.35, -0.52], [-0.35, 0.48], [0.35, 0.48]].forEach(([x, z]) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x, 0.62, z);

      const upper = mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.52, 7), coat, [0, -0.22, 0]);
      const lower = mesh(new THREE.CylinderGeometry(0.072, 0.088, 0.34, 7), patch, [0, -0.62, 0]);
      const foot = mesh(new THREE.SphereGeometry(0.11, 8, 6), hoof, [0, -0.82, 0.035], [1, 0.62, 1.28]);
      legGroup.add(upper, lower, foot);
      group.add(legGroup);
      legs.push(legGroup);
    });

    const udderMesh = mesh(
      new THREE.SphereGeometry(0.24, 9, 7), udder,
      [0, 0.42, 0.14], [1.05, 0.6, 0.88]
    );
    group.add(udderMesh);

    [-0.11, 0.11].forEach(x => {
      group.add(mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 6), udder, [x, 0.29, 0.14]));
    });

    const tail = new THREE.Group();
    tail.position.set(0, 1.03, -1.03);
    const tailStem = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.58, 7), patch, [0, -0.22, -0.06], null, [0.55, 0, 0]);
    const tailTip = mesh(new THREE.SphereGeometry(0.095, 8, 6), patch, [0, -0.49, -0.22], [0.8, 1.25, 0.8]);
    tail.add(tailStem, tailTip);
    group.add(tail);

    group.userData.cowStyleFixed = true;
    group.userData.cowLegs = legs;
    group.userData.cowTail = tail;
    group.userData.cowLastPosition = group.position.clone();
    group.userData.cowWalkPhase = Math.random() * Math.PI * 2;
    return true;
  }

  function scan(objects = scene.children) {
    objects.forEach(object => {
      restyleCow(object);
      if (object.children && object.children.length) scan(object.children);
    });
  }

  scan();

  // Les prochaines vaches achetées sont corrigées dès leur ajout à la scène.
  const originalAdd = scene.add.bind(scene);
  scene.add = (...objects) => {
    const result = originalAdd(...objects);
    objects.forEach(object => restyleCow(object));
    return result;
  };

  const clock = new THREE.Clock();
  function animateCowDetails() {
    const dt = Math.min(clock.getDelta(), 0.05);
    scene.children.forEach(group => {
      if (!group.userData || !group.userData.cowStyleFixed) return;

      const data = group.userData;
      const last = data.cowLastPosition;
      const moved = Math.hypot(group.position.x - last.x, group.position.z - last.z);
      const walking = moved > 0.0008;
      data.cowWalkPhase += dt * (walking ? 7 : 2.2);

      data.cowLegs.forEach((leg, index) => {
        const direction = index % 2 === 0 ? 1 : -1;
        leg.rotation.x = walking ? Math.sin(data.cowWalkPhase) * 0.28 * direction : 0;
      });

      data.cowTail.rotation.z = Math.sin(data.cowWalkPhase * 0.65) * 0.16;
      last.copy(group.position);
    });

    requestAnimationFrame(animateCowDetails);
  }
  requestAnimationFrame(animateCowDetails);
})();
