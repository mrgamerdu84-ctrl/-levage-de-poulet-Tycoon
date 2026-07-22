# Élevage de Poulet Tycoon — Android / Capacitor

Jeu d’exploitation avicole 3D conçu pour Android avec **Capacitor** et **Three.js**.

## Étape actuelle : l’exploitation de poulets

Cette version revient au design original du projet et se concentre volontairement sur le poulailler. Les usines, tapis roulants, entrepôts et camions ont été retirés pour le moment.

### Fonctionnalités présentes

- paysage agricole avec herbe, terrain, clôtures, arbres, buissons et chemin
- poulailler, mangeoire, abreuvoir, stockage du grain et nids en paille
- six poules avec plumage, ailes, pattes, crête, bec et yeux bien visibles
- un coq plus grand avec crête, barbillon et longues plumes de queue
- fermiers qui viennent remplir la mangeoire
- poules qui mangent, boivent, rejoignent leur nid et pondent
- coq qui rejoint une poule et rend ses prochains œufs fécondés
- œufs non fécondés qui restent visibles dans le nid avant le ramassage
- œufs fécondés qui doivent être couvés par une poule couveuse
- poussins qui apparaissent uniquement après la fin de la couvaison
- poussins avec yeux, bec, pattes et déplacements visibles
- compteurs d’œufs pondus, d’œufs fécondés et de poussins nés
- caméra tactile et bouton de remise à zéro de la vue
- sons des poules et du coq en touchant les animaux

## Organisation du jeu

- `www/index.html` : interface originale améliorée
- `www/game-core.js` : moteur Three.js, éclairage, textures et sons
- `www/game-world.js` : terrain, poulailler, nids et décoration agricole
- `www/game-actors.js` : fermiers, poules, coq et poussins
- `www/game-loop.js` : déplacements, ponte, fécondation, couvaison et éclosion
- `android/` : projet Android natif Capacitor

L’ancienne version avec usine est conservée dans la branche `archive/ancienne-version-usine`.

## Compiler l’application Android

```bash
npm install
npx cap sync android
npx cap open android
```

L’Action GitHub compile automatiquement l’APK et le publie dans **Releases → APK de test - dernière version**.

Le projet charge actuellement Three.js depuis un CDN : une connexion internet est nécessaire au premier affichage. Une amélioration future pourra intégrer Three.js directement dans l’application pour fonctionner entièrement hors connexion.
