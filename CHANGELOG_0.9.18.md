# Version 0.9.18 — build 30

- Lecteur compact : paramètres actifs, progression, modes ouvert / réduit / masqué, gestes et bouton flottant. Le moteur reste monté et le suivi du verset reste indépendant de la présentation.
- Lecture par fichiers de versets avec préchargement des trois suivants. Micro-pause de 650 ms à chaque transition ; la pause utilisateur s’ajoute uniquement lors des répétitions.
- Abu Bakr Shatri par défaut. Les choix existants sont conservés ; les nouveaux choix sont associés au compte et synchronisés dans user_state.
- Connexion ou création de compte avant l’onboarding. Restauration distante avant ouverture ; reprise de l’étape incomplète, y compris sur un nouveau téléphone.
- Inscription push vérifiée et protection contre un changement de compte pendant l’inscription. Déconnexion par identifiant d’installation. Diagnostic sans jeton dans l’interface.
- Suivi privé des tickets et receipts des messages privés et notifications administrateur dans Supabase.
- Rappel quotidien facultatif à 19 h, utilisant le système Expo Notifications existant.

## Vérifications

TypeScript : aucune erreur. 65 tests automatisés réussis.
La migration push-delivery-monitor.sql a été appliquée au projet Coran : RLS active, collecte cron active, deux fonctions d’envoi enveloppées et filtres/payloads conservés.

## Diagnostic iPhone réellement observé

Le 27 septembre, Expo a retourné InvalidCredentials : aucun credential APNs pour fr.coranmemoire.app dans @scichiker/coran-memoire. Le statut HTTP 200 ne signifiait pas que l’envoi était accepté.
Trois appareils iOS et trois Android étaient inscrits. Le flux d’envoi ne filtre pas iOS et l’UPSERT unique sur expo_push_token est installé.
Le profil fourni par l’utilisateur contient aps-environment=production mais application-identifier=8X875FW73T.app.vanilla267.aquila7798. Son certificat embarqué est Apple Distribution, et non un certificat serveur APNs.
Aucun certificat, credential ni bundle identifier n’a été changé. Les fichiers de signature n’ont pas été copiés dans le projet.

Une réception réelle sur iPhone reste bloquée tant qu’un credential APNs compatible avec l’identifiant réellement signé n’est pas fourni et associé au projet. Une compilation seule ne corrige pas cette absence. Les essais sur appareils physiques restent nécessaires.
