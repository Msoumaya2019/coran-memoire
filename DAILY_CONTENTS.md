# Rappels & Invocations

## Gestion depuis l’application

1. Ouvrir Profil, puis l’espace administrateur et **Rappels & Invocations**.
2. Choisir Rappels ou Invocations, puis **Gérer les catégories** pour créer la première catégorie.
3. Utiliser **+ Ajouter**. Renseigner le contenu et sa source exacte. Les invocations exigent arabe, phonétique, traduction et source.
4. Ajouter éventuellement une URL audio HTTPS MP3/M4A/AAC et une date AAAA-MM-JJ.
5. Vérifier **Aperçu**, puis **Enregistrer**. Sans programmation, le serveur choisit un contenu actif en rotation quotidienne.

Aucun contenu religieux n’a été prérempli : la maquette n’est pas une source religieuse. Les contenus et audios doivent être vérifiés par l’administrateur avant publication.

## Prononciations

Le bouton **Enregistrer ma voix** utilise RecitationRecorder, les fichiers locaux et la file de synchronisation existants. Pour une invocation, arrêter ouvre une étape de réécoute avant sauvegarde. Seule la sauvegarde définitive déclenche l’envoi. Mes récitations et l’administration contiennent les filtres Toutes / Coran / Invocations. Les fichiers restent dans le bucket privé recitations ; les invocations personnelles ne sont pas partagées aux amis.

Les références coraniques existantes restent inchangées. Les invocations distantes ont des références de versets nulles, un invocation_id et une copie du contenu d’origine. La suppression du contenu d’origine conserve cette copie dans les enregistrements déjà sauvegardés. Aucun score ou suivi d’apprentissage n’est associé aux invocations.

## Vérifications

Migration daily-contents.sql appliquée et testée avec transaction annulée : création, modification, programmation, unicité par date/type, rotation, favoris, refus des actions non administrateur, métadonnées des prononciations et lecture sans compte. 45 tests Node passent, dont l’exclusivité audio, ainsi que TypeScript.

Les essais microphone, interruption, réécoute et affichage sur appareils physiques iOS/Android nécessitent la nouvelle build et restent à effectuer. L’ajout des audios originaux utilise l’option URL HTTPS ; aucun sélecteur/upload de fichier audio original n’a été ajouté.

## Petites illustrations

Dans le formulaire administrateur des rappels comme des invocations, le champ « Petite image : URL HTTPS » ajoute une vignette de 40 × 40 à côté du titre. Le texte arabe garde sa largeur et ses espacements. Une image indisponible est masquée. Aucun bucket, droit d’accès ou upload personnel ne change.
