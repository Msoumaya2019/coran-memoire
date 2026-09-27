# Lecteur audio, connexion et push — livraison 0.9.18

## Fichiers modifiés

- src/PassageAudioPlayer.tsx : présentation compacte, trois états animés, progression, préférences par compte, arrêt à la fin du fichier et pause technique.
- src/core/audio.ts : constante DEFAULT_AYAH_GAP=650, Shatri par défaut.
- src/App.tsx : intégration plein écran, parcours connexion/création de compte, restauration avant affichage, étape d’onboarding persistée, diagnostics et rappel opt-in.
- src/core/program.ts : métadonnées de compte et restauration du cloud prioritaire sur un téléphone neuf, conservation des préférences et marques-pages lors d’une remise à zéro de l’apprentissage.
- src/services/sync.ts : propagation des erreurs d’authentification pour éviter de confondre erreur réseau et compte vide.
- src/services/notifications.ts : inscription/presence/déconnexion vérifiées, diagnostic de livraison, rappel local quotidien.
- tests/accounts.test.cjs, tests/audio.test.cjs, tests/continuous-player.test.cjs : restauration, préférence par défaut, transitions et répétitions protégées par la micro-pause.
- scripts/preview-design.cjs : aperçu local des composants réels, audio et services simulés pour la seule vérification visuelle.
- app.json : version/build.

## Nouveau fichier SQL

supabase/push-delivery-monitor.sql : journal privé sans jetons complets ni contenu des messages ; suivi des tickets/receipts. RLS sans accès direct client. RPC ne retourne que les dix derniers statuts du destinataire authentifié. Collecte chaque minute. Appliqué avec autorisation explicite après rejet initial de la revue automatique.
Aucune nouvelle variable d’environnement.

## Tests reproductibles sur téléphone

1. Sans session, ouvrir l’app : Connexion / Création de compte. Se connecter au compte existant : vérifier programme/progression avant tout onboarding.
2. Compte neuf : confirmer l’adresse, remplir deux étapes, fermer et reprendre. Refaire sur un second téléphone avec ce même compte.
3. Lecture et Apprentissage : ouvrir le lecteur, lancer le passage, réduire, masquer, rouvrir ; le son et le surlignage doivent continuer. Essayer aussi le plein écran.
4. Répéter un verset puis un passage ×2/×3/×5/×10/infini : chaque transition attend 650 ms, et une pause utilisateur de 2 secondes donne 2,65 secondes lors de la répétition.
5. Choisir un autre récitateur, fermer et se reconnecter : il reste choisi. Compte sans préférence : Shatri.
6. Réglages : Vérifier le jeton push. Envoyer ensuite un message ou un rappel administrateur ; la collecte des receipts n’assimile pas HTTP 200 à une livraison.
7. Activer le rappel quotidien facultatif : vérifier sa programmation dans Réglages. Tester la réception sur un vrai iPhone après résolution du credential APNs.

## Limites de validation

65 tests et TypeScript réussis. Vérification live Supabase des jetons, fonctions, erreurs tickets et receipts. Deux receipts Android acceptés et un ancien jeton Android DeviceNotRegistered observés ; aucune configuration Android changée.
Les tests visuels locaux ne remplacent pas les essais iOS/Android physiques ni l’écoute réelle. Le profil fourni est pour un autre App ID ; le fournisseur de signature doit fournir le credential serveur APNs correspondant. L’IPA reste non signée.

## Vérification visuelle finale

Aperçu des composants React Native existants avec services et audio simulés : formats 320 × 568, 360 × 800, 393 × 720 et 430 × 932. Vérifiés : panneau ouvert, réduit, masqué, réouverture et plein écran. Le plafonnement de hauteur du panneau compact coupait ses commandes à 320 px ; corrigé pour laisser le contenu déterminer sa hauteur, avec défilement limité aux réglages avancés.

Les gestes tactiles, l’écoute réelle, le microphone et la réception push nécessitent encore des essais sur téléphones physiques. Aucun essai physique n’est revendiqué.

Le suivi Supabase a été vérifié : RLS active, absence d’accès direct client et anonyme au diagnostic, deux fonctions d’envoi instrumentées et collecte cron réussie. Le collecteur ignore correctement une file de receipts vide.
