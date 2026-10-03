# Comparaison des deux ZIP Quran.app

Les deux sources sont expérimentales, indépendantes et sélectionnables. Aucune source existante n'est supprimée ni remplacée.

| Propriété | Tawjeed test 2 | Medine Test |
|---|---|---|
| Identifiant | `tawjeed_test_2` | `medine_test` |
| Archive | [images_1280.zip](https://files.quran.app/hafs/tajweed/zips/images_1280.zip) | [images_1352.zip](https://files.quran.app/hafs/madani_1440/zips/images_1352.zip) |
| Rendu | 604 PNG originaux, couleurs Tajwid intégrées | 604 PNG originaux du Mushaf madani_1440 |
| Dimensions réelles | 1340 × 1890 | pages 1–2 : 1014 × 1628 ; autres : 1352 × 2170 |
| Coordonnées | `ayahinfo_1280.db`, 83 881 entrées glyphes/positions | `ayahinfo_1352.db`, 13 273 segments |
| Régions verset/ligne exportées | 13 744 | 13 273 |
| Couverture | 604 pages, 6 236 versets | 604 pages, 6 236 versets |
| PNG embarqués | environ 132,1 Mio | environ 117,5 Mio |

## Contenu et méthode originale

Chaque ZIP contient les images paginées et quatre bases : ayahinfo, quran.ar, quran.ar.uthmani, quran.ar.uthmani_simple. Les bases de texte comportent texte et index FTS ; Uthmani comporte aussi du texte de partage. La table `glyphs` contient page, ligne, sourate, verset, position et min/max X/Y.

Il n'y a pas de police TTF/OTF, SVG, HTML/CSS, composant d'application, dépendance de rendu, audio, récitant ou timestamp dans ces archives. On ne peut donc pas en déduire le moteur audio de l'application. Le Tajwid de la première archive est déjà coloré dans les PNG ; aucune table sémantique de règles/couleurs n'est fournie.

Les données Tawjeed sont plus fines et conservent glyph_id/position. Cela ne constitue pas un alignement texte-mot garanti. Medine fournit principalement des segments de verset par ligne, à ne pas présenter comme des coordonnées individuelles de mots.

## Intégration

Le script d'import conserve chaque PNG sans conversion, OCR ou redimensionnement. Il exporte les dimensions réelles, les coordonnées originales et les régions regroupées par verset/ligne, séparément pour chaque source. Les données brutes avec glyphes et positions restent disponibles dans les fichiers `*-words.json`.

Le lecteur commun utilise les dimensions de chaque page et des régions normalisées. Un verset peut avoir plusieurs régions. Les index de pagination propres aux sources servent à l'ouverture des passages, à l'audio, aux marque-pages et aux validations. L'audio existant pilote les identifiants sourate/verset ; les archives n'apportent pas de nouvelle découpe audio.

Les 604 pages et toutes leurs coordonnées ont été vérifiées dans les dimensions réelles des images. Les images sont embarquées pour l'ouverture hors connexion, avec préchargement adjacent. Elles gardent leur ratio naturel sans recadrage ; selon le ratio du téléphone, un espace libre peut rester. Les overlays suivent la même transformation que l'image.

## Avantages et limites

Tawjeed permet la comparaison immédiate d'un Mushaf coloré fidèle à son image originale. Medine permet la comparaison d'une édition papier différente avec ses propres coordonnées. Les deux sont compatibles avec le lecteur immersif, les identifiants de versets, l'apprentissage, la révision, la consolidation, les difficultés et les marque-pages.

Les PNG n'ont pas la netteté illimitée d'un vecteur à très fort zoom. Les deux sources ajoutent environ **249,6 Mio de ressources PNG installées**, avant compression du paquet : ce coût est réel pour une comparaison entièrement hors connexion. Les performances natives et la consommation mémoire doivent être mesurées sur téléphone. Aucune édition n'est choisie définitivement à ce stade.

SHA-256 des archives analysées :

- Tawjeed : `3b4e87837ea961102c77a670a913e68e24a2b7bd9fd1ef0aa320ee17c569c40a`
- Medine : `14c5bf1e82a0e6a89b2a8c73636c3d968c1d79a6ac058832831d52544fbeceeb`
