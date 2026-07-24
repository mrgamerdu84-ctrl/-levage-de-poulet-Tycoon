'use strict';

(() => {
  if (
    typeof THREE === 'undefined' ||
    typeof scene === 'undefined' ||
    !window.FarmStructureV2
  ) return;

  const F = window.FarmStructureV2;
  const ROOT_NAME = 'farm-brick-mountain-fix-v1';

  const oldRoot = scene.getObjectByName(ROOT_NAME);
  if (oldRoot && oldRoot.parent) oldRoot.parent.remove(oldRoot);

  const root = new THREE.Group();
  root.name = ROOT_NAME;
  scene.add(root);

  const world = new THREE.Vector3();
  const temp = new THREE.Vector3();

  const brickPalettes = {
    house: { brick:'#a85e44', brickLight:'#c67b5f', brickDark:'#7f4132', mortar:'#d8c9b4', foundation:0x766b60, roof:'#9f4a32' },
    coop: { brick:'#a64f3d', brickLight:'#c2674e', brickDark:'#783427', mortar:'#d6c4ad', foundation:0x665c52, roof:'#893b2d' },
    barn: { brick:'#984132', brickLight:'#b95843', brickDark:'#6f2d25', mortar:'#d0bca6', foundation:0x625950, roof:'#7e3429' },
    store: { brick:'#a87956', brickLight:'#c49872', brickDark:'#80593f', mortar:'#ddd0bd', foundation:0x71695e, roof:'#765044' }
  };

  function mat(color, roughness = 0.9, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading:false });
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

  function makeBrickTexture(palette) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = palette.mortar;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const brickWidth = 62;
    const brickHeight = 29;
    const mortar = 3;

    for (let row = 0; row < 10; row += 1) {
      const offset = row % 2 ? -brickWidth / 2 : 0;
      for (let column = -1; column < 10; column += 1) {
        const x = column * brickWidth + offset + mortar;
        const y = row * brickHeight + mortar;
        const random = Math.random();
        context.fillStyle = random < 0.2 ? palette.brickLight : random > 0.8 ? palette.brickDark : palette.brick;
        context.fillRect(x, y, brickWidth - mortar * 2, brickHeight - mortar * 2);
        context.fillStyle = 'rgba(255,255,255,.08)';
        context.fillRect(x + 2, y + 2, brickWidth - mortar * 2 - 4, 3);
        context.fillStyle = 'rgba(50,25,15,.09)';
        context.fillRect(x + 2, y + brickHeight - mortar * 2 - 4, brickWidth - mortar * 2 - 4, 3);
      }
    }

    for (let index = 0; index < 600; index += 1) {
      context.fillStyle = `rgba(65,32,20,${0.02 + Math.random() * 0.07})`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.4, 2.2);
    if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function makeRoofTexture(baseColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = baseColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const tileWidth = 52;
    const tileHeight = 29;
    for (let row = 0; row < 10; row += 1) {
      const offset = row % 2 ? tileWidth / 2 : 0;
      for (let column = -1; column < 12; column += 1) {
        const x = column * tileWidth - offset;
        const y = row * tileHeight;
        context.strokeStyle = 'rgba(71,28,22,.34)';
        context.lineWidth = 3;
        context.strokeRect(x, y, tileWidth, tileHeight);
        context.fillStyle = 'rgba(255,190,140,.07)';
        context.fillRect(x + 3, y + 3, tileWidth - 6, 4);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function brickMaterial(palette) {
    const texture = makeBrickTexture(palette);
    return new THREE.MeshStandardMaterial({
      map:texture,
      bumpMap:texture,
      bumpScale:0.045,
      roughness:0.92,
      metalness:0,
      flatShading:false
    });
  }

  function panel(group, width, height, depth, x, y, z, material) {
    const object = mesh(new THREE.BoxGeometry(width, height, depth), material, x, y, z);
    group.add(object);
    return object;
  }

  function windowUnit(group, x, y, z, front) {
    const trim = mat(0xf0e6d4, 0.9);
    const wood = mat(0x5e3d2b, 0.94);
    const glass = new THREE.MeshStandardMaterial({ color:0x85bed4, roughness:0.18, metalness:0.08, transparent:true, opacity:0.84 });
    const frame = panel(group, 1.55, 1.45, 0.1, x, y, z, trim);
    frame.position.z += front * 0.02;
    const pane = panel(group, 1.25, 1.15, 0.08, x, y, z + front * 0.08, glass);
    pane.castShadow = false;
    panel(group, 0.08, 1.15, 0.11, x, y, z + front * 0.13, trim);
    panel(group, 1.25, 0.08, 0.11, x, y, z + front * 0.13, trim);
    panel(group, 0.28, 1.45, 0.09, x - 0.96, y, z + front * 0.1, wood);
    panel(group, 0.28, 1.45, 0.09, x + 0.96, y, z + front * 0.1, wood);
  }

  function addBrickFacade(id, structure) {
    const palette = brickPalettes[id];
    if (!palette) return;

    const group = new THREE.Group();
    group.name = `${id}-real-brick-facade`;
    const bricks = brickMaterial(palette);
    const foundation = mat(palette.foundation, 0.98);
    const corner = mat(0xc9b69f, 0.94);
    const front = structure.front;
    const doorWidth = structure.door.half * 2;
    const doorHeight = id === 'barn' || id === 'store' ? 3.15 : 2.45;
    const frontZ = structure.z + front * (structure.d / 2 + 0.13);
    const backZ = structure.z - front * (structure.d / 2 + 0.13);
    const sideWidth = (structure.w - doorWidth) / 2;

    panel(group, sideWidth, structure.h, 0.12, structure.x - doorWidth / 2 - sideWidth / 2, structure.h / 2, frontZ, bricks);
    panel(group, sideWidth, structure.h, 0.12, structure.x + doorWidth / 2 + sideWidth / 2, structure.h / 2, frontZ, bricks);
    panel(group, doorWidth, Math.max(0.25, structure.h - doorHeight), 0.12, structure.x, doorHeight + (structure.h - doorHeight) / 2, frontZ, bricks);
    panel(group, structure.w, structure.h, 0.12, structure.x, structure.h / 2, backZ, bricks);
    panel(group, 0.12, structure.h, structure.d, structure.x - structure.w / 2 - 0.13, structure.h / 2, structure.z, bricks);
    panel(group, 0.12, structure.h, structure.d, structure.x + structure.w / 2 + 0.13, structure.h / 2, structure.z, bricks);
    panel(group, structure.w + 0.32, 0.55, 0.18, structure.x, 0.28, frontZ + front * 0.01, foundation);
    panel(group, structure.w + 0.32, 0.55, 0.18, structure.x, 0.28, backZ - front * 0.01, foundation);

    const corners = [
      [structure.x - structure.w / 2 - 0.14, structure.z - structure.d / 2 - 0.14],
      [structure.x + structure.w / 2 + 0.14, structure.z - structure.d / 2 - 0.14],
      [structure.x - structure.w / 2 - 0.14, structure.z + structure.d / 2 + 0.14],
      [structure.x + structure.w / 2 + 0.14, structure.z + structure.d / 2 + 0.14]
    ];

    corners.forEach(([x, z]) => {
      for (let level = 0; level < Math.ceil(structure.h / 0.55); level += 1) {
        panel(group, 0.34, 0.46, 0.34, x, 0.28 + level * 0.55, z, corner);
      }
    });

    if (id === 'house') {
      windowUnit(group, structure.x - 2.25, 2.1, frontZ + front * 0.02, front);
      windowUnit(group, structure.x + 2.25, 2.1, frontZ + front * 0.02, front);
    } else if (id === 'coop') {
      windowUnit(group, structure.x - 2.45, 2.1, frontZ + front * 0.02, front);
      windowUnit(group, structure.x + 2.45, 2.1, frontZ + front * 0.02, front);
    } else if (id === 'store') {
      windowUnit(group, structure.x - 3.2, 2.25, frontZ + front * 0.02, front);
      windowUnit(group, structure.x + 3.2, 2.25, frontZ + front * 0.02, front);
    } else if (id === 'barn') {
      const trim = mat(0xf0e6d4, 0.9);
      const dark = mat(0x2f251f, 1);
      panel(group, 2.0, 1.35, 0.12, structure.x, 4.0, frontZ + front * 0.04, trim);
      panel(group, 1.68, 1.05, 0.08, structure.x, 4.0, frontZ + front * 0.11, dark);
    }

    root.add(group);

    const roofTexture = makeRoofTexture(palette.roof);
    const roofMaterial = new THREE.MeshStandardMaterial({ map:roofTexture, roughness:0.9, metalness:0, flatShading:false });

    scene.traverse(object => {
      if (!object.isMesh || !object.geometry) return;
      object.getWorldPosition(world);
      if (
        Math.abs(world.x - structure.x) > structure.w / 2 + 1.8 ||
        Math.abs(world.z - structure.z) > structure.d / 2 + 1.8 ||
        world.y < structure.h - 0.1 ||
        world.y > structure.h + 5
      ) return;

      const parameters = object.geometry.parameters || {};
      const wideRoof = object.geometry.type === 'ConeGeometry' || (
        object.geometry.type === 'BoxGeometry' &&
        Math.max(Number(parameters.width || 0), Number(parameters.depth || 0)) > 3
      );
      if (wideRoof) object.material = roofMaterial.clone();
    });
  }

  function relocateHayBales() {
    const bales = [];
    scene.traverse(object => {
      if (!object.isMesh || !object.geometry || object.geometry.type !== 'CylinderGeometry') return;
      const parameters = object.geometry.parameters || {};
      const radius = Number(parameters.radiusTop || 0);
      const height = Number(parameters.height || 0);
      object.getWorldPosition(world);
      if (radius > 0.45 && radius < 0.6 && height > 0.65 && height < 0.86 && world.x > 10.5 && world.x < 16.5 && world.z > -8 && world.z < -5) bales.push(object);
    });

    const targets = [
      [-25.2,0.52,-14.8],[-24.05,0.52,-14.8],[-22.9,0.52,-14.8],
      [-25.2,1.34,-14.8],[-24.05,1.34,-14.8],[-22.9,1.34,-14.8]
    ];

    bales.forEach((bale, index) => {
      const target = targets[index % targets.length];
      temp.set(target[0], target[1], target[2]);
      if (bale.parent && bale.parent !== scene) bale.parent.worldToLocal(temp);
      bale.position.copy(temp);
    });

    const shed = new THREE.Group();
    shed.name = 'hay-storage-shed';
    const wood = mat(0x684830, 0.96);
    const roof = mat(0x81503a, 0.92);
    const stone = mat(0x746b60, 0.98);
    panel(shed, 4.9, 0.24, 3.0, -24.05, 3.05, -14.7, roof);
    panel(shed, 0.22, 3.0, 0.22, -26.1, 1.5, -13.6, wood);
    panel(shed, 0.22, 3.0, 0.22, -22.0, 1.5, -13.6, wood);
    panel(shed, 0.22, 3.0, 0.22, -26.1, 1.5, -15.85, wood);
    panel(shed, 0.22, 3.0, 0.22, -22.0, 1.5, -15.85, wood);
    panel(shed, 4.8, 0.18, 2.7, -24.05, 0.09, -14.7, stone);
    root.add(shed);
  }

  function relocateDockCrates() {
    const found = [];
    scene.traverse(object => {
      if (!object.isGroup || object === root) return;
      const boxChild = object.children.find(child => {
        if (!child.isMesh || !child.geometry || child.geometry.type !== 'BoxGeometry') return false;
        const parameters = child.geometry.parameters || {};
        return Number(parameters.width || 0) > 0.75 && Number(parameters.width || 0) < 0.9 && Number(parameters.height || 0) > 0.45 && Number(parameters.height || 0) < 0.6 && Number(parameters.depth || 0) > 0.6 && Number(parameters.depth || 0) < 0.75;
      });
      if (!boxChild) return;
      object.getWorldPosition(world);
      if (world.x > 10.2 && world.x < 15 && world.z > -13.2 && world.z < -12) found.push(object);
    });

    found.forEach((crate, index) => {
      temp.set(10.25 + (index % 2) * 0.88, 0.35 + Math.floor(index / 2) * 0.58, -12.8);
      if (crate.parent && crate.parent !== scene) crate.parent.worldToLocal(temp);
      crate.position.copy(temp);
    });
  }

  function makeRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    context.fillStyle = '#96704e';
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < 2600; index += 1) {
      const value = 65 + Math.floor(Math.random() * 95);
      context.fillStyle = `rgba(${value + 58},${value + 32},${value + 10},${0.07 + Math.random() * 0.2})`;
      context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }

    context.strokeStyle = 'rgba(72,45,28,.28)';
    context.lineWidth = 5;
    [78,178].forEach(x => {
      context.beginPath();
      context.moveTo(x, 0);
      context.bezierCurveTo(x - 7, 150, x + 8, 350, x, 512);
      context.stroke();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 18);
    if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
    return texture;
  }

  function makeMountainRoad(curve) {
    ['collision-safe-truck-road','realistic-mountain-road'].forEach(name => {
      const old = scene.getObjectByName(name);
      if (old && old.parent) old.parent.remove(old);
    });

    const segments = 150;
    const width = 4.5;
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
      positions.push(left.x,left.y,left.z,right.x,right.y,right.z);
      uvs.push(0,ratio * 18,1,ratio * 18);
      if (index < segments) {
        const base = index * 2;
        indices.push(base,base + 2,base + 1,base + 1,base + 2,base + 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const road = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map:makeRoadTexture(), roughness:1, metalness:0, polygonOffset:true, polygonOffsetFactor:4, polygonOffsetUnits:4 }));
    road.name = 'realistic-mountain-road';
    road.receiveShadow = true;
    road.castShadow = false;
    road.renderOrder = -32;
    root.add(road);
  }

  function buildTunnel(curve) {
    const tunnelPoint = curve.getPointAt(0.04);
    const tangent = curve.getTangentAt(0.04).normalize();
    const rotationY = Math.atan2(tangent.x, tangent.z);
    const tunnel = new THREE.Group();
    tunnel.name = 'mountain-tunnel';
    tunnel.position.copy(tunnelPoint);
    tunnel.rotation.y = rotationY;

    const stone = mat(0x6e6962, 0.98);
    const stoneLight = mat(0x8b847a, 0.96);
    const darkness = new THREE.MeshBasicMaterial({ color:0x0b0d0e, side:THREE.DoubleSide });
    const mouth = mesh(new THREE.PlaneGeometry(4.15, 3.45), darkness, 0, 1.72, 0.18);
    mouth.castShadow = false;
    tunnel.add(mouth);
    tunnel.add(mesh(new THREE.BoxGeometry(0.75, 3.2, 1.1), stone, -2.28, 1.6, 0));
    tunnel.add(mesh(new THREE.BoxGeometry(0.75, 3.2, 1.1), stone, 2.28, 1.6, 0));
    tunnel.add(mesh(new THREE.BoxGeometry(5.25, 0.75, 1.1), stone, 0, 3.55, 0));
    tunnel.add(mesh(new THREE.TorusGeometry(2.2, 0.43, 10, 30, Math.PI), stoneLight, 0, 1.45, 0.02));
    [-1.75,-0.9,0,0.9,1.75].forEach(x => tunnel.add(mesh(new THREE.BoxGeometry(0.58,0.42,1.18),stoneLight,x,3.55,0.03,null,[0,0,x*0.03])));
    root.add(tunnel);

    const mountainMaterial = mat(0x6f765f, 1);
    const rockMaterial = mat(0x67635c, 1);
    [
      [-5.4,2.1,-1.8,5.8,4.8,5.5],
      [5.4,2.2,-1.6,5.9,5.0,5.7],
      [0,4.1,-4.8,8.0,6.2,6.5],
      [-2.8,5.2,-5.4,4.8,4.2,4.6],
      [3.1,5.0,-5.2,4.7,4.0,4.6]
    ].forEach((entry,index) => {
      tunnel.add(mesh(new THREE.DodecahedronGeometry(1,1),index<2?rockMaterial:mountainMaterial,entry[0],entry[1],entry[2],[entry[3],entry[4],entry[5]],[0.08*index,0.22*index,0.04*index]));
    });

    const treeMaterial = mat(0x3f6537, 1);
    const trunkMaterial = mat(0x5d412f, 1);
    [[-6.8,5.7,-1.8],[6.5,6.2,-2.1],[-4.5,7.2,-5.0],[4.4,7.0,-5.4]].forEach(([x,y,z]) => {
      tunnel.add(mesh(new THREE.CylinderGeometry(0.12,0.16,1.6,7),trunkMaterial,x,y-1.15,z));
      tunnel.add(mesh(new THREE.ConeGeometry(0.95,2.4,9),treeMaterial,x,y,z));
    });
  }

  function installTruckRoute() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(47.5,0.045,-44.5),
      new THREE.Vector3(45.3,0.045,-41.4),
      new THREE.Vector3(42.0,0.045,-38.0),
      new THREE.Vector3(38.3,0.045,-34.3),
      new THREE.Vector3(34.0,0.045,-30.2),
      new THREE.Vector3(30.4,0.045,-25.6),
      new THREE.Vector3(28.2,0.045,-20.0),
      new THREE.Vector3(25.0,0.045,-15.7),
      new THREE.Vector3(22.0,0.045,-11.7),
      new THREE.Vector3(18.0,0.045,-9.8),
      new THREE.Vector3(13.2,0.045,-9.2)
    ],false,'catmullrom',0.35);

    F.truckCurve = curve;
    window.FarmStructureV2.truckCurve = curve;
    makeMountainRoad(curve);
    buildTunnel(curve);
  }

  function enforceTruckPlacement() {
    const truck = window.farmTruckState;
    if (!truck || !truck.group || !F.truckCurve) return;
    const progress = THREE.MathUtils.clamp(Number(truck.progress) || 0, 0, 1);

    if (truck.state === 'arriving' || truck.state === 'leaving') {
      const point = F.truckCurve.getPointAt(progress);
      const tangent = F.truckCurve.getTangentAt(progress).normalize();
      const direction = truck.state === 'arriving' ? 1 : -1;
      truck.group.position.copy(point);
      truck.group.rotation.y = Math.atan2(direction * tangent.x, direction * tangent.z);
      truck.group.visible = progress > 0.045;
      return;
    }

    if (truck.state === 'waitingPlayer' || truck.state === 'loading') {
      const point = F.truckCurve.getPointAt(1);
      const tangent = F.truckCurve.getTangentAt(1).normalize();
      truck.group.position.copy(point);
      truck.group.rotation.y = Math.atan2(tangent.x, tangent.z);
      truck.group.visible = true;
      return;
    }

    if (truck.state === 'waiting') truck.group.visible = false;
  }

  let installed = false;

  function install() {
    if (installed) return true;
    if (!F.initWorld || !F.initWorld()) return false;
    Object.entries(F.buildings).forEach(([id, structure]) => addBrickFacade(id, structure));
    relocateHayBales();
    relocateDockCrates();
    installTruckRoute();
    installed = true;
    return true;
  }

  const installer = window.setInterval(() => {
    if (install()) window.clearInterval(installer);
  }, 250);

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    if (!installed) return;
    last = now;
    enforceTruckPlacement();
  }

  window.setTimeout(() => requestAnimationFrame(loop), 40);
})();
