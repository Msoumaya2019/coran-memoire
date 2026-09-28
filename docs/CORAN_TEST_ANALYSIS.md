# Coran Test — analyse et intégration (0.9.24, build 36)

## Découvertes dans l’IPA

Archive Flutter : 2 805 entrées, environ 306 Mo décompressés. L’application embarque
`quran_library` dans `Payload/Runner.app/Frameworks/App.framework/flutter_assets/packages/quran_library/assets/`.
La capture sert à comparer le rendu de la page 10 ; aucune OCR ni reconstruction du texte n’a été utilisée.

### Source du Mushaf : polices couleur + JSON

- 604 polices `fonts/quran_fonts_qfc4/QCF4NNN_COLOR-Regular.ttf.gz`.
- Vrais glyphes de mots : `jsons/qpc-v4.json.gz` (83 668 entrées, numéros de versets compris).
- Composition des lignes : `jsons/qpc_v4_ayah_info.json.gz` (9 046 lignes, avec titres et Basmala).
- Texte arabe par mot : `jsons/qpc-hafs-word-by-word.json.gz`.
- Métadonnées des 114 sourates et 6 236 versets : `jsons/quranV4.json.gz`.
- Polices de titres et Basmala, séparateur SVG original de sourate.

Le rendu principal n’est pas constitué de 604 images ou d’un PDF. Les polices
contiennent les dessins de calligraphie et les tables couleur OpenType `COLR v0` / `CPAL`.
Les fichiers JSON imposent les mots de chaque ligne et les lignes de chaque page.
Les ornements et les numéros de versets sont également de vrais glyphes.

L’import conserve les contours, tables et palettes dans des WOFF2 sans rasterisation.
Les ressources de polices ajoutent environ **51,3 Mo** avant compression du paquet applicatif.
`assets/coran-test/provenance.json` conserve le SHA-256 de l’IPA et de chaque police source.
Le script d’import est reproductible et refuse un mot dont un glyphe manque dans la police de sa page.

### Pagination et Tajweed

Les limites originales de toutes les lignes sont conservées, y compris les versets
sur plusieurs lignes ou pages. Le Tajweed vient des palettes de la police, sans
recoloration heuristique du texte arabe. Chaque page utilise une seule échelle de
police et une justification RTL, puis une transformation uniforme `contain`.

Comme la source est typographique, elle ne fournit pas une largeur/hauteur d’image.
Le canevas logique de présentation est **1000 × 2120**, choisi pour le ratio du visuel
fourni. Ce sont des dimensions de rendu, pas des dimensions prétendument extraites
d’une image de l’IPA. Il conserve les glyphes sans les étirer ni couper de texte.
Le libellé « Page de gauche » de la référence n’est pas une commande ajoutée au lecteur.

## Mappings et coordonnées

| Donnée | Disponible dans les ressources inspectées | Réutilisation |
|---|---|---|
| Sourate/verset | Oui | Clé standard `2:66` et identifiant global actuel |
| Page → versets | Oui | Index généré à partir des mots réellement présents |
| Verset → pages/lignes | Oui | Plusieurs pages/lignes possibles par verset |
| Mot → verset/ligne | Oui | Identifiant original et numéro de mot préservés |
| Rectangles/polygones fixes | Non trouvés dans ces JSON | Mesure du rendu réel |
| Coordonnées de mots fixes | Non trouvées | Mesure des éléments de mots |

Les mots sont rendus individuellement avec leurs vrais glyphes et identifiants.
Après chargement des polices, le moteur de mise en page mesure leurs rectangles et
les normalise par rapport au canevas rendu. `verseRegions` fusionne les mots d’un
même verset **sur la même ligne seulement**. Exemple : `2:66`, page 10, lignes 8 et 9,
conserve deux régions. Aucune région estimée à partir d’une capture n’est utilisée.

