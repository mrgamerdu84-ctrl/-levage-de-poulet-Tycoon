'use strict';
(() => {
  if (typeof THREE === 'undefined' || typeof scene === 'undefined') return;

  let previousRain = false;

  function rainActive() {
    const label = document.getElementById('wx');
    return Boolean(label && /pluie|orage/i.test(label.textContent || ''));
  }

  function releaseBirds() {
    const seen = new Set();
    scene.traverse(object => {
      if (!object.userData || !object.userData.bird) return;
      const bird = object.userData.bird;
      const group = bird.group || object;
      if (seen.has(group.uuid)) return;
      seen.add(group.uuid);

      group.visible = true;
      if (bird.state !== 'weatherShelter' && bird.state !== 'rainBarnShelter') return;

      if (bird.currentEgg && bird.currentEgg.incubating) {
        bird.state = 'brooding';
        bird.stateTimer = Math.max(5, Number(bird._ws && bird._ws.timer) || 12);
      } else {
        bird.state = 'wander';
        bird.stateTimer = 4 + Math.random() * 5;
      }
      bird._in = false;
      bird._ws = null;
    });
  }

  function loop() {
    requestAnimationFrame(loop);
    const currentRain = rainActive();
    if (previousRain && !currentRain) releaseBirds();
    previousRain = currentRain;
  }

  requestAnimationFrame(loop);
})();
