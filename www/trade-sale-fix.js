'use strict';

// Autorise la vente d’une poule qui a déjà pondu, tant qu’elle ne pond pas et ne couve pas actuellement.
(() => {
  if (typeof hens === 'undefined' || typeof chickens === 'undefined') return;

  const CHICKEN_KEY = 'elevage.chickens.v2';
  const SYSTEM_KEY = 'elevage.systems.v1';
  const breeds = {
    red: { name: 'Poule rousse', sell: 45 },
    white: { name: 'Poule blanche', sell: 60 },
    black: { name: 'Poule noire', sell: 75 },
    sussex: { name: 'Poule Sussex', sell: 95 },
    dwarf: { name: 'Poule naine', sell: 68 }
  };

  function farmStatus(message) {
    if (typeof setFarmStatus === 'function') setFarmStatus(message);
  }

  function persist() {
    localStorage.setItem(CHICKEN_KEY, JSON.stringify({
      breeds: hens.map(hen => hen.breedId || 'red')
    }));

    if (window.farmEconomyState) {
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem(SYSTEM_KEY) || '{}'); } catch (_) {}
      saved.coins = Math.max(0, Math.floor(window.farmEconomyState.coins || 0));
      localStorage.setItem(SYSTEM_KEY, JSON.stringify(saved));
    }
  }

  function sellAvailableHen(breedId) {
    const breed = breeds[breedId];
    if (!breed) return;
    if (hens.length <= 1) return farmStatus('Il faut garder au moins une poule dans l’élevage.');

    let index = -1;
    for (let i = hens.length - 1; i >= 0; i -= 1) {
      const hen = hens[i];
      const busy = ['laying', 'brooding', 'toNest'].includes(hen.state);
      if ((hen.breedId || 'red') === breedId && !busy) {
        index = i;
        break;
      }
    }

    if (index < 0) return farmStatus('Cette poule pond ou couve actuellement. Réessaie un peu plus tard.');

    const hen = hens[index];
    if (typeof rooster !== 'undefined' && rooster.courtshipTarget === hen) rooster.courtshipTarget = null;
    scene.remove(hen.group);
    hens.splice(index, 1);
    const chickenIndex = chickens.indexOf(hen);
    if (chickenIndex >= 0) chickens.splice(chickenIndex, 1);

    if (window.farmEconomyState) window.farmEconomyState.coins += breed.sell;
    const count = document.getElementById('hensCount');
    if (count) count.textContent = String(hens.length);
    persist();
    farmStatus(`${breed.name} a été vendue pour ${breed.sell} pièces.`);
  }

  document.querySelectorAll('[data-sell-breed]').forEach(oldButton => {
    const breedId = oldButton.dataset.sellBreed;
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.addEventListener('click', () => sellAvailableHen(breedId));
  });
})();
