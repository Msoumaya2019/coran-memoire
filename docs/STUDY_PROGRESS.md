# Apprentissage et révision partiels

Les deux modes partagent StudyBanner, StudyCompletionSheet et StudyResumeCard. Le lecteur immersif conserve son espace de page ; le bandeau est placé dans la ligne du Juz et du nom arabe pour le rendu QPC.

## Sauvegarde et reprise

`AppState.studyProgress` utilise des clés `learning:sessionId` / `revision:taskId`. Chaque enregistrement conserve les bornes canoniques prévues, la dernière position validée, la page et sa source, le statut partial/completed et les validations datées. L’absence d’enregistrement signifie not_started. Les identifiants canoniques permettent de reconstruire sourate/verset sans ambiguïté, y compris au changement de sourate.

La sauvegarde réutilise les JSON SQLite et la synchronisation Supabase existants, sans migration SQL. Annuler ou fermer ne modifie aucun état. La reprise ouvre la position validée + 1 dans la pagination de la source choisie.

Seule la validation explicite marque les connaissances apprises. Elle conserve les consolidations existantes, sans créer une révision effectuée. Le mode révision évalue uniquement la portion explicitement validée et maintient le reste à faire. Les journées manquées ne suppriment pas la séance partielle.

## Sélecteurs

Sourates et versets sont limités à la partie restante du programme. Le changement de sourate sélectionne son premier verset autorisé. Le mode Page conserve un endpoint canonique et ne coupe jamais un verset entre deux pages. Les pages entièrement validées et les pages en cours restent distinguées.

## Vérifications

TypeScript sans erreur et 160 tests réussis. Sur aperçu local : bannière QPC page 396, choix des deux sourates réellement présentes, versets 85–88 seulement pour Al Qasas, validation jusqu’à 87, Programme et reprise à 88 ; Annuler conserve 0/9 ; Révision pages 404–405 et validation de la page 404 ; petit écran 320×568 avec défilement de la fiche. Les rendus Rose Poudré et Bleu Nuit sont contrôlés. Les validations sur iPhone et Android réels restent nécessaires : safe areas, clavier/scroll des listes, audio, enregistrement et persistance après fermeture/reconnexion.

## Fichiers concernés

- `src/App.tsx` : lecteur, validation, navigation de reprise, Programme et statistiques.
- `src/MushafPage.tsx`, `src/ReviewDashboard.tsx` : bandeau et cartes de reprise.
- `src/coranTest/{CoranTestScreen.tsx,model.ts,html.ts}` : événement du bandeau et intégration dans la ligne originale du Mushaf.
- `src/core/{program.ts,review.ts}` : persistance, séances partielles, consolidation et cycle.
- Nouveau `src/core/studyProgress.ts` : bornes, unités, validation explicite et reprise.
- Nouveau `src/ui/StudySession.tsx` : StudyBanner, StudyCompletionSheet et StudyResumeCard.
- `tests/{study-progress.test.cjs,reader-zoom.test.cjs,coran-test.test.cjs}`, `package.json` : tests et compilation des modules métier.
- `scripts/preview-design.cjs` : parcours de contrôle local, sans effet sur les données de production.
- `app.json` : version 0.9.31, build 43.
- Documentation : ce rapport, `design-qa.md`, captures dans `study-screenshots/`.

Les compilations finales utilisent le commit 323dde6 ; les ajouts documentaires suivants ne changent pas le code compilé.
