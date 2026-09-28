# Voix en séance et priorité audio IPA

## Interface

La dernière consigne remplace la barre contextuelle par cinq actions communes :
Accueil / Écouter / Enregistrer / Marque-page / Plus, pour toutes les sources et
les contextes. Aucun header n’est rendu. La région Mushaf mesure la hauteur réelle
restante après la barre basse dans le flux normal ; les coordonnées restent calculées
sur la taille réelle. Les pages sont alignées en haut, sans décalage négatif.

Plus contient quatre cartes pastel. La traduction y est accessible. Les actions de
séance sont conservées via Affichage du Coran → Actions de la séance, les actions par verset via
l’appui long, et la liste des marques-pages via son bouton dédié. Le bouton Accueil
sauvegarde la position et revient à l’onglet Accueil. Le menu se ferme par X, fond
ou glissement depuis la poignée. La barre reste visible. Changer de sourate inclut
une entrée de page 1–604 ; les réglages audio ouvrent les paramètres existants.

Le composant RecitationRecorder existant reçoit un mode compact. Le même
microphone, format, lecteur d’aperçu, saveLocalRecitation et synchronisation sont
utilisés. Terminer crée un brouillon ; Réécouter et Recommencer précèdent la
sauvegarde explicite. Pause/Reprendre conserve la prise. Les commandes de
navigation sont bloquées durant l’enregistrement et les opérations en cours.
Les autres usages du composant conservent leur présentation et leur comportement.

## Audio : preuve et changement effectif

L’IPA a été rouverte : quranV4.json.gz fournit exactement 6 236 URLs MP3,
identifiants globaux 1 à 6 236, pour ar.alafasy/128. Toutes correspondent à la
recette de src/data/ipa-audio-source.json ; le SHA-256 du JSON gzip y est conservé.
Aucun fichier universel de timings de récitation n’a été identifié dans ces assets.

Ces fichiers étaient déjà le secours du lecteur. Ils deviennent maintenant
prioritaires : chapterAudio retourne null par défaut avant tout chargement de
sourate/timestamps. Le résolveur existant utilise la base CDN originale, les IDs
Hafs actuels et le récitateur personnel conservé. Pour Mishary, les URLs sont
exactement celles du JSON de l’IPA. Pour les autres récitateurs existants, la même
source par verset est utilisée ; l’IPA ne fournit pas leur corpus complet dans ce
JSON. Il n’est pas affirmé que leurs MP3 sont identiques à une lecture testée de l’IPA.

La vraie fin du fichier remplace la coupure estimée dans une sourate continue.
Préchargement des trois prochains versets, callbacks protégés, opérations natives
sérialisées, répétitions et surlignage existants sont conservés. La micro-pause de
350 ms est inchangée. La voie timestamps reste disponible explicitement dans le
service, sans être choisie par le lecteur ; aucun deuxième moteur n’est créé.
Les respirations ou silences présents dans un MP3 ne sont pas retirés arbitrairement.
La qualité acoustique comparative requiert une écoute sur appareils réels.

## Validation

TypeScript et 130 tests passent : sauvegarde après aperçu seulement, pause/reprise,
réécoute, recommencer sans sauvegarder, barre commune à cinq actions, priorité fichiers
sans accès aux timestamps, répétitions, transitions et annulations existantes.
Aperçu du Coran Tajweed en révision sur 320×568 : microphone et panneau compact,
Mushaf conservé. Microphone et son natifs restent à vérifier sur iPhone/Android.

Test manuel : ouvrir Programme → Apprentissage puis Révision, enregistrer,
mettre en pause, reprendre, terminer, réécouter, recommencer, sauvegarder et
vérifier Mes récitations ainsi que la synchronisation administrateur habituelle.
En Lecture normale, vérifier Plus → Traduction française. Dans tous les contextes, utiliser Plus → Traduction française. Écouter As Sâffât 3–5 en chaque verset ×3 puis passage ×3 : aucune
fuite du verset suivant ; arrêt/pause/suivant et changement de récitateur à tester.

Aucune migration Supabase ni changement de bucket.

## Fichiers

Modifiés : src/App.tsx, src/ui/ImmersiveReaderChrome.tsx, src/SurahPicker.tsx,
src/RecitationRecorder.tsx, src/PassageAudioPlayer.tsx, src/coranTest/html.ts,
src/core/audio.ts, src/services/quranAudioTimeline.ts, scripts/preview-design.cjs.
Créés : src/ui/ReaderMoreSheet.tsx, src/data/ipa-audio-source.json,
tests/recorder-compact.test.cjs et ce rapport.

Un brouillon conserve les versets de début/fin de la prise même si la page change
avant sa sauvegarde. L’ouverture du microphone annule aussi la file de répétition.
