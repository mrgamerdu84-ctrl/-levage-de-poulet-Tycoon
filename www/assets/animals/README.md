# Assets animaux haute qualité

Le jeu charge désormais de vrais modèles glTF/GLB ou, à défaut, des sprites PNG transparents.

## Arborescence attendue

```text
assets/animals/
  manifest.json
  hen/hen.glb
  hen/hen.png
  rooster/rooster.glb
  rooster/rooster.png
  cow/cow.glb
  cow/cow.png
  pig/pig.glb
  pig/pig.png
  sheep/sheep.glb
  sheep/sheep.png
  duck/duck.glb
  duck/duck.png
```

Un seul fichier est obligatoire par espèce :

- le `.glb` est prioritaire ;
- le `.png` transparent sert de secours ;
- si aucun des deux n'existe, le rendu précédent reste visible et le jeu ne plante pas.

## Contraintes recommandées pour Android

- glTF 2.0 au format binaire `.glb` ;
- entre 5 000 et 25 000 triangles par animal ;
- textures PBR de 1024 px maximum sur mobile ;
- origine du modèle au niveau des pattes ;
- animal orienté vers l'axe `+Z` avant la rotation définie dans `manifest.json` ;
- animations facultatives nommées `Idle`, `Walk`, `Eat` ou équivalent ;
- éviter Draco/KTX2 tant que les décodeurs correspondants ne sont pas intégrés.

## Sources d'assets libres possibles

Avant d'intégrer un modèle, conserver sa licence avec le projet et vérifier qu'elle autorise la redistribution dans l'APK.

- Quaternius Farm Animal Pack : https://quaternius.com/packs/farmanimal.html — CC0, FBX/OBJ/Blend.
- Quaternius Ultimate Animated Animal Pack : https://quaternius.com/packs/ultimateanimatedanimals.html — CC0, inclut glTF.
- Kenney Animal Pack Remastered : https://kenney.nl/assets/animal-pack-remastered — CC0, sprites 2D.

Les fichiers provenant d'un pack FBX/Blend doivent être exportés en `.glb` avec Blender avant d'être placés ici.

## Comportement du chargeur

`farm-animal-assets-hq.js` attend qu'un asset soit chargé avec succès avant de masquer les anciennes formes. Les groupes logiques, collisions, déplacements, clics et sons restent attachés aux mêmes animaux.
