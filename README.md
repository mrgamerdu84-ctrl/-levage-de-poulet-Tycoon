# Ferme Avicole 3D — application Android (Capacitor)

Ce dossier contient la structure d'un projet **Capacitor** qui embarque la scène 3D
(`www/index.html`) dans une WebView Android native, prête à être compilée en `.apk`.

⚠️ **Important** : ces fichiers ont été écrits à la main pour reproduire exactement ce que
génère `npx cap add android`, car je n'ai pas d'accès réseau pour exécuter la commande
moi-même. Il te manque deux choses que seul un environnement avec internet peut fournir :

1. Les dépendances npm (`node_modules/`, notamment `@capacitor/android`)
2. Le binaire `gradle-wrapper.jar` (Android Studio le régénère automatiquement à l'ouverture)

## Étapes pour finaliser (sur ton ordinateur, avec Node.js + Android Studio installés)

```bash
# 1. Installer les dépendances Capacitor
npm install

# 2. Synchroniser (copie www/ dans le projet Android + génère les fichiers manquants
#    capacitor.settings.gradle / capacitor.build.gradle correctement)
npx cap sync android

# 3. Ouvrir le projet dans Android Studio
npx cap open android
```

Dans Android Studio :
- Laisse-le synchroniser Gradle (il régénère le wrapper automatiquement)
- Clique sur ▶️ pour lancer sur un émulateur ou un téléphone branché
- Ou **Build > Generate Signed Bundle / APK** pour obtenir un `.apk` à installer directement

## Pousser ce dossier sur GitHub

Le projet est versionné dans ce dépôt GitHub privé.

## Pourquoi passer par une app native ?

La scène utilise WebGL (three.js) et Web Audio — certains aperçus de navigateur intégrés
(comme celui d'un chat) peuvent être plus restrictifs qu'une vraie WebView Android. Empaqueter
avec Capacitor donne un rendu plus fiable et cohérent sur un vrai téléphone.

## Personnalisation
- Nom de l'app / package : modifiable dans `capacitor.config.json` (`appId`, `appName`)
- Icône de lancement : remplace le placeholder via **Android Studio > New > Image Asset**
- Le contenu 3D lui-même : `www/index.html`
