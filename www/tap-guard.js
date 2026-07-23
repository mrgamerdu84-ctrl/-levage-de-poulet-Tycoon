'use strict';

// L’ancien gestionnaire tactile global perdait parfois la cible dans Android WebView.
// On ignore uniquement ses deux écouteurs, puis on restaure addEventListener.
(() => {
  const originalAddEventListener = window.addEventListener;
  let listenersToSkip = 2;

  window.addEventListener = function skipOldAnimalTouch(type, listener, options) {
    const capture = options === true || Boolean(options && options.capture === true);
    const isOldAnimalTouch =
      listenersToSkip > 0 &&
      capture &&
      (type === 'pointerdown' || type === 'pointerup');

    if (isOldAnimalTouch) {
      listenersToSkip -= 1;
      if (listenersToSkip === 0) window.addEventListener = originalAddEventListener;
      return undefined;
    }

    return originalAddEventListener.call(this, type, listener, options);
  };
})();
