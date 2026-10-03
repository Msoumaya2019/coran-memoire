# Coran 1441

Source : https://files.quran.app/hafs/madani_1441/zips/images_1440.zip

SHA-256 : `784682f17e083d529476cb738a53d2f4eb461a925e74b9d167d28a244ed1116e`.

Cette source remplace les deux sources expérimentales « Tawjeed test 2 » et « Medine Test ». Les autres Coran sont conservés. Identifiant interne : `coran_1441` ; intitulé visible : **Coran 1441**. Les anciennes préférences `tawjeed_test_2`, `tajweed_test_2` et `medine_test` migrent vers ce choix sans réinitialiser les données utilisateur.

## Archive analysée

- 604 pages, chacune composée de 15 PNG transparents originaux de 1440 × 232 : 9 060 images, environ 95,6 Mio installés.
- `ayahinfo_1440.db` : `ayah_highlights` (sourate, verset, page, ligne, bornes horizontales normalisées), `ayah_markers` (positions des numéros de versets), `sura_headers` (positions des titres).
- `quran.ar.uthmani.v2.db` : texte original ; le texte n'est pas utilisé pour reconstruire les images.
- Pas de police, audio ou timings dans ce ZIP. Ce Mushaf est monochrome, avec numéros verts ; la source existante avec règles de Tajwid demeure disponible.

## Rendu

Les PNG sont copiés à l'identique, sans OCR, recompression ni conversion en pages aplaties. Le lecteur compose les 15 lignes dans leur ordre original. Comme le [lecteur officiel Quran Android](https://github.com/quran/quran_android/blob/main/feature/linebyline/src/main/java/com/quran/labs/androidquran/extra/feature/linebyline/ui/QuranLine.kt), il respecte le ratio de chaque ligne et distribue leurs positions verticales : `(hauteur - hauteurLigne) / 14 × indexLigne`. L'archive ne contient pas de ratio global de page ; la référence de coordonnées du lecteur est 1440 × 2320, adaptée sans recadrage au viewport.

Les [numéros sont dessinés séparément dans le lecteur officiel](https://github.com/quran/quran_android/blob/main/feature/linebyline/src/main/java/com/quran/labs/androidquran/extra/feature/linebyline/ui/AyahMarker.kt). Ils sont placés ici à partir de `ayah_markers`, avec numération arabe, cercles verts discrets et fond vert très pâle. Les titres calligraphiés sont déjà inclus dans les lignes PNG ; le décor supplémentaire de bandeau de l'application officielle n'est pas contenu dans le ZIP et n'est pas inventé.

Les régions multi-lignes sont exportées pour conserver le hit-testing, l'audio verset par verset, les marque-pages et les parcours apprentissage/révision/consolidation du lecteur commun. Les images adjacentes sont préchargées. Le moteur audio n'est pas remplacé.

## Téléchargement à la demande — Android et iOS

Les 9 060 images ne sont pas incluses dans l'APK ni dans l'IPA. Le script d'import ne génère que les coordonnées et les métadonnées ; aucune dépendance `require()` ne référence les images de cette source. Les autres sources intégrées restent inchangées.

Dans Réglages / Affichage du Coran, sélectionner Coran 1441 ouvre le téléchargement initial (environ 98 Mo), puis l'installation avec progression. Le lecteur propose le même mécanisme dans son sélecteur. La préférence n'est activée qu'après installation réussie. Une préférence ancienne restaurée sans fichiers ouvre également ce panneau, avec possibilité de revenir au lieu d'afficher un Mushaf vide.

`services/quranDownload.ts` utilise le stockage privé Documents d'Expo FileSystem sur les deux plateformes. Le ZIP est téléchargé avec DownloadResumable ; une pause explicite, une sortie du panneau ou la mise en arrière-plan sauvegarde ses données de reprise. Un échec réseau conserve les fichiers locaux, mais peut nécessiter de redémarrer le téléchargement si aucune donnée de reprise native n'est disponible. Une fois le ZIP complet, son extraction reprend sans nouveau téléchargement après une interruption de l'installation.

La décompression fflate est effectuée par blocs de 256 Kio avec restitution régulière de la main à l'interface. Seuls les chemins PNG attendus sont acceptés ; taille du ZIP, signature/dimensions des images et présence des 9 060 lignes sont vérifiées. Le marqueur `ready-v1.json` est écrit uniquement après installation complète. Le ZIP temporaire est ensuite supprimé. Une installation complète est lue directement en `file://`, sans appel réseau ; les coordonnées, numéros et interactions du lecteur restent ceux du lecteur partagé. Aucune migration Supabase supplémentaire.

## Vérifications

TypeScript et 188 tests passent, dont la couverture des 604 pages / 6 236 versets, les coordonnées dans les limites de leur référence et la migration des anciennes préférences. L'aperçu du lecteur réel confirme l'affichage des lignes et des numéros, ainsi que le sélecteur contenant uniquement Coran 1441 à la place des deux tests. Les services audio et de synchronisation de cet aperçu sont simulés : leur vérification native reste nécessaire.

Les demandes de refonte globale du thème blanc et d'annotations de programme uniquement dans la marge sont des travaux distincts ; ce remplacement de source ne les présente pas comme terminés.

Tests du téléchargement : échec sans activation, pause persistée, installation réelle des 9 060 lignes depuis le ZIP officiel, concurrence dédupliquée et seconde ouverture sans réseau. Les exports Expo Android et iOS passent. À vérifier sur appareils physiques : téléchargement / pause / reprise, espace de stockage insuffisant, fermeture forcée, mode avion après installation, et fluidité d’extraction sous Hermes.


## Correctif iOS 0.9.35 (build 47)

Après le signalement ERR_FILESYSTEM_CANNOT_DOWNLOAD, le transfert demande explicitement une session FOREGROUND, au lieu de la session BACKGROUND par défaut. L’application met en pause lors de sa fermeture ou de sa mise en arrière-plan et conserve les données de reprise. Ces données sont utilisées même si le fichier ZIP de destination n’existe pas encore : iOS conserve les octets dans un fichier temporaire natif.

Une reprise périmée ou l’erreur native générique entraîne une seule nouvelle tentative depuis zéro. Seuls le ZIP temporaire et son ancien jeton sont effacés ; les pages déjà installées et les données utilisateur sont conservées. Une pause concurrente ne lance qu’une opération native. L’erreur affichée est explicite et n’expose plus la trace Swift.

Le serveur a répondu HTTP 200 avec la taille attendue 102 608 011 octets. Les tests simulent le refus natif, le jeton périmé, la pause concurrente et l’absence de fichier destination. L’installation des 9 060 lignes à partir du ZIP officiel est également testée. Le téléchargement réel sur l’iPhone ayant signalé l’erreur reste à vérifier après installation de cette version.

Référence API : [Expo FileSystem legacy](https://docs.expo.dev/versions/latest/sdk/filesystem-legacy/) ; comportement confirmé dans les sources natives de la version Expo installée.
