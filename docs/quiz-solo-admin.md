# Quiz solo et réponses administrateur

Exécuter `supabase/quiz-solo-admin.sql` après l’installation Quiz existante. La migration ajoute seulement les sessions/réponses solo et trois RPC, et retire la contrainte qui imposait un titre de source. Aucune réponse historique ni question existante n’est supprimée.

Le mode solo est accessible depuis Quiz. Chaque série tire jusqu’à 10 questions actives, non supprimées, sans doublons et dans toutes les catégories, indépendamment du réglage « Disponible pour les défis ». Une connexion et un compte sont nécessaires. La correction est renvoyée après chaque réponse enregistrée côté serveur ; une nouvelle tentative garde le premier choix. Le score est affiché en fin de série. Quitter la fiche conserve la série tant que l’écran Quiz reste monté ; une nouvelle ouverture peut commencer une autre série, tandis que les réponses déjà envoyées restent consultables par l’administrateur.

Dans Admin → Quiz → Réponses des utilisateurs, consulter toutes les réponses par pages de 50, ou « Voir les réponses » sur une question pour filtrer. Le rapport indique le compte, la date, le mode, la question originale, la réponse, sa correction et l’identifiant du quiz. Il couvre aussi les réponses déjà enregistrées aux questions du jour et aux défis. Les intitulés et corrections utilisent les snapshots historiques, même si une question est modifiée ensuite.

Source et explication sont facultatives. La question, trois ou quatre réponses non vides, la bonne réponse et les contraintes de publication restent obligatoires. Les nouvelles fonctions vérifient les comptes et les droits administrateur côté serveur ; les bonnes réponses solo ne sont pas exposées au démarrage.
