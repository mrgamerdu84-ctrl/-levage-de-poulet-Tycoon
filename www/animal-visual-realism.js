'use strict';
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  const VERSION_FLAG = 'animalVisualRealismV1';
  const WHITE = new THREE.Color(0xffffff);
  const BLACK = new THREE.Color(0x17120f);

  function material(color, roughness = 0.88, metalness = 0) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: false
    });
  }

  function mesh(geometry, mat, position, scale, rotation) {
    const item = new THREE.Mesh(geometry, mat);
    item.position.set(position[0], position[1], position[2]);
    if (scale) item.scale.set(scale[0], scale[1], scale[2]);
    if (rotation) item.rotation.set(rotation[0], rotation[1], rotation[2]);
    item.castShadow = true;
    item.receiveShadow = true;
    item.userData.visualDetailOnly = true;
    return item;
  }

  function firstColor(group, fallback) {
    let color = null;
    group.traverse(object => {
      if (color || !object.isMesh || !object.material) return;
      const source = Array.isArray(object.material) ? object.material[0] : object.material;
      if (source && source.color) color = source.color.clone();
    });
    return color || new THREE.Color(fallback);
  }

  function seeded(group, salt = 0) {
    const value = Math.sin((group.id + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function tint(base, toward, amount) {
    return base.clone().lerp(toward, amount).getHex();
  }

  function darken(base, amount) {
    return base.clone().lerp(BLACK, amount).getHex();
  }

  function enhanceBird(group, bird) {
    if (!group || group.userData[VERSION_FLAG]) return;
    group.userData[VERSION_FLAG] = true;

    const isRooster = bird.role === 'rooster';
    const base = firstColor(group, isRooster ? 0x332f25 : 0xb5824a);
    const light = material(tint(base, WHITE, 0.28), 0.93);
    const mid = material(tint(base, WHITE, 0.08), 0.9);
    const dark = material(darken(base, isRooster ? 0.46 : 0.32), 0.86);
    const warm = material(isRooster ? 0x9b3c26 : tint(base, new THREE.Color(0xc56f35), 0.22), 0.9);
    const red = material(isRooster ? 0xd62d2d : 0xc94238, 0.62);
    const beak = material(0xe3a43a, 0.58);
    const leg = material(0xd68d2a, 0.68);

    const details = new THREE.Group();
    details.name = 'visual-bird-details';
    details.userData.visualDetailOnly = true;

    // Poitrine plus fine et plumeuse.
    [
      [-0.12, 0.52, 0.36, 0.12, 0.06, 0.19, -0.08],
      [0.12, 0.52, 0.36, 0.12, 0.06, 0.19, 0.08],
      [-0.08, 0.63, 0.33, 0.11, 0.055, 0.17, -0.05],
      [0.08, 0.63, 0.33, 0.11, 0.055, 0.17, 0.05],
      [0, 0.72, 0.3, 0.13, 0.06, 0.18, 0]
    ].forEach((p, index) => {
      details.add(mesh(
        new THREE.SphereGeometry(1, 10, 7),
        index < 2 ? warm : light,
        [p[0], p[1], p[2]],
        [p[3], p[4], p[5]],
        [p[6], 0, 0]
      ));
    });

    // Ailes composées de plusieurs rangées de plumes fines.
    [-1, 1].forEach(side => {
      for (let row = 0; row < 3; row += 1) {
        for (let index = 0; index < 3; index += 1) {
          const feather = mesh(
            new THREE.SphereGeometry(1, 9, 6),
            row === 0 ? mid : dark,
            [
              side * (0.37 + row * 0.018),
              0.61 - row * 0.085,
              0.12 - index * 0.17 - row * 0.03
            ],
            [0.07 + row * 0.008, 0.035, 0.19 - row * 0.018],
            [0.12 + index * 0.035, side * 0.24, side * (0.1 + row * 0.04)]
          );
          details.add(feather);
        }
      }
    });

    // Queue plus naturelle, plus longue pour le coq.
    const tailCount = isRooster ? 7 : 5;
    for (let index = 0; index < tailCount; index += 1) {
      const centered = index - (tailCount - 1) / 2;
      const length = (isRooster ? 0.62 : 0.38) - Math.abs(centered) * 0.035;
      const tailColor = isRooster && index % 2 === 0
        ? material(index % 4 === 0 ? 0x174c3c : 0x203e58, 0.72, 0.08)
        : dark;
      const feather = mesh(
        new THREE.ConeGeometry(isRooster ? 0.055 : 0.05, length, 7),
        tailColor,
        [centered * 0.06, 0.73 + Math.abs(centered) * 0.025, -0.52],
        [1, 1, 1],
        [-1.2 - Math.abs(centered) * 0.055, 0, centered * 0.13]
      );
      details.add(feather);
    }

    // Doigts fins au lieu d'un seul pied rectangulaire.
    [-1, 1].forEach(side => {
      [-0.055, 0, 0.055].forEach((spread, index) => {
        details.add(mesh(
          new THREE.CylinderGeometry(0.012, 0.017, 0.18, 6),
          leg,
          [side * 0.13 + spread, 0.018, 0.08 + index * 0.015],
          [1, 1, 1],
          [Math.PI / 2.25, 0, spread * 5]
        ));
      });
    });

    group.add(details);

    if (bird.head && !bird.head.userData[VERSION_FLAG]) {
      bird.head.userData[VERSION_FLAG] = true;
      const headDetails = new THREE.Group();
      headDetails.name = 'visual-bird-head-details';
      headDetails.userData.visualDetailOnly = true;

      // Crête souple en lobes successifs.
      const lobes = isRooster ? 5 : 4;
      for (let index = 0; index < lobes; index += 1) {
        const z = -0.09 + index * (0.18 / Math.max(1, lobes - 1));
        const height = (isRooster ? 0.11 : 0.075) * (1 - Math.abs(index - (lobes - 1) / 2) * 0.08);
        headDetails.add(mesh(
          new THREE.SphereGeometry(1, 9, 7),
          red,
          [0, 0.19 + height * 0.34, z],
          [0.055 + height * 0.12, height, 0.055],
          [0, 0, 0]
        ));
      }

      // Bec en deux parties, plus proche d'un vrai bec.
      headDetails.add(mesh(
        new THREE.ConeGeometry(0.058, 0.16, 8),
        beak,
        [0, 0.005, 0.225],
        [1, 1, 0.92],
        [Math.PI / 2, 0, 0]
      ));
      headDetails.add(mesh(
        new THREE.ConeGeometry(0.045, 0.12, 8),
        beak,
        [0, -0.035, 0.205],
        [1, 1, 0.85],
        [Math.PI / 2 + 0.16, 0, 0]
      ));

      // Barbillon double, surtout visible sur le coq.
      [-1, 1].forEach(side => {
        headDetails.add(mesh(
          new THREE.SphereGeometry(1, 8, 6),
          red,
          [side * 0.035, -0.15, 0.16],
          [isRooster ? 0.05 : 0.035, isRooster ? 0.09 : 0.06, 0.035],
          [0, 0, side * 0.15]
        ));
      });

      bird.head.add(headDetails);
    }
  }

  function enhanceCow(group) {
    if (!group || group.userData[VERSION_FLAG]) return;
    group.userData[VERSION_FLAG] = true;

    const coat = firstColor(group, 0xeee4d2);
    const isLight = coat.r + coat.g + coat.b > 1.65;
    const coatMat = material(tint(coat, WHITE, 0.08), 0.92);
    const patchMat = material(isLight ? 0x49342d : 0xe4d2b7, 0.88);
    const muzzleMat = material(0xd6a18d, 0.74);
    const hoofMat = material(0x2f251f, 0.92);

    const details = new THREE.Group();
    details.name = 'visual-cow-details';
    details.userData.visualDetailOnly = true;

    // Épaules et hanches plus anatomiques.
    details.add(mesh(new THREE.SphereGeometry(1, 12, 9), coatMat, [0, 0.92, 0.62], [0.48, 0.46, 0.48]));
    details.add(mesh(new THREE.SphereGeometry(1, 12, 9), coatMat, [0, 0.92, -0.64], [0.5, 0.47, 0.5]));

    // Taches distinctes visibles dans la vue en plongée et sur les flancs.
    const patches = [
      [-0.46, 1.02, -0.35, 0.12, 0.3, 0.38, 0.28],
      [0.47, 0.92, 0.18, 0.12, 0.27, 0.32, -0.22],
      [-0.28, 1.38, 0.12, 0.28, 0.055, 0.34, 0.15],
      [0.23, 1.4, -0.42, 0.25, 0.05, 0.3, -0.18],
      [0.43, 1.06, -0.58, 0.1, 0.25, 0.26, 0.34]
    ];
    patches.forEach(p => {
      details.add(mesh(
        new THREE.SphereGeometry(1, 10, 7),
        patchMat,
        [p[0], p[1], p[2]],
        [p[3], p[4], p[5]],
        [0, 0, p[6]]
      ));
    });

    // Fanon, naseaux et sabots fendus.
    details.add(mesh(new THREE.SphereGeometry(1, 10, 7), muzzleMat, [0, 0.79, 0.93], [0.18, 0.28, 0.18], [0.2, 0, 0]));
    [-1, 1].forEach(side => {
      details.add(mesh(new THREE.SphereGeometry(1, 8, 6), hoofMat, [side * 0.06, 1.03, 1.51], [0.022, 0.014, 0.016]));
    });

    const legPositions = [
      [-0.32, -0.46], [0.32, -0.46], [-0.32, 0.45], [0.32, 0.45]
    ];
    legPositions.forEach(([x, z]) => {
      [-0.035, 0.035].forEach(offset => {
        details.add(mesh(
          new THREE.SphereGeometry(1, 8, 6),
          hoofMat,
          [x + offset, 0.055, z + 0.035],
          [0.055, 0.035, 0.09]
        ));
      });
    });

    group.add(details);
  }

  function enhanceSheep(group) {
    if (!group || group.userData[VERSION_FLAG]) return;
    group.userData[VERSION_FLAG] = true;

    const woolBase = firstColor(group, 0xf3ebdd);
    const woolLight = material(tint(woolBase, WHITE, 0.16), 0.98);
    const woolShade = material(darken(woolBase, 0.08), 0.97);
    const face = material(0x51443c, 0.92);

    const details = new THREE.Group();
    details.name = 'visual-sheep-details';
    details.userData.visualDetailOnly = true;

    // Boucles de laine irrégulières sur le dos, les flancs et le cou.
    for (let index = 0; index < 28; index += 1) {
      const angle = seeded(group, index) * Math.PI * 2;
      const along = seeded(group, index + 50) * 2 - 1;
      const radius = 0.5 + seeded(group, index + 90) * 0.12;
      const x = Math.cos(angle) * radius * 0.92;
      const y = 0.74 + Math.abs(Math.sin(angle)) * 0.28 + seeded(group, index + 130) * 0.12;
      const z = along * 0.63;
      const size = 0.105 + seeded(group, index + 170) * 0.055;
      details.add(mesh(
        new THREE.SphereGeometry(1, 9, 7),
        index % 3 === 0 ? woolShade : woolLight,
        [x, y, z],
        [size * 1.08, size, size * 1.12]
      ));
    }

    // Bonnet laineux autour du front.
    [-0.15, 0, 0.15].forEach((x, index) => {
      details.add(mesh(
        new THREE.SphereGeometry(1, 9, 7),
        index === 1 ? woolLight : woolShade,
        [x, 1.08 - Math.abs(x) * 0.15, 0.57],
        [0.14, 0.13, 0.13]
      ));
    });

    // Oreilles plus fines et museau légèrement allongé.
    [-1, 1].forEach(side => {
      details.add(mesh(
        new THREE.SphereGeometry(1, 9, 6),
        face,
        [side * 0.31, 0.92, 0.7],
        [0.18, 0.055, 0.09],
        [0, 0, side * 0.28]
      ));
    });
    details.add(mesh(new THREE.SphereGeometry(1, 10, 7), face, [0, 0.78, 0.83], [0.18, 0.13, 0.19]));

    group.add(details);
  }

  function enhanceDuck(group) {
    if (!group || group.userData[VERSION_FLAG]) return;
    group.userData[VERSION_FLAG] = true;

    const plumage = firstColor(group, 0x9a704b);
    const light = material(tint(plumage, WHITE, 0.22), 0.92);
    const mid = material(tint(plumage, WHITE, 0.06), 0.9);
    const dark = material(darken(plumage, 0.28), 0.88);
    const beak = material(0xe5a03a, 0.64);
    const foot = material(0xde8e2d, 0.72);

    const details = new THREE.Group();
    details.name = 'visual-duck-details';
    details.userData.visualDetailOnly = true;

    // Poitrine, dos et cou pour une silhouette d'oiseau aquatique.
    details.add(mesh(new THREE.SphereGeometry(1, 12, 9), light, [0, 0.34, 0.25], [0.25, 0.25, 0.31]));
    details.add(mesh(new THREE.SphereGeometry(1, 12, 9), mid, [0, 0.42, -0.12], [0.31, 0.2, 0.44], [-0.1, 0, 0]));
    details.add(mesh(new THREE.SphereGeometry(1, 11, 8), mid, [0, 0.54, 0.25], [0.16, 0.22, 0.16], [-0.2, 0, 0]));

    // Ailes avec plusieurs rémiges superposées.
    [-1, 1].forEach(side => {
      for (let index = 0; index < 4; index += 1) {
        details.add(mesh(
          new THREE.SphereGeometry(1, 9, 6),
          index < 2 ? dark : mid,
          [side * 0.29, 0.39 - index * 0.018, 0.06 - index * 0.13],
          [0.065, 0.035, 0.18 - index * 0.012],
          [0.08, side * 0.22, side * (0.08 + index * 0.025)]
        ));
      }
    });

    // Queue courte en éventail.
    [-1, 0, 1].forEach(index => {
      details.add(mesh(
        new THREE.ConeGeometry(0.045, 0.23, 6),
        dark,
        [index * 0.055, 0.42 + Math.abs(index) * 0.015, -0.39],
        [1, 1, 1],
        [-1.23, 0, index * 0.18]
      ));
    });

    // Bec aplati en deux parties.
    details.add(mesh(new THREE.SphereGeometry(1, 10, 7), beak, [0, 0.57, 0.5], [0.16, 0.045, 0.17]));
    details.add(mesh(new THREE.SphereGeometry(1, 10, 7), beak, [0, 0.535, 0.5], [0.145, 0.035, 0.15]));
    details.add(mesh(new THREE.SphereGeometry(1, 7, 5), dark, [-0.045, 0.585, 0.64], [0.012, 0.008, 0.009]));
    details.add(mesh(new THREE.SphereGeometry(1, 7, 5), dark, [0.045, 0.585, 0.64], [0.012, 0.008, 0.009]));

    // Pattes palmées lisibles depuis le dessus.
    [-0.09, 0.09].forEach(x => {
      details.add(mesh(new THREE.SphereGeometry(1, 8, 6), foot, [x, 0.035, 0.07], [0.12, 0.022, 0.12]));
    });

    group.add(details);
  }

  function inspect(object) {
    if (!object || !object.isGroup || !object.userData) return;

    if (object.userData.bird) {
      enhanceBird(object, object.userData.bird);
      return;
    }

    const farmAnimal = object.userData.farmAnimal;
    if (!farmAnimal || !farmAnimal.type) return;

    if (farmAnimal.type === 'cow') enhanceCow(object);
    else if (farmAnimal.type === 'sheep') enhanceSheep(object);
    else if (farmAnimal.type === 'duck') enhanceDuck(object);
  }

  function scan() {
    scene.traverse(inspect);
  }

  scan();
  window.setInterval(scan, 900);
})();
