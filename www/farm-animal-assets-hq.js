'use strict';
(() => {
  if (
    typeof THREE === 'undefined' ||
    typeof scene === 'undefined' ||
    typeof renderer === 'undefined'
  ) return;

  const MANIFEST_URL = 'assets/animals/manifest.json';
  const RESCAN_INTERVAL_MS = 900;
  const DEFAULT_ANIMATION_NAMES = ['idle', 'stand', 'breathe', 'walk', 'eat'];

  const assetCache = new Map();
  const upgradedAnimals = new Map();
  const mixers = new Set();
  const loader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
  const textureLoader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities && renderer.capabilities.getMaxAnisotropy
    ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
    : 1;

  let manifest = null;
  let lastFrame = performance.now();

  function resolveType(object) {
    if (!object || !object.userData) return null;

    if (object.userData.bird) {
      const bird = object.userData.bird;
      return {
        type: bird.role === 'rooster' ? 'rooster' : 'hen',
        group: bird.group || object,
        data: bird
      };
    }

    if (object.userData.farmAnimal) {
      const animal = object.userData.farmAnimal;
      return {
        type: animal.type,
        group: animal.group || object,
        data: animal
      };
    }

    return null;
  }

  function cloneModel(template) {
    if (
      THREE.SkeletonUtils &&
      typeof THREE.SkeletonUtils.clone === 'function'
    ) {
      return THREE.SkeletonUtils.clone(template);
    }

    return template.clone(true);
  }

  function prepareModel(root) {
    root.traverse(child => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = true;
      child.userData.hqAnimalAsset = true;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach(material => {
        if (!material) return;

        if (material.map) {
          material.map.anisotropy = maxAnisotropy;
          material.map.needsUpdate = true;
        }

        if ('metalness' in material) material.metalness = Math.min(0.08, material.metalness || 0);
        if ('roughness' in material) material.roughness = Math.max(0.48, material.roughness || 0.8);
        material.needsUpdate = true;
      });
    });
  }

  function hideLegacyMeshes(group, protectedRoot) {
    group.traverse(child => {
      if (!child.isMesh) return;
      if (protectedRoot && protectedRoot === child) return;

      let current = child;
      while (current && current !== group) {
        if (current === protectedRoot || current.userData.hqAnimalAsset) return;
        current = current.parent;
      }

      child.visible = false;
      child.userData.hiddenByHqAnimalSystem = true;
    });
  }

  function restoreLegacyMeshes(group) {
    group.traverse(child => {
      if (!child.isMesh || !child.userData.hiddenByHqAnimalSystem) return;
      child.visible = true;
      delete child.userData.hiddenByHqAnimalSystem;
    });
  }

  function normalizeAssetConfig(type, config) {
    if (!config || typeof config !== 'object') return null;

    const transform = config.transform || {};

    return {
      type,
      model: typeof config.model === 'string' ? config.model : '',
      sprite: typeof config.sprite === 'string' ? config.sprite : '',
      scale: Number(transform.scale) || 1,
      position: Array.isArray(transform.position) ? transform.position : [0, 0, 0],
      rotation: Array.isArray(transform.rotation) ? transform.rotation : [0, 0, 0],
      animations: Array.isArray(config.animations) ? config.animations : DEFAULT_ANIMATION_NAMES,
      spriteSize: Array.isArray(config.spriteSize) ? config.spriteSize : [1.8, 1.8],
      enabled: config.enabled !== false
    };
  }

  async function loadManifest() {
    try {
      const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
      const parsed = await response.json();
      manifest = parsed && parsed.animals ? parsed.animals : {};
    } catch (error) {
      console.warn('[HQ Animals] Manifest introuvable. Les anciens animaux restent visibles.', error);
      manifest = {};
    }
  }

  function loadGltf(url) {
    return new Promise((resolve, reject) => {
      if (!loader || !url) {
        reject(new Error('GLTFLoader indisponible'));
        return;
      }

      loader.load(
        url,
        gltf => resolve(gltf),
        undefined,
        reject
      );
    });
  }

  function loadSprite(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('Sprite non configuré'));
        return;
      }

      textureLoader.load(
        url,
        texture => {
          if (typeof THREE.sRGBEncoding !== 'undefined') {
            texture.encoding = THREE.sRGBEncoding;
          }

          texture.anisotropy = maxAnisotropy;
          texture.needsUpdate = true;

          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.08,
            depthWrite: true
          });

          const sprite = new THREE.Sprite(material);
          sprite.userData.hqAnimalAsset = true;
          resolve(sprite);
        },
        undefined,
        reject
      );
    });
  }

  async function loadAsset(type) {
    if (assetCache.has(type)) return assetCache.get(type);

    const promise = (async () => {
      const config = normalizeAssetConfig(type, manifest[type]);
      if (!config || !config.enabled) return null;

      if (config.model) {
        try {
          const gltf = await loadGltf(config.model);
          const template = gltf.scene || (gltf.scenes && gltf.scenes[0]);

          if (template) {
            prepareModel(template);
            return {
              mode: 'model',
              template,
              animations: gltf.animations || [],
              config
            };
          }
        } catch (error) {
          console.warn(`[HQ Animals] Modèle ${type} non chargé, essai du sprite.`, error);
        }
      }

      if (config.sprite) {
        try {
          const sprite = await loadSprite(config.sprite);
          return {
            mode: 'sprite',
            template: sprite,
            animations: [],
            config
          };
        } catch (error) {
          console.warn(`[HQ Animals] Sprite ${type} non chargé.`, error);
        }
      }

      return null;
    })();

    assetCache.set(type, promise);
    return promise;
  }

  function chooseAnimation(animations, preferredNames) {
    if (!animations || !animations.length) return null;

    for (const name of preferredNames) {
      const match = animations.find(animation =>
        String(animation.name || '').toLowerCase().includes(String(name).toLowerCase())
      );
      if (match) return match;
    }

    return animations[0];
  }

  function applyTransform(container, config) {
    container.scale.setScalar(config.scale);
    container.position.set(
      Number(config.position[0]) || 0,
      Number(config.position[1]) || 0,
      Number(config.position[2]) || 0
    );
    container.rotation.set(
      Number(config.rotation[0]) || 0,
      Number(config.rotation[1]) || 0,
      Number(config.rotation[2]) || 0
    );
  }

  function createVisual(asset) {
    const container = new THREE.Group();
    container.name = `hq-animal-${asset.config.type}`;
    container.userData.hqAnimalAsset = true;
    applyTransform(container, asset.config);

    let mixer = null;

    if (asset.mode === 'model') {
      const model = cloneModel(asset.template);
      model.userData.hqAnimalAsset = true;
      prepareModel(model);
      container.add(model);

      const animation = chooseAnimation(asset.animations, asset.config.animations);
      if (animation) {
        mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(animation);
        action.reset();
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.fadeIn(0.2);
        action.play();
      }
    } else {
      const sprite = asset.template.clone();
      sprite.material = asset.template.material.clone();
      sprite.userData.hqAnimalAsset = true;
      sprite.scale.set(
        Number(asset.config.spriteSize[0]) || 1.8,
        Number(asset.config.spriteSize[1]) || 1.8,
        1
      );
      container.add(sprite);
    }

    return { container, mixer };
  }

  async function upgradeAnimal(record) {
    const { group, type } = record;
    if (!group || upgradedAnimals.has(group.uuid)) return;
    if (!manifest || !manifest[type]) return;

    upgradedAnimals.set(group.uuid, { status: 'loading' });

    const asset = await loadAsset(type);
    if (!asset || !group.parent) {
      upgradedAnimals.delete(group.uuid);
      return;
    }

    try {
      const visual = createVisual(asset);
      group.add(visual.container);
      hideLegacyMeshes(group, visual.container);

      if (visual.mixer) mixers.add(visual.mixer);

      upgradedAnimals.set(group.uuid, {
        status: 'ready',
        group,
        type,
        visual: visual.container,
        mixer: visual.mixer
      });
    } catch (error) {
      restoreLegacyMeshes(group);
      upgradedAnimals.delete(group.uuid);
      console.warn(`[HQ Animals] Échec de remplacement pour ${type}.`, error);
    }
  }

  function scanAnimals() {
    const seen = new Set();

    scene.traverse(object => {
      const record = resolveType(object);
      if (!record || !record.group || seen.has(record.group.uuid)) return;
      if (!manifest || !manifest[record.type]) return;

      seen.add(record.group.uuid);
      upgradeAnimal(record);
    });

    upgradedAnimals.forEach((entry, uuid) => {
      if (entry.status !== 'ready') return;
      if (!entry.group || !entry.group.parent) {
        if (entry.mixer) mixers.delete(entry.mixer);
        upgradedAnimals.delete(uuid);
      }
    });
  }

  function updateMixers(now) {
    requestAnimationFrame(updateMixers);

    const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;

    mixers.forEach(mixer => mixer.update(delta));
  }

  async function boot() {
    if (!loader) {
      console.warn('[HQ Animals] GLTFLoader absent. Les anciens animaux restent actifs.');
    }

    await loadManifest();
    scanAnimals();
    window.setInterval(scanAnimals, RESCAN_INTERVAL_MS);
    requestAnimationFrame(updateMixers);

    window.refreshHQFarmAnimals = scanAnimals;
    window.HQ_FARM_ANIMAL_ASSETS = {
      manifest: () => manifest,
      refresh: scanAnimals,
      upgraded: upgradedAnimals
    };
  }

  boot();
})();
