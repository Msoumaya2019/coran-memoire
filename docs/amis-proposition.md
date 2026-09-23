# Proposition : apprendre avec des amis

Cette proposition a été retenue. Les écrans et le schéma Supabase sont présents dans le code. Leur mise en service demande l’exécution de `supabase/social.sql` et une vérification avec plusieurs comptes.

## Fonctionnement proposé

1. Chaque personne crée un compte et reçoit un code d'invitation à partager.
2. Une invitation doit être acceptée avant que les deux profils soient visibles l'un à l'autre.
3. La fiche d'un ami accepté montre son statut en ligne, le nombre de versets appris cette semaine, le pourcentage de son objectif atteint et l'endroit exact de son prochain passage (sourate et versets).
4. Les données se mettent à jour après une séance. L'indication « en ligne » concerne l'application ouverte, pas une surveillance permanente du téléphone.
5. Chaque personne peut retirer un ami, bloquer une invitation et masquer son statut en ligne ou son passage exact. Par défaut, les amis acceptés voient toutes les informations demandées.

## Idées supplémentaires à choisir

- **Encouragement discret** : envoyer un message prédéfini comme « Qu'Allah te facilite » après une séance, sans messagerie libre à modérer.
- **Objectif partagé facultatif** : deux amis se fixent un nombre de séances par semaine et voient leur propre avancement côte à côte, sans classement public.
- **Rendez-vous de révision** : proposer une heure de révision commune ; chacun garde son propre programme et ses propres résultats.
- **Petit cercle privé** : trois à cinq proches peuvent suivre une progression résumée, avec acceptation individuelle de chaque membre.

## Protection des données

L'historique complet, les erreurs de récitation, les notes personnelles et les mots de passe restent privés. Le serveur publie uniquement un résumé destiné aux amis acceptés ; les règles d'accès doivent vérifier l'amitié active pour chaque lecture. La présence en ligne doit être transmise dans un canal réservé aux personnes autorisées. Supprimer une amitié retire immédiatement l'accès futur.

L'implémentation devra être testée avec deux comptes acceptés et un troisième compte non autorisé, sur iPhone et Android. La synchronisation hors ligne devra conserver l'historique privé sans afficher une présence en ligne erronée.
