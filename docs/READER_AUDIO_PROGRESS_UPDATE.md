# Sources, audio, thèmes et progression

## Changements

L’option tajweedPages n’est plus proposée. Les chargements SQLite et la restauration
Supabase migrent ce choix vers coranTest sans toucher aux autres champs. La clé
coranTest est conservée pour les comptes et les marques-pages ; son nom visible est
« Coran avec règles de Tajwid ». Aucun changement de schéma Supabase.

Le fond racine et les régions de safe area reprennent le fond pastel du thème.
Les contrôles restent dans SafeAreaView. Lecture simplifiée utilise la largeur et
la hauteur disponibles, sans le calcul de ratio réservé aux images ; texte adapté
à la largeur, scroll conservé et barre basse inchangée. Les vrais Mushaf conservent
leur ratio, pages, coordonnées, surlignage translucide sans cadre et navigation.

Objectif atteint utilise le grand cercle, son vrai ratio et son arc rose.
Coran mémorisé utilise le petit cercle et le pourcentage global. Le reste de
l’écran Progrès est conservé.

## Audio et preuve IPA

Le binaire App.framework/App de l’IPA contient EveryAyah et les trois dossiers :
Ghamadi_40kbps, Yasser_Ad-Dussary_128kbps, Nasser_Alqatami_128kbps.
Chaque fichier est identifié par sourate sur trois chiffres + verset sur trois
chiffres. Cette approche du lecteur original est réutilisée dans le résolveur
existant, avec ses callbacks, préchargement et répétitions. Aucun timestamp d’un
réciteur n’est appliqué à un autre. Abu Bakr Shatri reste le choix par défaut.
Les IDs ar.ghamidi / ar.dussary / ar.qatami sont conservés pour les préférences.
La pause technique est 200 ms ; pause utilisateur = max(200 ms, pause configurée),
sans addition de deux délais. La fin de fichier précède toute transition.

Sources vérifiées :
- https://everyayah.com/data/Ghamadi_40kbps/
- https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/
- https://everyayah.com/data/Nasser_Alqatami_128kbps/

Chaque index contient les 6 236 fichiers attendus. Six MP3 par réciteur ont répondu
avec contenu audio, dont Fatiha 1/2/7, Saffat 3/4 et Nas 6. Cela vérifie la source,
pas la qualité acoustique de toutes les découpes. Aucun silence naturel n’est retiré.

## Validation

TypeScript valide, 135 tests réussis : migration locale/compte distant, préférences,
6 236 URL uniques par nouveau réciteur, Fatiha 1–7 pour les sept récitateurs,
répétitions et annulation/pause/suivant existants, marge 200 ms.
Aperçus 320×568 et 440×956, quatre thèmes et hiérarchie des cercles inspectés.
Un texte vide envoyé à View dans le lecteur a été corrigé. Les avertissements
web existants shadow/pointerEvents sont des dépréciations, pas des erreurs natives.
Le navigateur ne simule pas les vraies safe areas, le microphone ou le moteur natif.

À tester sur iPhone réel, en priorité 17 Pro Max : zones système et Home Indicator,
les quatre thèmes, petits/grands passages simplifiés, reprise après fermeture,
Fatiha 1–7 avec les trois nouveaux récitateurs, chaque verset ×3 et passage ×3,
Pause/Play/Arrêt/Suivant, enregistrement et synchronisation habituels.

## Fichiers

src/App.tsx ; src/MushafPage.tsx ; src/PassageAudioPlayer.tsx ; src/ui/Premium.tsx ;
src/core/audio.ts ; src/core/program.ts ; src/services/storage.ts ;
src/coranTest/CoranTestScreen.tsx ; src/coranTest/PageSurface.tsx ;
src/coranTest/PageSurface.web.tsx ; src/coranTest/html.ts ;
tests/audio.test.cjs ; tests/continuous-player.test.cjs ; tests/source-migration.test.cjs.
