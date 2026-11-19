# Mode tablette et cahier d’annotations

Branche : `feat/tablet-notebook`. Application Expo uniquement. Aucune modification du projet Swift/SwiftUI séparé.

## Fonctionnalités

- Réglages « AFFICHAGE ET APPAREIL » : mode Automatique/Activé/Désactivé, outils visibles, dessin au stylet uniquement (par défaut). Préférences conservées dans le stockage et la synchronisation existants.
- Détection `expo-device`, adaptation aux dimensions réelles de la fenêtre, orientation libre. Barre verticale et panneau de notes en paysage ; outils flottants et volet superposé en portrait. Plein écran conservant les annotations.
- Calque SVG indépendant : stylo/encre/crayon, surligneur transparent, ellipse, soulignement, flèche, gomme, sélection, notes, annuler/rétablir. Six couleurs, quatre épaisseurs de stylo et quatre de surligneur.
- Dessin enregistré à la fin du trait. Commentaires et notes manuscrites enregistrés automatiquement après modification, à la fermeture de l’éditeur et au passage en arrière-plan. Suppression avec tombstone ; annuler/rétablir conserve la compatibilité avec la fusion hors ligne.
- Appui long sur un mot mesuré du Coran Tajwid : surligner, entourer, souligner, commenter, écouter/répéter le verset et le marquer difficile. Le menu permet d’élargir la sélection au verset. Les notes restent associées à leur édition et page.
- « Mes annotations » et cahier global : filtres par sourate/page/couleur/type/favoris/difficulté, tris par date et catégories, retour à l’édition et à la page, favoris et passages maîtrisés. La difficulté utilise les révisions prioritaires existantes ; « maîtrisé » dans le cahier ne valide pas artificiellement une séance de mémorisation.
- Double page droite-vers-gauche en paysage, navigation par paires et retour automatique à une page si l’espace est insuffisant. Chaque page conserve son propre calque et son ratio.
- Lecteur audio existant conservé. Le dessin n’arrête pas l’audio ; le suivi automatique ne tourne pas la page pendant l’annotation ou un export.
- Export local natif d’une page PNG, de 1 à 20 pages PDF, ou des notes textuelles filtrées/sélectionnées. Les exports de pages capturent le rendu original et ses annotations, sans reconstruire le texte arabe. Les PDF conservent le ratio des captures.

## Architecture et données

Les pages QPC Tajwid, glyphes, fontes couleur et données de positionnement restent inchangés. `ReaderPrintedPage` compose le lecteur existant, sans remplacer les pages. Les autres éditions continuent d’utiliser `MushafPage` et leurs images originales.

Les coordonnées des traits sont normalisées par rapport à la page imprimée, après inversion du zoom/déplacement. Les ancrages QPC sont résolus à partir des identifiants de mots réellement mesurés. Les éditions images n’ont pas de positions fiables par mot : sélection au verset et passage proposé vers le Tajwid pour choisir un mot. Aucun rectangle de mot approximatif n’est généré.

Le stockage SQLite par compte, la file hors ligne et la synchronisation Supabase existants sont réutilisés. Les nouveaux champs des annotations sont optionnels et compatibles avec les anciennes données. Une synchronisation provenant d’un ancien client conserve les préférences tablette et ne fait pas réapparaître une annotation supprimée.

Le rendu courant ne transmet que la géométrie des marques au WebView, pas les commentaires ni les notes manuscrites privées. Les tracés en cours sont rendus au rythme des frames ; la sauvegarde intervient en fin de geste, pas à chaque mouvement. Le cahier et les listes de notes sont virtualisés.

## Fichiers

Nouveaux composants :

- `src/ui/ReaderPrintedPage.tsx`, `NativeInkSurface.tsx`, `TabletToolbar.tsx`, `TabletSettings.tsx`
- `src/ui/AnnotationNotebook.tsx`, `AnnotationExportDialog.tsx`
- `src/core/tablet.ts`, `tabletInk.ts`, `annotationExport.ts`
- `src/services/tabletDevice.ts`, `annotationExport.ts`
- `src/coranTest/inkLayer.ts`

Extensions : `src/App.tsx`, `MushafPage.tsx`, `ui/ReaderAnnotationEditor.tsx`, `ReaderAnnotationMarks.tsx`, `ReaderMoreSheet.tsx`, `ZoomableReader.tsx`, `coranTest/CoranTestScreen.tsx`, `html.ts`, `model.ts`, `annotationLayer.ts`, `core/readerAnnotations.ts`, `core/program.ts`, `app.json`, `package.json`, `pnpm-lock.yaml`.

Tests ajoutés : `tests/tablet-notebook.test.cjs`, `tests/native-ink.test.cjs` ; tests des gestes HTML étendus dans `tests/contextual-annotations.test.cjs`, environnement de simulation ajusté dans `tests/reader-zoom.test.cjs`.

Dépendances Expo 57 : `expo-device ~57.0.2`, `expo-print ~57.0.2`, `expo-sharing ~57.0.21`, `react-native-view-shot 5.1.0`. `react-native-svg` et `react-native-webview` déjà présents sont réutilisés. Une nouvelle compilation native est nécessaire.

## Vérification et limites

Les tests automatisés couvrent détection/adaptation téléphone/tablette, portrait/paysage, fenêtres réduites, paires RTL, migration et restauration, séparation des éditions, fusion des suppressions, filtres/favoris/maîtrise, pression facultative, coordonnées normalisées, gomme, annuler/rétablir, validation des exports, gestes HTML et mesures natives asynchrones.

Contrôle visuel dans un aperçu web des vrais composants, avec services réseau/audio simulés : tablette 1180×820, portrait 768×1024, smartphone 393×852, dessin et commentaire, retour après changement de page, double page, favoris, cahier, plein écran et réglages.

À vérifier sur appareils physiques avant publication :

1. iPhone et smartphone Android : lecture/audio, menus contextuels, restauration après fermeture complète.
2. iPad/Apple Pencil et tablette Android/stylet actif : pression transmise, paume, zoom à deux doigts, rotation et fenêtres partagées.
3. PNG et PDF natifs : capture du WebView, couleurs Tajwid, annotations et partage du fichier sur les deux OS.
4. Synchronisation réelle entre deux comptes/appareils, nombreux traits, mémoire et fluidité lors de sessions longues.

La pression est appliquée uniquement lorsque le périphérique transmet une valeur ; aucun support matériel universel ni rejet de paume garanti n’est revendiqué. Le bloc-notes manuscrit d’un commentaire utilise le composant existant et ne module pas la pression. Les commentaires manuscrits sont consultables dans l’application ; un export textuel indique leur présence mais ne les convertit pas en texte. Les captures de pages exportent le calque visible ; elles n’ajoutent pas les commentaires de l’éditeur en annexe. Le texte reste exportable sur web ; PNG/PDF sont réservés aux applications iOS/Android. Le dessin libre et l’export de page sont réservés aux éditions à mise en page fixe, pas à la lecture simplifiée qui se réorganise.
