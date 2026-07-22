# Élevage de Poulet Tycoon — Android / Capacitor

Jeu de ferme avicole 3D conçu pour Android avec **Capacitor** et **Three.js**.

## Fonctionnalités présentes

- paysage décoré avec herbe, chemins, clôtures, arbres et fleurs
- soleil, lune, étoiles, nuages, pluie et cycle jour/nuit
- poules, coq et poussins modélisés en 3D low-poly
- fermier qui nourrit les poules et fermier qui collecte les œufs
- mangeoire, abreuvoir, poulailler ouvert et huit nids
- ponte visible et couvaison des œufs fécondés avant l’éclosion
- transport manuel des œufs jusqu’à l’usine
- tapis roulant animé avec rouleaux visibles
- emballage en caisses, stockage dans l’entrepôt et livraisons par camion
- compteur de production, caisses, livraisons et pièces
- caméra tactile, vue d’ensemble, vue usine et vitesse ×1 / ×2 / ×4

## Organisation du jeu

- `www/index.html` : interface et chargement de la scène
- `www/core.js` : moteur Three.js et décor naturel
- `www/world.js` : bâtiments, animaux, fermiers et véhicules
- `www/simulation.js` : comportements, ponte, couvaison, usine, météo et livraisons
- `android/` : projet Android natif généré pour Capacitor

## Compiler l’application Android

```bash
npm install
npx cap sync android
npx cap open android
```

Dans Android Studio, utilise **Build > Generate Signed Bundle / APK** pour créer l’APK.

Le projet charge actuellement Three.js depuis un CDN : une connexion internet est donc nécessaire au premier affichage. Une prochaine amélioration pourra intégrer Three.js directement dans l’application pour fonctionner entièrement hors ligne.
