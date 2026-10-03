# Signalements — 0.9.38 (50)

Accueil → sous Ma semaine → Un problème avec l’application ?
Bottom sheet : Bug / Affichage / Audio / Notification / Autre, description obligatoire (500 caractères maximum), capture facultative JPEG/PNG (5 Mo maximum), bouton Envoyer à l’administrateur.

Administration → Problèmes de l’application : description, type, date, version, plateforme, compte, capture privée, marquer comme traité ou rouvrir.

## Supabase
Migration additive : supabase/problem-reports.sql.
Table app_problem_reports avec RLS. Les utilisateurs soumettent et lisent leurs propres signalements ; seuls les administrateurs peuvent consulter tous les signalements et modifier leur statut.
Bucket privé problem-report-screenshots ; propriétaire et administrateur uniquement. Les captures sont ouvertes via une URL signée valable cinq minutes.
L’utilisateur a confirmé l’exécution du SQL le 3 octobre 2026. La présence de la table et le refus d’accès anonyme ont été vérifiés sur le serveur.

## Hors ligne
SQLite coran-problem-reports.db conserve la file par utilisateur. Les captures sélectionnées sont copiées dans le stockage persistant de l’application avant la mise en file. En cas de perte de réseau, un message confirme la sauvegarde locale. L’envoi reprend à la reconnexion et au retour dans l’application.
L’identifiant du signalement sert à la déduplication. Une erreur après l’enregistrement serveur ne crée pas de doublon. L’opération et la copie locale sont supprimées uniquement après lecture de confirmation du serveur. Les opérations d’un autre compte ne sont pas envoyées.

## Vérifications
Tests PostgreSQL : accès privés, soumission propre, captures, limites de description, traitement administrateur et reprise sans doublon.
Tests du service : persistance du signalement et de sa capture après fermeture, reprise après perte de confirmation, suppression de la copie locale après confirmation, isolation des comptes.
Aperçu : carte sous Ma semaine, ouverture de la feuille, choix du type, compteur, bouton désactivé sans description, confirmation et absence d’erreur console. Aucun signalement fictif envoyé en production.
La galerie photo, le clavier et la Safe Area native restent à vérifier sur iPhone réel.
