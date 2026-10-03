# Lecteur 0.9.36 — centrage et changement de source

## Modifications
- `src/ui/QuranSessionHeader.tsx` : barre commune compacte en haut, verte, avec pages réelles et cycle de consolidation. Absente en lecture normale. Actions de validation existantes réutilisées.
- `src/App.tsx` : viewport pleine largeur commun, annotations indépendantes, suppression des capsules du bas et du Mushaf Tajwid. Source active distincte de la source en préparation ; page numérique, séance et progression conservées.
- `src/services/quranSourceReady.ts` : vérification de la page, préparation des images Expo, des polices/HTML Tajwid ou des 15 fichiers locaux Coran 1441 avant activation.
- `src/core/quranSourceTransition.ts` : sérialisation des changements, commit après préparation, annulation du commit si le lecteur ferme.
- `src/coranTest/CoranTestScreen.tsx` et `PageSurface.tsx` : initialisation de la page courante avant préchargement des voisines ; erreur récupérable sur place, bouton Réessayer, récupération après terminaison du processus WebView.
- `package.json`, `tests/quran-source-transition.test.cjs`, `scripts/preview-design.cjs`, `app.json` : tests, aperçu des quatre modes et version 0.9.36 / build 48.

## Erreur identifiée
Deux traitements d’erreur Tajwid affichaient une alerte proposant de fermer le lecteur, même pour une page voisine préchargée. Le sélecteur activait également immédiatement la préférence et recalculait la page avant préparation de la nouvelle source. Ces chemins sont remplacés par une préparation asynchrone avant commit et une reprise sur place. Une erreur de ressource conserve la source précédente. Une erreur du rendu WebView permet de réessayer sans navigation.

## Vérifications réalisées
- TypeScript sans erreur ; 201 tests réussis, dont attente de préparation, échec/reprise, fermeture pendant préparation et conservation du contexte dans les quatre modes et les deux directions.
- Exports Expo Android et iOS réussis.
- Aperçu du code réel sur largeur 440 : lecture, apprentissage, révision, consolidation. Centre des pages images : 220 exactement. Centre Tajwid : 219,993 à 219,995, différence inférieure à 0,01 px.
- Sur largeur 375, les quatre pages images ont un centre de 187,5 exactement.
- Huit transitions UI Médine ↔ Tajwid : page 396 conservée pour lecture/apprentissage/consolidation ; page 404 conservée pour révision. Barre et repères de séance conservés, aucun retour accueil.
- Mesures : `docs/qa/reader-centering.json`. Captures : `docs/qa/reader-*-top.png` et `tajwid-*-top.png`.

## Limites à vérifier sur appareil
L’aperçu navigateur utilise une préparation simulée pour les services Expo natifs ; le rendu Tajwid et les actions de sélection utilisent les composants réels. Le chargement Expo Asset, WKWebView iOS, Safe Area/Dynamic Island, téléchargement Coran 1441 et transitions pendant l’audio doivent encore être vérifiés sur un vrai iPhone, notamment Pro Max. Les fichiers Mushaf, polices, pagination et moteurs métier n’ont pas été remplacés. Aucune migration Supabase.
