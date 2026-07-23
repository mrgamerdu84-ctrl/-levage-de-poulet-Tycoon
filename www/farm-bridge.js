'use strict';

// Capture la monnaie créée par game-systems.js sans modifier son fonctionnement.
(() => {
  const originalAssign = Object.assign;
  let restored = false;

  Object.assign = function patchedAssign(target, ...sources) {
    const result = originalAssign.call(Object, target, ...sources);

    if (
      !restored &&
      result &&
      typeof result === 'object' &&
      Object.prototype.hasOwnProperty.call(result, 'coins') &&
      Object.prototype.hasOwnProperty.call(result, 'cow') &&
      Object.prototype.hasOwnProperty.call(result, 'sheep') &&
      Object.prototype.hasOwnProperty.call(result, 'duck')
    ) {
      window.farmEconomyState = result;
      restored = true;
      Object.assign = originalAssign;
    }

    return result;
  };
})();
