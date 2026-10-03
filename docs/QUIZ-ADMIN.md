# Administration Quiz

## Accès
Administration → Quiz → Questions du jour / Quiz thématiques · 10 questions.

## Questions du jour
Créer une question avec 3 ou 4 réponses, sa bonne réponse, son explication et sa source. Cocher « Question du jour », choisir sa date de publication et l’activer. Une contrainte serveur empêche deux questions quotidiennes actives à la même date. Une question peut aussi être disponible pour les défis.

## Quiz thématiques
Nommer le quiz, choisir son thème et sélectionner exactement dix questions actives disponibles pour les défis. Modifier, dupliquer, activer/désactiver ou supprimer le quiz depuis la liste. Les défis déjà créés gardent leurs questions et corrections d’origine.

Lors de la création d’un défi, choisir ce quiz thématique ou des questions aléatoires (5 ou 10). Un quiz thématique contient toujours dix questions. Les deux participants reçoivent les mêmes questions ; les solutions restent côté serveur jusqu’à la fin des deux participants.

## Installation Supabase
Migrations à appliquer dans cet ordre, après les migrations existantes d’administration, amis et notifications :
1. supabase/quiz.sql
2. supabase/quiz-notifications.sql

Le fichier supabase/quiz-install.sql regroupe ces deux étapes et peut être collé dans l’éditeur SQL Supabase.

Ces migrations ont été vérifiées dans PostgreSQL local avec PGlite. L’utilisateur a confirmé leur application le 3 octobre 2026 ; la présence des tables et fonctions protégées a été vérifiée sur le serveur.

Tables ajoutées : quiz_questions, quiz_daily_responses, quiz_challenges, quiz_challenge_questions, quiz_challenge_answers, quiz_sets. Les accès passent par des fonctions sécurisées et l’identité de l’administrateur existant. Les données utilisateur existantes ne sont pas remplacées.

Une suppression de question est un archivage interne : elle disparaît de l’administration mais reste disponible pour confirmer une réponse déjà enregistrée hors ligne.
