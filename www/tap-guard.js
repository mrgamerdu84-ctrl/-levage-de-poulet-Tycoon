'use strict';

// Empêche les boutons et menus de déclencher le bruit d’un animal situé derrière eux.
(() => {
  const originalAddEventListener = window.addEventListener;
  let captureListenersToWrap = 2;

  window.addEventListener = function guardedAddEventListener(type, listener, options) {
    const isAnimalTapCapture =
      captureListenersToWrap > 0 &&
      options === true &&
      (type === 'pointerdown' || type === 'pointerup');

    if (!isAnimalTapCapture) {
      return originalAddEventListener.call(this, type, listener, options);
    }

    const wrapped = function guardedAnimalTap(event) {
      if (typeof renderer !== 'undefined' && event.target !== renderer.domElement) return;
      return listener.call(this, event);
    };

    captureListenersToWrap -= 1;
    const result = originalAddEventListener.call(this, type, wrapped, options);
    if (captureListenersToWrap === 0) window.addEventListener = originalAddEventListener;
    return result;
  };
})();