Le calque `verse-overlay` existe, sans visibilité ni capture des gestes. La première
version n’active aucune sélection ni aucun surlignage. Ces régions sont des boîtes
de mise en page, pas des contours exacts de chaque lettre.

## Analyse audio : faits et limites

### IPA

Les frameworks `just_audio` et `audio_service` sont embarqués. `Info.plist` déclare
le mode d’arrière-plan `audio`. Le binaire contient notamment les domaines
`cdn.islamic.network`, `everyayah.com`, `audio.qurancdn.com`,
`download.quranicaudio.com`, `audio-cdn.tarteel.ai` et `mp3quran.net`.
`quranV4.json.gz` contient des MP3 par identifiant global de verset :
`https://cdn.islamic.network/quran/audio/128/ar.alafasy/73.mp3` pour `2:66`.
Les gros MP3 locaux repérés sont surtout des adhans, pas un corpus complet de récitations.

Le [code public de quran_library](https://github.com/alheekmahlib/quran_library),
inspecté au commit `230b4b7218d1fc56e51e7f165830c15e9ce4efe2`, montre une playlist
`just_audio` de fichiers par verset, téléchargement/cache local, fenêtre de quatre
pistes et ajout progressif de pistes. `sequenceStateStream.currentIndex` associe la
piste à l’identifiant global du verset, met à jour sa sélection et change de page.
Les opérations de préparation sont attendues et les anciennes subscriptions annulées.
`audio_service` prépare les commandes système/arrière-plan ; les sources EveryAyah
emploient notamment les noms sourate/verset à six chiffres.

**Limite :** ce code public éclaire la bibliothèque identifiée, mais ne prouve pas
que tous ses chemins sont utilisés, sans modifications, dans cette IPA précise.
Le Dart applicatif est compilé. Aucun moteur compilé n’est transplanté et l’IPA
n’a pas été exécutée sur un appareil. La précision de ses répétitions, les respirations,
la récupération réseau, les interruptions, Bluetooth et sa consommation mémoire
ne peuvent donc pas être garanties. Une IPA iOS ne démontre pas le comportement Android.
Les fichiers séparés donnent une frontière naturelle de piste ; aucun timestamp
ou trimming universel des versets n’a été trouvé dans les métadonnées embarquées.

### Application actuelle et comparaison

L’application conserve `PassageAudioPlayer`, Expo Audio, `audioFocus`, la file
d’opérations natives, les annulations de sessions, les répétitions et les préférences.
Elle utilise un fichier continu de sourate avec timestamps lorsque disponible,
ou les fichiers de versets en secours, avec préchargement. La marge existante de
**350 ms** et la correction des limites audio restent inchangées.

| Sujet | Bibliothèque identifiée dans l’IPA | Application actuelle |
|---|---|---|
| Lecture native | just_audio / Flutter | Expo Audio / React Native |
| Enchaînement | Playlist de fichiers, index de piste | Sourate/timestamps ou fichiers, transition sérialisée |
| Préparation | Cache disque, fenêtre de pistes | Préchargement et cache existants |
| Synchronisation | Index → verset → page | Position/événements → verset → page |
| Répétitions | Comportement exact de l’IPA non vérifié | Modes verset/passage et annulation déjà testés |
| Arrière-plan | audio_service + mode audio iOS | Configuration Expo Audio existante |
| Performance réelle | Non mesurée | Pas de nouveau benchmark physique |
| Portabilité | Moteur compilé non réutilisable directement | Déjà intégré aux deux plateformes |

Il n’existe pas de preuve suffisante pour remplacer le moteur actuel. La meilleure
approche pour cette étape est de conserver ce moteur et d’adopter le mapping par
mot/ligne du nouveau Mushaf. `testAudioAdapter` réutilise directement le résolveur
audio, les récitateurs et l’algorithme de répétition existants. Aucun audio n’est lancé
par Coran Test et aucun nouveau lecteur natif n’est créé.

## Intégration, cache et persistance

- Entrée **Coran → Coran Test**, et choix dans le menu d’affichage du lecteur.
- Source indépendante : les préférences Médine/Tajweed et l’apprentissage ne sont pas remplacés.
- WebView existante utilisée pour les polices couleur originales ; même générateur HTML pour l’aperçu web.
- Seulement la page, avec ses éléments imprimés d’origine, sans interface audio ni commandes.
- Swipe vers la droite : page suivante ; vers la gauche : page précédente.
- Préparation de N−1/N/N+1, trois surfaces maximum, cache de cinq documents HTML.
- La page précédente reste visible jusqu’à ce que les polices de la nouvelle page soient prêtes.
- Les pages voisines sont exclues de l’accessibilité et des gestes.
- Assets embarqués hors ligne ; pas d’API nécessaire pour lire le Mushaf.
- `reader.testPage` conserve la page dans la structure SQLite/JSON du compte.
  Les swipes sauvegardent localement ; la fermeture utilise la synchronisation habituelle.
- Retour Android : bouton/geste système. iOS : geste depuis le bord gauche vers la droite.
- Safe areas conservées, status bar masquée. L’orientation portrait de l’application est conservée.
- Aucun changement de table Supabase, aucune migration, aucune donnée supprimée.

## Sécurité et provenance

L’IPA comporte une configuration Firebase. Aucun identifiant Firebase, token,
credential, exécutable, framework ou configuration de service de cette application
n’a été copié dans le projet. `roots.pem` est un paquet de certificats racines publics
gRPC, pas une clé privée de signature. L’analyse statique n’établit pas l’absence
universelle de secrets dans un binaire compilé.

L’utilisateur a confirmé ses droits sur les ressources de l’IPA. La bibliothèque
publie du code sous MIT ; les ressources QCF/QUL ont leurs propres conditions,
documentées par son [NOTICE](https://github.com/alheekmahlib/quran_library/blob/main/NOTICE).
Seules les ressources indépendantes nécessaires au Mushaf ont été importées.

## Fichiers

Créés : `src/coranTest/{CoranTestScreen,PageSurface,PageSurface.web}.tsx`,
`src/coranTest/{model,html,loadPage,loadPage.web,resources}.ts`, 604 JSON de pages,
`verse-index.json`, `ornament.json`, `assets/coran-test/`, `metro.config.js`,
`scripts/import-coran-test.py`, `tests/coran-test.test.cjs`, ce rapport.

Modifiés : `src/App.tsx`, `src/core/program.ts`, `package.json`, `pnpm-lock.yaml`,
`scripts/preview-design.cjs`, `app.json`. Dépendance ajoutée : Expo Asset 57.0.18,
compatible avec le SDK déjà présent. Les workflows existants sont conservés.

## Vérifications et test manuel

TypeScript passe. Les **122 tests** passent : corpus exact, absence de mots perdus
ou dupliqués, 604 polices WOFF2, index multi-lignes, voisinage, calque invisible,
adapter audio et tests existants de lecture/répétition/révision/comptes.
L’aperçu navigateur vérifie le rendu original des pages 1, 10 et 604, les swipes
10 → 11 → 10, ainsi que plusieurs tailles de viewport. Voir `design-qa.md`.

Sur les nouvelles applications : ouvrir **Coran → Coran Test**, feuilleter dans les
deux sens, revenir avec le geste système, rouvrir et vérifier la page conservée.
Répéter hors ligne, après fermeture complète, sur petit/grand iPhone et Android.
Vérifier aussi les lecteurs habituels, le Tajweed, l’audio et une séance d’apprentissage.

Les builds natifs sont lancés via les workflows Android/iOS habituels. Leur état
final et leurs liens sont communiqués dans le compte rendu. Les essais sur appareils
physiques iOS/Android restent à effectuer : l’aperçu navigateur ne les remplace pas.
