# Quiz et centrage du lecteur — 0.9.37 (49)

## Fonctionnalités
Accueil : grille 2 × 2 Apprentissage/Révision, Quiz/Amis ; cinq onglets conservés.
Quiz : question quotidienne, réponse unique verrouillée, correction depuis le serveur, historique et statistiques.
Défis : amis existants, 5/10 questions aléatoires ou quiz thématique de dix questions, expiration 48 h, questions identiques figées pour les deux participants, solutions masquées jusqu'à la fin des deux joueurs.
Administration : questions avec catégorie/source/date et quiz thématiques, modification, duplication, activation/désactivation et suppression.
Notifications : invitation, premier participant terminé, résultat, question quotidienne ; préférence Quiz et déduplication.
Hors ligne : cache SQLite par utilisateur et file persistante ; opération supprimée après confirmation serveur uniquement.
Lecteur classique Médine/1441 : centrage vertical dans le viewport mesuré, sans changer les dimensions, ratio, pages ou gestes ; coordonnées tactiles corrigées du décalage. Les modes de séance gardent leur disposition.

## Supabase
quiz-install.sql regroupe quiz.sql et quiz-notifications.sql.
L'utilisateur a confirmé leur exécution le 3 octobre 2026. Présence des tables et fonctions protégées vérifiée sur le serveur ; accès anonyme refusé.
Tables : quiz_questions, quiz_daily_responses, quiz_challenges, quiz_challenge_questions, quiz_challenge_answers, quiz_sets et journal privé quiz_notification_events.
Préférences ajoutées : quiz_enabled, quiz_timezone. Aucune donnée existante remplacée.
Les questions supprimées sont archivées pour préserver les réponses hors ligne et historiques.

## Vérifications
TypeScript et 206 tests : réussite.
Tests PostgreSQL via PGlite : sécurité, unicité quotidienne, snapshots, scores, expiration, notifications, sélection de dix questions distinctes.
Tests du service hors ligne : persistance après redémarrage, isolation des comptes, reprise après perte de confirmation avec un seul enregistrement serveur.
Exports Expo iOS/Android : réussite.
Aperçu des composants réels : accueil, Quiz, correction rouge/verte, verrouillage des réponses, administration et formulaire thématique.
Centrage 1441 à 440×900 et 375×812 avec les lignes originales : écart horizontal nul et vertical inférieur à 0,001 pixel. Médine vérifié ; apprentissage garde la barre haute et son placement.

## Vérifications restantes sur appareil
Audio, réception des notifications et Safe Area native restent à vérifier sur un iPhone réel. Les aperçus emploient des fixtures isolées sans créer de contenu religieux ni de défi en production. L'IPA GitHub est non signée et doit être signée pour installation.
