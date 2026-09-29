# Apprentissage et révision partiels

Les deux modes partagent StudyBanner, StudyCompletionSheet et StudyResumeCard. Le lecteur immersif conserve son espace de page ; le bandeau est placé dans la ligne du Juz et du nom arabe pour le rendu QPC.

## Sauvegarde et reprise

`AppState.studyProgress` utilise des clés `learning:sessionId` / `revision:taskId`. Chaque enregistrement conserve les bornes canoniques prévues, la dernière position validée, la page et sa source, le statut partial/completed et les validations datées. L’absence d’enregistrement signifie not_started. Les identifiants canoniques permettent de reconstruire sourate/verset sans ambiguïté, y compris au changement de sourate.

La sauvegarde réutilise les JSON SQLite et la synchronisation Supabase existants, sans migration SQL. Annuler ou fermer ne modifie aucun état. La reprise ouvre la position validée + 1 dans la pagination de la source choisie.

Seule la validation explicite marque les connaissances apprises. Elle conserve les consolidations existantes, sans créer une révision effectuée. Le mode révision évalue uniquement la portion explicitement validée et maintient le reste à faire. Les journées manquées ne suppriment pas la séance partielle.

## Sélecteurs

Sourates et versets sont limités à la partie restante du programme. Le changement de sourate sélectionne son premier verset autorisé. Le mode Page conserve un endpoint canonique et ne coupe jamais un verset entre deux pages. Les pages entièrement validées et les pages en cours restent distinguées.

## Vérifications

TypeScript et tests métier exécutés. Contrôle visuel et interactions sur aperçu local en cours au lancement des compilations. Les validations sur iPhone et Android réels restent nécessaires : safe areas, clavier/scroll des listes, audio, enregistrement et persistance après fermeture/reconnexion.
