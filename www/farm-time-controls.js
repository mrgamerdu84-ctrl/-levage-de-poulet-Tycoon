'use strict';
(() => {
  if (typeof window.requestAnimationFrame !== 'function') return;

  const STORAGE_KEY = 'elevage.timeMode.v1';
  const ORIGINAL_DAY_SECONDS = 210;

  const MODES = {
    fast: {
      scale: 1,
      label: '⏩ Accéléré',
      description: '1 journée ≈ 3 min 30'
    },
    normal: {
      scale: ORIGINAL_DAY_SECONDS / 1200,
      label: '▶ Normal',
      description: '1 journée ≈ 20 min'
    },
    real: {
      scale: ORIGINAL_DAY_SECONDS / 86400,
      label: '🕒 Temps réel',
      description: '1 minute du jeu = 1 minute réelle'
    }
  };

  let mode = localStorage.getItem(STORAGE_KEY);
  if (!MODES[mode]) mode = 'normal';

  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const trackedLoops = new Map();

  function currentScale() {
    return MODES[mode].scale;
  }

  function isScaledGameLoop(callback) {
    if (typeof callback !== 'function') return false;
    const name = callback.name || '';
    if (name === 'upgradeLoop') return true;
    if (name !== 'loop') return false;

    try {
      const source = Function.prototype.toString.call(callback);
      return source.includes('weather(dt)') && source.includes('economy(dt)');
    } catch (_) {
      return false;
    }
  }

  function virtualCallback(callback) {
    let state = trackedLoops.get(callback);
    if (!state) {
      state = {
        realTimestamp: null,
        virtualTimestamp: performance.now()
      };
      trackedLoops.set(callback, state);
    }

    return realTimestamp => {
      if (state.realTimestamp === null) {
        state.realTimestamp = realTimestamp;
        state.virtualTimestamp = realTimestamp;
      } else {
        const realDelta = Math.max(0, realTimestamp - state.realTimestamp);
        state.realTimestamp = realTimestamp;
        state.virtualTimestamp += realDelta * currentScale();
      }

      callback(state.virtualTimestamp);
    };
  }

  window.requestAnimationFrame = function farmScaledAnimationFrame(callback) {
    if (!isScaledGameLoop(callback)) {
      return originalRequestAnimationFrame(callback);
    }
    return originalRequestAnimationFrame(virtualCallback(callback));
  };

  // Le moteur principal des poules utilise THREE.Clock au lieu du timestamp RAF.
  // On adapte uniquement les horloges créées après ce script.
  if (window.THREE && typeof THREE.Clock === 'function') {
    const OriginalClock = THREE.Clock;

    function ScaledClock(...args) {
      const clock = new OriginalClock(...args);
      const originalGetDelta = clock.getDelta.bind(clock);
      let scaledElapsed = 0;

      clock.getDelta = function getScaledDelta() {
        const scaledDelta = originalGetDelta() * currentScale();
        scaledElapsed += scaledDelta;
        this.elapsedTime = scaledElapsed;
        return scaledDelta;
      };

      return clock;
    }

    ScaledClock.prototype = OriginalClock.prototype;
    Object.setPrototypeOf(ScaledClock, OriginalClock);
    THREE.Clock = ScaledClock;
  }

  function updateButtons() {
    document.querySelectorAll('[data-farm-time-mode]').forEach(button => {
      const active = button.dataset.farmTimeMode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const description = document.getElementById('farmTimeDescription');
    if (description) description.textContent = MODES[mode].description;
  }

  function setMode(nextMode) {
    if (!MODES[nextMode]) return;

    mode = nextMode;
    localStorage.setItem(STORAGE_KEY, mode);
    updateButtons();

    if (typeof setFarmStatus === 'function') {
      const messages = {
        fast: 'Le temps est accéléré.',
        normal: 'Le temps avance à vitesse normale.',
        real: 'Le temps avance maintenant comme dans la vraie vie.'
      };
      setFarmStatus(messages[mode]);
    }
  }

  window.getFarmTimeMode = () => mode;
  window.getFarmTimeScale = currentScale;
  window.setFarmTimeMode = setMode;

  function installUi() {
    const panel = document.getElementById('sys');
    if (!panel || document.getElementById('farmTimeControls')) return false;

    const style = document.createElement('style');
    style.textContent = `
      #farmTimeControls {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(74,55,40,.16);
        pointer-events: auto;
      }
      #farmTimeButtons {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 5px;
      }
      .farmTimeButton {
        border: 1px solid rgba(74,55,40,.2);
        border-radius: 9px;
        padding: 6px 7px;
        background: rgba(255,255,255,.72);
        color: #4A3728;
        font: 700 10px Inter, sans-serif;
      }
      .farmTimeButton.active {
        background: #7FA65C;
        border-color: #6B914B;
        color: white;
      }
      #farmTimeDescription {
        display: block;
        margin-top: 5px;
        color: #796552;
        font-size: 9.5px;
        line-height: 1.2;
      }
      @media (max-width: 680px) {
        #farmTimeButtons { max-width: 190px; }
        .farmTimeButton { padding: 5px 6px; font-size: 9px; }
      }
    `;
    document.head.appendChild(style);

    const controls = document.createElement('div');
    controls.id = 'farmTimeControls';
    controls.innerHTML = `
      <b>Vitesse du temps</b>
      <div id="farmTimeButtons">
        ${Object.entries(MODES).map(([id, item]) =>
          `<button type="button" class="farmTimeButton" data-farm-time-mode="${id}" aria-pressed="false">${item.label}</button>`
        ).join('')}
      </div>
      <small id="farmTimeDescription"></small>
    `;
    panel.appendChild(controls);

    controls.querySelectorAll('button').forEach(button => {
      ['pointerdown', 'pointerup', 'click'].forEach(type => {
        button.addEventListener(type, event => event.stopPropagation());
      });
      button.addEventListener('click', () => setMode(button.dataset.farmTimeMode));
    });

    updateButtons();
    return true;
  }

  const installer = window.setInterval(() => {
    if (installUi()) window.clearInterval(installer);
  }, 100);
})();
