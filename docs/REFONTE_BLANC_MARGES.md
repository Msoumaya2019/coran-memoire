# Refonte 0.9.34 (build 46)

## Fichiers et composants

- `src/theme/tokens.ts`, `fonts.ts`, `src/ui/theme.tsx` : thème blanc, accents, espacements, rayons, ombres, Cormorant et Amiri embarqués. Le Mushaf conserve ses polices propres.
- `src/ui/DesignSystem.tsx`, `Premium.tsx` : composants communs, navigation, boutons, cartes, médaillon, sélecteurs, progression.
- `src/ui/MainScreens.tsx`, `AppearanceScreen.tsx`, `GoalScreen.tsx` : écrans principaux, apparence et objectif utilisant les moteurs existants.
- `src/App.tsx`, `DailyContentsScreen.tsx`, `SocialScreens.tsx`, `PassageAudioPlayer.tsx`, `StudySession.tsx` : branchements et interface ; moteurs audio, services sociaux et logique de validation conservés.
- `src/core/marginAnnotations.ts`, `src/coranTest/html.ts`, `model.ts`, `MushafPage.tsx` : repères indépendants, coordonnées originales, suppression du seul surlignage de programme.
- `src/core/program.ts`, `offlineMerge.ts` : préférences rétrocompatibles et union des pages lues.
- Images : `assets/themes/white.png` et `assets/illustrations/`.

## Données et reprise

`theme`, `accent`, `readPages` et l’échéance optionnelle `goal.deadline` restent dans le JSON utilisateur existant, stocké localement et synchronisé par les services actuels. Pas de nouvelle table ni migration SQL Supabase. Les anciennes préférences restent valides ; une réponse d’un ancien client ne supprime pas l’accent local.

La progression d’apprentissage/révision continue d’utiliser les enregistrements `studyProgress` existants : ID de séance, plage canonique, dernier verset validé, source et dates. Seule une validation explicite modifie ces données. La reprise utilise le premier verset non validé ; l’état appris reste distinct de révisé.

Les menus Page/Verset réutilisent `SelectField` et les fonctions de plage existantes. Sourates et versets proposés sont limités au passage réel. Le Programme affiche les dates prévues du moteur et sa fenêtre existante de dix jours.

## Contrôles

- TypeScript : réussi.
- Tests : 193 réussis, zéro échec.
- Exports Expo Android et iOS : réussis.
- QA visuelle et preuve géométrique : voir `docs/design-qa.md`.
- Builds natifs : lancés via les workflows GitHub existants après publication du commit.

## À vérifier sur appareils

iPhone 17 Pro Max et petit iPhone : safe areas, Dynamic Island, tailles de texte système, changements de thème après relancement, zoom/paysage des quatre sources, lecture audio et répétitions, microphone, notifications, téléchargements hors ligne et synchronisation Supabase après reconnexion. L’IPA du workflow est non signé et nécessite la procédure de signature/installation habituelle.
