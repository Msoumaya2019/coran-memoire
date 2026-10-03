# Programme, hors connexion et sources expérimentales — 3 octobre 2026

## Dates et progression

Les séances conservent leur `scheduledDate`, avec repli sur l'ancien champ `date`. `completedAt` et `completedDate` décrivent la validation réelle. La validation ne reconstruit plus les séances futures : seuls les passages non encore planifiés sont ajoutés après la dernière date prévue. Une validation anticipée ou tardive ne déplace pas le programme.

Les statuts historiques restent compatibles ; `sessionStatus` expose pending/completed/skipped/partiallyCompleted. Les arrêts précis restent dans `studyProgress`. « À venir » affiche aujourd'hui jusqu'à J+10 inclus ; les retards restent accessibles séparément.

L'objectif hebdomadaire compte les séances d'apprentissage prévues du lundi au dimanche et celles terminées parmi elles. Les calculs utilisent les jours du calendrier local du téléphone, sans durée fixe en millisecondes : le changement d'heure est respecté. Le changement de semaine change uniquement le filtre ; aucun historique n'est supprimé. Une séance future déjà réalisée en avance compte dans sa semaine prévue.

## Révision et consolidation

Les cycles temporels sont conservés. Le mode quantité ajoute 1 Nisf, 1 Hizb, 1 Juz ou 2 Juz par jour. Les unités sont calculées à partir des divisions coraniques et intersectées avec les connaissances : aucun verset inconnu n'est ajouté. Une unité partiellement connue contient uniquement ses versets connus. Les cycles précédents sont conservés dans `reviewCycleHistory`.

Les cartes de consolidation ouvrent le lecteur commun au passage concerné. Une validation explicite crédite le checkpoint attendu ; une protection empêche un double appui de créditer le suivant. J+1/J+3/J+7 sont ancrés au jour d'apprentissage et conservés dans `scheduledDates`. Les dates réelles sont distinctes dans `completedAt` et `consolidationHistory`. La consolidation reste indépendante des validations de révision. Après J+7, le passage est éligible aux prochains cycles normaux.

Le statut Difficile reste persistant, y compris après une bonne révision. Seule sa suppression explicite retire le marquage utilisateur. Le rouge pâle prend priorité visuelle sur le surlignage audio et le marque-page ; les identifiants et interactions restent conservés.

## Hors connexion et migrations

L'interface charge immédiatement l'état SQLite local. La restauration de session et Supabase travaillent en arrière-plan ; leur indisponibilité ne déconnecte pas le compte local. Une première connexion reste en ligne. Les requêtes distantes ont une limite de huit secondes. NetInfo affiche discrètement l'absence réelle de réseau et la reconnexion.

La session native est transférée vers SecureStore (Keychain/Keystore), en morceaux ASCII ; l'ancien stockage n'est retiré qu'après réussite de la migration. Le navigateur conserve son stockage web habituel.

Migration SQLite rétrocompatible : table `pending_sync` (`id`, `user_id`, `payload`, `created_at`, `base`). Chaque mutation sauvegarde l'état local et une opération dans la même transaction. La transmission est sérialisée, relancée au retour du réseau et au premier plan. Les snapshots sont regroupés pour l'envoi ; seuls les IDs présents avant l'envoi sont supprimés après confirmation serveur. Les nouvelles mutations restent en attente. L'upsert du snapshot est idempotent.

Une fusion base/local/distant conserve les modifications explicites locales et récupère les champs distants non modifiés localement ; les historiques et validations sont réunis. Il reste une fenêtre de concurrence possible entre lecture distante et upsert si deux appareils écrivent exactement simultanément : aucun verrou serveur atomique n'a été ajouté.

**Supabase : aucune migration SQL, aucune nouvelle table, aucune modification RLS.** Les nouveaux champs sont dans le JSON existant `user_state.data`. Les données et réglages existants sont conservés.

## Fichiers concernés

- Métier : `src/core/program.ts`, `review.ts`, `studyProgress.ts`, nouveaux `weeklyProgress.ts`, `offlineAccess.ts`, `offlineQueue.ts`, `offlineMerge.ts`, `quranSources.ts`, `sourceNavigation.ts`.
- Stockage/réseau : `src/services/storage.ts`, `sync.ts`, nouveaux `authStorage.ts`, `offlineSync.ts`, `connectivity.ts`.
- Interface : `src/App.tsx`, `ReviewDashboard.tsx`, `MushafPage.tsx`, `coranTest/html.ts`, `ui/StudySession.tsx`, `ui/theme.tsx`.
- Sources : `assets/quran-tests/`, `src/data/quran-tests/`, `scripts/import-quran-zips.py`.
- Configuration : `app.json` (0.9.32, build 44), `package.json`, `pnpm-lock.yaml`, `metro.config.js`, `scripts/preview-design.cjs`.
- Tests : `tests/program-offline.test.cjs`, `auth-storage.test.cjs`, ajustement de `review.test.cjs` pour la difficulté persistante.

## Vérifications

184 tests passent : dates normales/anticipées/tardives, prolongation d'un ancien programme, J+10, dimanche/lundi, changement d'heure Europe/Paris, historiques, consolidation anticipée et double validation, quatre quantités de révision, difficulté persistante, fusion et file de synchronisation, mutations pendant l'envoi, migration sécurisée de session et deux sources complètes.

TypeScript passe. Les exports Expo Android et iOS passent. Les sources ont été ouvertes dans l'aperçu des composants réels, avec changement de source et validation de consolidation indépendante. L'aperçu simule les services natifs ; ce n'est pas un test physique.

À vérifier sur Android/iPhone : démarrage en mode avion après connexion, session expirée hors connexion puis retour réseau, fermeture forcée pendant synchronisation, son/Bluetooth/interruptions, pinch/swipe et zones tactiles, safe areas, grande taille installée des sources expérimentales. Les ZIP n'apportent aucun audio ni timing nouveau : le moteur audio existant est conservé.

Voir `QURAN_ZIP_COMPARISON.md` pour l'analyse séparée des archives.
