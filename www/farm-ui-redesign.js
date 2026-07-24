'use strict';
(() => {
  if (!document.body) return;

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --farm-cream: #fffaf0;
      --farm-brown: #4a3728;
      --farm-green: #6f9c50;
      --farm-gold: #d9a83d;
      --farm-shadow: 0 8px 24px rgba(44, 31, 21, .18);
    }

    #title, #stats, #sys, #shopBtn, #resetView {
      display: none !important;
    }

    #ui { padding: 0 !important; }

    #event {
      left: 50% !important;
      bottom: calc(88px + env(safe-area-inset-bottom)) !important;
      transform: translate(-50%, 18px) !important;
      width: min(520px, calc(100vw - 34px)) !important;
      max-width: none !important;
      padding: 10px 14px !important;
      border: 0 !important;
      border-radius: 14px !important;
      background: rgba(40, 32, 25, .88) !important;
      color: #fff8e8 !important;
      box-shadow: var(--farm-shadow) !important;
      backdrop-filter: blur(12px) !important;
      font-size: 12px !important;
      line-height: 1.35 !important;
      text-align: center !important;
      opacity: 0;
      pointer-events: none !important;
      transition: opacity .25s ease, transform .25s ease !important;
      z-index: 72 !important;
    }

    #event.farmToastVisible {
      opacity: 1;
      transform: translate(-50%, 0) !important;
    }

    #hint {
      left: 50% !important;
      bottom: calc(60px + env(safe-area-inset-bottom)) !important;
      transform: translateX(-50%) !important;
      width: auto !important;
      max-width: calc(100vw - 38px) !important;
      padding: 5px 10px !important;
      border: 0 !important;
      border-radius: 999px !important;
      background: rgba(255, 250, 240, .7) !important;
      color: rgba(74, 55, 40, .82) !important;
      box-shadow: none !important;
      backdrop-filter: blur(7px) !important;
      font-size: 9.5px !important;
      white-space: nowrap;
      opacity: .76;
      z-index: 15 !important;
    }

    #soundHint {
      left: 50% !important;
      bottom: calc(102px + env(safe-area-inset-bottom)) !important;
      transform: translateX(-50%) !important;
      padding: 8px 12px !important;
      border-radius: 999px !important;
      background: rgba(50, 42, 34, .88) !important;
      color: white !important;
      z-index: 90 !important;
    }

    #credits { opacity: .32 !important; font-size: 7px !important; }

    #tycoonHud {
      position: fixed;
      inset: 0;
      z-index: 70;
      pointer-events: none;
      font-family: Inter, sans-serif;
      color: var(--farm-brown);
    }

    .tycoonTopBar {
      position: absolute;
      top: calc(8px + env(safe-area-inset-top));
      left: 8px;
      right: 8px;
      display: grid;
      grid-template-columns: minmax(118px, 1.25fr) repeat(4, minmax(58px, auto));
      gap: 6px;
      align-items: stretch;
    }

    .tycoonBrand, .tycoonChip {
      min-width: 0;
      border: 1px solid rgba(74, 55, 40, .1);
      background: rgba(255, 250, 240, .88);
      box-shadow: 0 5px 16px rgba(50, 35, 23, .12);
      backdrop-filter: blur(10px);
    }

    .tycoonBrand {
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-radius: 15px;
      padding: 8px 11px;
      overflow: hidden;
    }

    .tycoonBrand strong {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: Fredoka, sans-serif;
      font-size: 14px;
      line-height: 1.05;
    }

    .tycoonBrand small {
      margin-top: 2px;
      color: #866448;
      font-size: 8.5px;
      white-space: nowrap;
    }

    .tycoonChip {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 13px;
      padding: 6px 8px;
      text-align: center;
    }

    .tycoonChip span { font-size: 14px; line-height: 1; }
    .tycoonChip b {
      margin-top: 3px;
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: Fredoka, sans-serif;
      font-size: 10.5px;
    }
    .tycoonChip small {
      margin-top: 1px;
      color: #866448;
      font-size: 7.5px;
      white-space: nowrap;
    }

    #tycoonDock {
      position: absolute;
      left: 50%;
      bottom: calc(8px + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      display: flex;
      gap: 7px;
      padding: 6px;
      border: 1px solid rgba(74, 55, 40, .1);
      border-radius: 18px;
      background: rgba(255, 250, 240, .9);
      box-shadow: var(--farm-shadow);
      backdrop-filter: blur(12px);
      pointer-events: auto;
    }

    .tycoonDockButton {
      width: 58px;
      min-height: 44px;
      border: 0;
      border-radius: 13px;
      background: transparent;
      color: var(--farm-brown);
      font-family: Inter, sans-serif;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.05;
    }

    .tycoonDockButton span {
      display: block;
      margin-bottom: 3px;
      font-size: 19px;
      line-height: 1;
    }

    .tycoonDockButton:active, .tycoonDockButton.active {
      background: #e9f0df;
      color: #4b7133;
      transform: translateY(1px);
    }

    .tycoonPanel {
      position: absolute;
      right: 9px;
      bottom: calc(70px + env(safe-area-inset-bottom));
      width: min(330px, calc(100vw - 18px));
      max-height: min(60vh, 520px);
      overflow: auto;
      display: none;
      padding: 14px;
      border: 1px solid rgba(74, 55, 40, .1);
      border-radius: 18px;
      background: rgba(255, 250, 240, .95);
      box-shadow: var(--farm-shadow);
      backdrop-filter: blur(14px);
      pointer-events: auto;
      box-sizing: border-box;
    }

    .tycoonPanel.open {
      display: block;
      animation: farmPanelIn .18s ease-out;
    }

    @keyframes farmPanelIn {
      from { opacity: 0; transform: translateY(8px) scale(.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .tycoonPanelHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 11px;
    }

    .tycoonPanelHeader h3 { margin: 0; font: 700 17px Fredoka, sans-serif; }
    .tycoonPanelClose {
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 10px;
      background: #eee3d3;
      color: var(--farm-brown);
      font-size: 18px;
    }

    .farmPanelGrid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .farmPanelCard {
      padding: 10px;
      border-radius: 13px;
      background: #f4ead9;
      font-size: 10px;
      line-height: 1.3;
    }

    .farmPanelCard b {
      display: block;
      margin-top: 4px;
      font: 700 15px Fredoka, sans-serif;
      color: #a65335;
    }

    .farmPanelWide { grid-column: 1 / -1; }

    .hudTimeButtons {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
    }

    .hudTimeButton {
      min-height: 58px;
      border: 1px solid rgba(74, 55, 40, .13);
      border-radius: 13px;
      background: #f5ebdc;
      color: var(--farm-brown);
      font: 700 10px Inter, sans-serif;
    }

    .hudTimeButton span { display: block; margin-bottom: 4px; font-size: 18px; }
    .hudTimeButton.active {
      border-color: #6d914e;
      background: #759f56;
      color: white;
    }

    .workerLine {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(74, 55, 40, .1);
      font-size: 10px;
    }
    .workerLine:last-child { border-bottom: 0; }

    #shop {
      background: rgba(27, 30, 24, .58) !important;
      backdrop-filter: blur(7px);
    }

    #shop .sc {
      width: min(480px, calc(100vw - 22px)) !important;
      max-height: min(78vh, 690px) !important;
      padding: 16px !important;
      border: 1px solid rgba(74, 55, 40, .1);
      border-radius: 20px !important;
      background: rgba(255, 250, 240, .98) !important;
      box-shadow: 0 16px 45px rgba(29, 22, 16, .28);
    }

    #shop .row, #shop .tradeRow {
      border: 0 !important;
      border-radius: 13px;
      background: #f5ecdf;
      margin-top: 7px;
      padding: 10px !important;
    }

    #shop .buy, #shop .tradeBuy, #shop .tradeSell {
      border-radius: 11px !important;
      min-height: 38px;
    }

    @media (max-width: 680px) {
      .tycoonTopBar { grid-template-columns: minmax(112px, 1.3fr) repeat(3, minmax(50px, auto)); }
      #hudAnimalsChip { display: none; }
      .tycoonBrand strong { font-size: 12.5px; }
      .tycoonChip { padding: 5px 6px; }
      .tycoonChip span { font-size: 12px; }
      .tycoonChip b { font-size: 9.5px; }
      #tycoonDock {
        width: calc(100vw - 20px);
        max-width: 370px;
        justify-content: space-around;
        box-sizing: border-box;
      }
      .tycoonDockButton { width: 52px; min-height: 42px; font-size: 8px; }
      .tycoonDockButton span { font-size: 18px; }
      .tycoonPanel { left: 9px; right: 9px; width: auto; }
      #hint { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  const hud = document.createElement('div');
  hud.id = 'tycoonHud';
  hud.innerHTML = `
    <div class="tycoonTopBar">
      <div class="tycoonBrand"><strong>La Super Ferme</strong><small>Tycoon d’élevage</small></div>
      <div class="tycoonChip" id="hudWeatherChip"><span>☀️</span><b id="hudWeather">Soleil</b><small id="hudTime">07:00</small></div>
      <div class="tycoonChip"><span>🪙</span><b id="hudCoins">0</b><small>pièces</small></div>
      <div class="tycoonChip"><span>🥚</span><b id="hudEggs">0</b><small>œufs</small></div>
      <div class="tycoonChip" id="hudAnimalsChip"><span>🐾</span><b id="hudAnimals">0</b><small>animaux</small></div>
    </div>

    <div id="tycoonDock">
      <button class="tycoonDockButton" type="button" data-hud-action="shop"><span>🛒</span>Boutique</button>
      <button class="tycoonDockButton" type="button" data-hud-panel="hudTimePanel"><span>⏱️</span>Temps</button>
      <button class="tycoonDockButton" type="button" data-hud-panel="hudLogisticsPanel"><span>🚚</span>Transport</button>
      <button class="tycoonDockButton" type="button" data-hud-panel="hudFarmPanel"><span>📊</span>Ferme</button>
      <button class="tycoonDockButton" type="button" data-hud-action="view"><span>🔭</span>Vue</button>
    </div>

    <section class="tycoonPanel" id="hudTimePanel">
      <div class="tycoonPanelHeader"><h3>Vitesse du temps</h3><button class="tycoonPanelClose" type="button">×</button></div>
      <div class="hudTimeButtons">
        <button class="hudTimeButton" type="button" data-new-time="fast"><span>⏩</span>Accéléré<br><small>3 min 30 / jour</small></button>
        <button class="hudTimeButton" type="button" data-new-time="normal"><span>▶️</span>Normal<br><small>20 min / jour</small></button>
        <button class="hudTimeButton" type="button" data-new-time="real"><span>🕒</span>Temps réel<br><small>24 h / jour</small></button>
      </div>
    </section>

    <section class="tycoonPanel" id="hudLogisticsPanel">
      <div class="tycoonPanelHeader"><h3>Logistique et commerce</h3><button class="tycoonPanelClose" type="button">×</button></div>
      <div class="farmPanelGrid">
        <div class="farmPanelCard">🥚 Caisses d’œufs<b id="hudStockEggs">0</b></div>
        <div class="farmPanelCard">🥛 Lait<b id="hudStockMilk">0</b></div>
        <div class="farmPanelCard">🧶 Laine<b id="hudStockWool">0</b></div>
        <div class="farmPanelCard">🦆 Produits canards<b id="hudStockDuck">0</b></div>
        <div class="farmPanelCard farmPanelWide">🚚 Camion<b id="hudTruckState">hors de la ferme</b><small id="hudTruckTime">Prochain passage bientôt</small></div>
        <div class="farmPanelCard">Livraisons<b id="hudDeliveries">0</b></div>
        <div class="farmPanelCard">Dernière vente<b id="hudLastRevenue">0 🪙</b></div>
      </div>
    </section>

    <section class="tycoonPanel" id="hudFarmPanel">
      <div class="tycoonPanelHeader"><h3>Vie de la ferme</h3><button class="tycoonPanelClose" type="button">×</button></div>
      <div class="farmPanelGrid">
        <div class="farmPanelCard">🐔 Poules<b id="hudHens">0</b></div>
        <div class="farmPanelCard">🐣 Poussins<b id="hudChicks">0</b></div>
        <div class="farmPanelCard">🌱 Météo<b id="hudFarmWeather">Soleil</b></div>
        <div class="farmPanelCard">🕰️ Heure<b id="hudFarmTime">07:00</b></div>
      </div>
      <div id="hudWorkers"></div>
    </section>
  `;
  document.body.appendChild(hud);

  function stopUiPropagation(element) {
    ['pointerdown', 'pointerup', 'click', 'touchstart'].forEach(type => {
      element.addEventListener(type, event => event.stopPropagation());
    });
  }

  hud.querySelectorAll('button, .tycoonPanel').forEach(stopUiPropagation);

  function closePanels(exceptId) {
    hud.querySelectorAll('.tycoonPanel').forEach(panel => {
      if (panel.id !== exceptId) panel.classList.remove('open');
    });
    hud.querySelectorAll('[data-hud-panel]').forEach(button => {
      button.classList.toggle('active', button.dataset.hudPanel === exceptId);
    });
  }

  hud.querySelectorAll('[data-hud-panel]').forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.dataset.hudPanel);
      const willOpen = panel && !panel.classList.contains('open');
      closePanels(willOpen ? panel.id : null);
      if (panel && willOpen) panel.classList.add('open');
    });
  });

  hud.querySelectorAll('.tycoonPanelClose').forEach(button => {
    button.addEventListener('click', () => closePanels(null));
  });

  hud.querySelector('[data-hud-action="shop"]').addEventListener('click', () => {
    closePanels(null);
    const original = document.getElementById('shopBtn');
    if (original) original.click();
  });

  hud.querySelector('[data-hud-action="view"]').addEventListener('click', () => {
    closePanels(null);
    const original = document.getElementById('resetView');
    if (original) original.click();
  });

  hud.querySelectorAll('[data-new-time]').forEach(button => {
    button.addEventListener('click', () => {
      if (typeof window.setFarmTimeMode === 'function') window.setFarmTimeMode(button.dataset.newTime);
      updateTimeButtons();
    });
  });

  function text(id, fallback = '0') {
    const element = document.getElementById(id);
    return element ? element.textContent.trim() : fallback;
  }

  function countAnimals() {
    const seen = new Set();
    let count = 0;
    if (typeof scene === 'undefined') return Number(text('hensCount', '0')) || 0;
    scene.traverse(object => {
      if (!object.userData) return;
      let root = null;
      if (object.userData.bird && object.userData.bird.group) root = object.userData.bird.group;
      else if (object.userData.farmAnimal) root = object.userData.farmAnimal.group || object;
      if (!root) return;
      const key = root.uuid || object.uuid;
      if (seen.has(key)) return;
      seen.add(key);
      count += 1;
    });
    return count;
  }

  function updateTimeButtons() {
    const current = typeof window.getFarmTimeMode === 'function' ? window.getFarmTimeMode() : 'normal';
    hud.querySelectorAll('[data-new-time]').forEach(button => {
      button.classList.toggle('active', button.dataset.newTime === current);
    });
  }

  function updateWorkers() {
    const container = document.getElementById('hudWorkers');
    const workerList = window.farmWorkerState;
    if (!container || !Array.isArray(workerList)) return;
    container.innerHTML = workerList.map((worker, index) => `
      <div class="workerLine"><strong>👨‍🌾 Fermier ${index + 1}</strong><span>${worker.status || 'à la maison'}</span></div>
    `).join('');
  }

  function updateLogistics() {
    const state = window.farmLogisticsState;
    if (!state) return;
    document.getElementById('hudStockEggs').textContent = Math.floor(state.eggs || 0);
    document.getElementById('hudStockMilk').textContent = Math.floor(state.milk || 0);
    document.getElementById('hudStockWool').textContent = Math.floor(state.wool || 0);
    document.getElementById('hudStockDuck').textContent = Math.floor(state.duck || 0);
    document.getElementById('hudDeliveries').textContent = Math.floor(state.deliveries || 0);
    document.getElementById('hudLastRevenue').textContent = `${Math.floor(state.lastRevenue || 0)} 🪙`;
    document.getElementById('hudTruckState').textContent = state.truckState || 'hors de la ferme';
    const seconds = Math.max(0, Math.ceil(state.nextTruck || 0));
    document.getElementById('hudTruckTime').textContent = state.truckState === 'hors de la ferme'
      ? `Prochain passage dans environ ${seconds} s`
      : 'Le transport est en cours';
  }

  function updateHud() {
    const weather = text('wx', '☀️ Soleil');
    const time = text('tm', '07:00');
    const coins = text('co', '0');
    const eggs = text('eggCount', '0');
    const hens = text('hensCount', '0');
    const chicks = text('chickCount', '0');

    const weatherIcon = weather.includes('Nuit') ? '🌙' : weather.includes('Pluie') ? '🌧️' : '☀️';
    document.querySelector('#hudWeatherChip span').textContent = weatherIcon;
    document.getElementById('hudWeather').textContent = weather.replace(/^\S+\s*/, '') || weather;
    document.getElementById('hudTime').textContent = time;
    document.getElementById('hudCoins').textContent = coins;
    document.getElementById('hudEggs').textContent = eggs;
    document.getElementById('hudAnimals').textContent = countAnimals();
    document.getElementById('hudHens').textContent = hens;
    document.getElementById('hudChicks').textContent = chicks;
    document.getElementById('hudFarmWeather').textContent = weather;
    document.getElementById('hudFarmTime').textContent = time;

    updateTimeButtons();
    updateWorkers();
    updateLogistics();
  }

  const eventElement = document.getElementById('event');
  let toastTimer = 0;
  if (eventElement) {
    const showToast = () => {
      eventElement.classList.add('farmToastVisible');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => eventElement.classList.remove('farmToastVisible'), 4200);
    };
    const observer = new MutationObserver(showToast);
    observer.observe(eventElement, { childList: true, characterData: true, subtree: true });
    showToast();
  }

  updateHud();
  window.setInterval(updateHud, 350);
})();
