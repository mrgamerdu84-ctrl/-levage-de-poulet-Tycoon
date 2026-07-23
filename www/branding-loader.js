'use strict';

// Affiche les visuels officiels fournis pour l'icône et l'écran de lancement.
// Le contenu graphique n'est pas redessiné : seules des dimensions techniques
// adaptées à Android sont utilisées pendant la compilation.
(() => {
  const ICON_FILE = 'assets/branding/app-icon.jpg';
  const SPLASH_FILE = 'assets/branding/launch-screen.jpg';
  const ICON_PARTS = ['part00.b64', 'part01.b64', 'part02.b64', 'part03.b64'];
  const SPLASH_PARTS = [
    'part00.b64', 'part01.b64', 'part02.b64', 'part03.b64',
    'part04.b64', 'part05a.b64', 'part05b.b64', 'part06.b64'
  ];

  async function rebuildDataUrl(folder, partNames) {
    const pieces = await Promise.all(partNames.map(async name => {
      const response = await fetch(`${folder}/${name}`, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Image introuvable : ${name}`);
      return response.text();
    }));
    return `data:image/jpeg;base64,${pieces.join('').replace(/\s+/g, '')}`;
  }

  function installFavicon(source) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/jpeg';
    link.href = source;
  }

  installFavicon(ICON_FILE);

  const splash = document.createElement('div');
  splash.id = 'officialBrandSplash';
  splash.setAttribute('aria-label', "La Super Ferme d'Élevage d'Animaux Tycoon");
  splash.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:100000',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'background:#000',
    'pointer-events:none',
    'opacity:1',
    'transition:opacity .45s ease'
  ].join(';');

  const image = document.createElement('img');
  image.alt = "La Super Ferme d'Élevage d'Animaux Tycoon";
  image.src = SPLASH_FILE;
  image.style.cssText = [
    'width:100%',
    'height:100%',
    'display:block',
    'object-fit:contain',
    'object-position:center',
    'background:#000'
  ].join(';');
  splash.appendChild(image);
  document.body.prepend(splash);

  image.addEventListener('error', async () => {
    try {
      image.src = await rebuildDataUrl('assets/branding/splash', SPLASH_PARTS);
    } catch (error) {
      console.error('Écran de lancement indisponible', error);
    }
  }, { once: true });

  const iconProbe = new Image();
  iconProbe.src = ICON_FILE;
  iconProbe.addEventListener('error', async () => {
    try {
      installFavicon(await rebuildDataUrl('assets/branding/icon', ICON_PARTS));
    } catch (error) {
      console.error('Icône indisponible', error);
    }
  }, { once: true });

  const startedAt = performance.now();
  let hiding = false;
  function hideSplash() {
    if (hiding) return;
    hiding = true;
    const minimumDisplay = 1650;
    const delay = Math.max(0, minimumDisplay - (performance.now() - startedAt));
    setTimeout(() => {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 480);
    }, delay);
  }

  window.addEventListener('load', hideSplash, { once: true });
  setTimeout(hideSplash, 3200);
})();
