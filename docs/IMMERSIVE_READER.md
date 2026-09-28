> État historique build 37. Le layout actuel sans header est décrit dans SESSION_VOICE_IPA_AUDIO.md.

# Lecteur immersif commun — 0.9.25 / build 37

## Interface

Médine, Tajweed, Coran Test et Lecture simplifiée utilisent le même écran existant.
Un en-tête de 46 points contient Retour, la sourate/page dynamique et Plus d’options.
La barre flottante comporte Écouter, Traduction et Marque-page. La page conserve
son ratio et utilise l’espace disponible sans texte caché derrière les commandes.
Le menu permet de masquer toutes les commandes ; un toucher sur le Mushaf les
fait réapparaître. L’audio et son suivi restent montés indépendamment des commandes.

Les options conservent : changement de sourate, pages précédente/suivante,
traduction, marques-pages, enregistrement vocal, récitateur/répétitions/vitesse,
choix du Coran et, selon le contexte, validation/report de l’apprentissage ou
Parfait/Quelques hésitations/À retravailler en révision.

## Coran Test

Sélection persistante dans Réglages → Affichage du Coran ou dans le lecteur.
Les polices, glyphes et lignes originales sont conservés. Le WebView reçoit
seulement l’état du calque et ne recharge pas la page à chaque changement de verset.
Les zones sont mesurées sur le rendu réel et regroupées par verset/ligne.
Le moteur Expo Audio existant reçoit les mêmes identifiants globaux.

56 versets n’appartiennent pas à la page indiquée par les anciennes images :
`testPageRange` et `testVersePage` utilisent donc l’index original pour le suivi,
« Toute la page », la traduction et la reprise. Un verset présent sur plusieurs
pages conserve la page actuelle tant qu’il y apparaît.

Un marque-page reste un seul enregistrement par verset. `sourcePages` conserve
en JSON la page exacte du Mushaf concerné ; le numéro canonique antérieur est
conservé pour les autres sources. Aucun schéma SQL ou migration n’est nécessaire.

## Fichiers

- `src/App.tsx` : lecteur commun, choix du Coran, menu et contexte de séance.
- `src/ui/ImmersiveReaderChrome.tsx` : en-tête et trois actions flottantes.
- `src/coranTest/{model,html,CoranTestScreen,PageSurface,PageSurface.web}` : index,
  interaction et calques, sans deuxième moteur audio.
- `src/PassageAudioPlayer.tsx` : plage de page optionnelle selon la source ; moteur
  et répétitions existants conservés, micro-pause inchangée à 350 ms.
- `src/core/{program,bookmarks}.ts`, `src/BookmarksScreen.tsx` : préférence et reprise.
- `tests/coran-test.test.cjs` : pagination réelle, calques et persistance.
- `scripts/preview-design.cjs`, `app.json` : aperçu et version.

## Vérifications

TypeScript et 125 tests passent. Dans l’aperçu : ouverture des commandes communes,
traduction de la page 10, enregistrement de 2:66 avec deux zones, reprise depuis
Mes marques-pages, lecteur audio partagé avec Abu Bakr Shatri et changement vers
le Coran Tajweed. L’audio/microphone natifs ne sont pas simulés comme tests physiques.
Les builds Android/iOS utilisent les workflows existants ; leurs liens et résultats
sont fournis au compte rendu. Les essais sur appareils physiques restent à réaliser.

## Test manuel

1. Réglages → Affichage du Coran : choisir chaque source, fermer et rouvrir.
2. Ouvrir Lecture puis une séance d’apprentissage et une révision : vérifier le
   passage, le menu, la validation et l’enregistrement.
3. Écouter : tester les modes, répétitions et surlignage ; réduire/masquer le lecteur.
4. Marque-page : choisir un verset, ouvrir Mes marques-pages et Reprendre ; vérifier
   après redémarrage et synchronisation sur un autre appareil.
5. Coran Test : page 10, verset 2:66 sur deux lignes, puis un verset à pagination
   différente ; contrôler « Toute la page », traduction et changement automatique.
6. Plus d’options → Lecture plein écran : toucher pour retrouver les commandes.
7. Petits/grands iPhone et Android : safe areas, barres, swipe et ratio.

## Compilations GitHub validées

Code compilé : `3b5d6d36def77a3376392879c81e7cb14e9c22f8`.

- [APK Android réussi](https://github.com/Msoumaya2019/coran-memoire/actions/runs/36408807127).
- [IPA iOS non signée réussie](https://github.com/Msoumaya2019/coran-memoire/actions/runs/36408810583).
- Version 0.9.25, build 37. Les artefacts sont disponibles dans chaque exécution.
- Tests et TypeScript passent dans les deux workflows. Aucune migration Supabase.
