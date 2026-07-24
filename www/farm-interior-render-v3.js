'use strict';
(() => {
  if (!window.FarmLivingV3) return;

  const centers = {
    coop: new THREE.Vector3(-12, 60, 118),
    barn: new THREE.Vector3(12, 60, 118)
  };

  window.FarmLivingV3.addUpdate(() => {
    const view = window.farmInteriorView;
    const type = view && typeof view.current === 'function'
      ? view.current()
      : null;

    if (!type || !centers[type]) return;

    const center = centers[type];
    const offset = type === 'coop'
      ? new THREE.Vector3(9.8, 6.2, -10.5)
      : new THREE.Vector3(12.5, 7.2, -13);

    // La boucle historique remet la caméra sur la vue extérieure avant son
    // rendu. Ce rendu final, exécuté dans la boucle partagée de la ferme,
    // garantit que l'intérieur reste réellement visible sans lancer un RAF
    // supplémentaire.
    camera.position.copy(center).add(offset);
    camera.lookAt(center.x, center.y + 1.1, center.z);
    renderer.render(scene, camera);
  });
})();