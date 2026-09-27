# Lecture, marques-pages et lecteur compact

## Modifications

- Lecture et apprentissage utilisent la même disposition : en-tête compact, page ajustée au conteneur mesuré, flèches flottantes et barre inférieure. La ligne Page X / 604 et l’instruction de swipe ont disparu de Lecture.
- Lecture : Écouter, Traduction, Marque-page, Plus d’options. Apprentissage conserve ses quatre actions, l’enregistrement et les validations dans les options.
- Le toucher est traduit en coordonnées réelles de l’image, puis associé au verset avec les zones déjà utilisées pour le suivi audio. Toutes les zones de ce verset sont surlignées par une couche UI, sans retoucher le Mushaf.
- Les marques-pages enregistrent verseId, sourate, ayah, page, création, mise à jour et dernière reprise. Une suppression est conservée pour éviter qu’un ancien état cloud ne rétablisse le marque-page.
- Reprendre ouvre Lecture à la page et au verset exacts. La liste affiche le vrai texte arabe et la dernière reprise ; la suppression demande une confirmation.
- Le panneau audio est superposé au-dessus de la barre, avec une limite liée à la hauteur mesurée. Les réglages avancés peuvent l’agrandir temporairement. Le lecteur natif et les timelines restent réutilisés.
- Mishary Rashid Alafasy est le choix initial si aucune préférence valide n’existe. Un choix enregistré est restauré ; une sélection faite pendant la restauration n’est pas écrasée.

## Base de données

Aucune table, policy, migration ni variable d’environnement ajoutée. Les marques-pages étendent le JSON AppState déjà persisté dans SQLite et synchronisé dans Supabase pour le compte connecté. Hors connexion, la sauvegarde locale reste disponible. Aucun nouveau média ajouté.

## Vérifications effectuées

- TypeScript : tsc --noEmit, réussi.
- Tests : 59 réussis, aucun échec. Dont trois tests de persistance, unicité et fusion/suppression des marques-pages ; répétitions 1/2/3/5 ; suivi audio continu ; changement de dimensions et isolation des comptes.
- Export Expo/Hermes iOS et Android : réussi, 2173 modules par plateforme. Il s’agit de bundles compilés, pas de nouveaux APK/IPA installables.
- Aperçu des composants réels à 320, 393 et 430 px : Lecture, séance, ouverture du panneau compact, réglages avancés, passage page/sourate/verset, répétition 5, plein écran, swipe, pagination, sélection et reprise d’un marque-page.
- L’aperçu remplace les services natifs : il ne valide pas la réception réseau réelle, le son, le microphone ni une relance physique. Aucun test sur iPhone/Android physique réalisé ici.
- Aucun script lint disponible dans package.json.

## Vérifications sur téléphone

1. Lecture → Marque-page → toucher un verset. Vérifier le surlignage de toutes ses lignes et la confirmation.
2. Plus d’options → Mes marques-pages → Reprendre. Vérifier sourate, page et verset. Fermer complètement l’application, rouvrir et retrouver le marque-page.
3. Supprimer avec confirmation. Après synchronisation puis reconnexion, vérifier qu’il reste supprimé. Vérifier aussi la sauvegarde en mode avion.
4. Programme → séance → Écouter un récitateur. Vérifier Ma séance, Ce verset, Toute la page, Toute la sourate et les répétitions 1/2/3/5 avec le surlignage audio.
5. Choisir un autre récitateur puis rouvrir le lecteur et relancer l’application : le choix doit rester conservé. Sans préférence, Mishary est sélectionné.
6. Changer plusieurs fois de page, swiper, entrer/sortir du plein écran ; contrôler les safe areas sur iOS et Android. Tester traduction et enregistrement existants.

## Fichiers modifiés

- [src/App.tsx](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/src/App.tsx)
- [src/MushafPage.tsx](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/src/MushafPage.tsx)
- [src/PassageAudioPlayer.tsx](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/src/PassageAudioPlayer.tsx)
- [src/core/audio.ts](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/src/core/audio.ts)
- [src/core/program.ts](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/src/core/program.ts)
- [src/ui/Premium.tsx](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/src/ui/Premium.tsx)
- [package.json](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/package.json)
- [scripts/preview-design.cjs](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/scripts/preview-design.cjs)
- [tests/audio.test.cjs](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/tests/audio.test.cjs)
- [tests/continuous-player.test.cjs](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/tests/continuous-player.test.cjs)

## Nouveaux fichiers

- [src/BookmarksScreen.tsx](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/src/BookmarksScreen.tsx)
- [src/core/bookmarks.ts](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/src/core/bookmarks.ts)
- [tests/bookmarks.test.cjs](C:/Users/mchik/Documents/Codex/2026-09-22/projet-application-mobile-de-m-morisation/outputs/coran-memoire/tests/bookmarks.test.cjs)
