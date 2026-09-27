# Fin du verset — version 0.9.22, build 34

Dernière consigne : pause de 350 ms. Augmenter l’attente après l’arrêt ne corrige pas un arrêt tardif.

Le lecteur arrêtait le fichier de sourate à la première mise à jour de position dépassant timestamp_to. Ces mises à jour étaient espacées de 100 ms : l’audio pouvait déjà avoir passé la frontière pendant cet intervalle. Source Shatri vérifiée pour As Saffat : 37:3 se termine à 12698 ms, exactement au début de 37:4.

Correction : un timer de frontière est calculé à partir de la position actuelle du lecteur natif, du timestamp de fin et de la vitesse. Il déclenche la même transition que le callback de secours sans attendre le prochain événement de suivi. Il recontrôle l’horloge au déclenchement pour ne pas finir un verset dont la lecture s’est bloquée par buffering. Si la frontière est déjà atteinte, arrêt immédiat. La pause de 350 ms commence après cet arrêt.

Les notifications de position natives passent à 20 ms ; l’actualisation de progression React reste limitée à 250 ms. Chaque timer est annulé lors de Pause, Arrêt, changement de piste et démontage. Le verrou de fin et l’identifiant de session empêchent les doubles transitions. Changer la vitesse recalcule la frontière.

Fichiers modifiés : src/PassageAudioPlayer.tsx, src/core/audio.ts, tests/continuous-player.test.cjs, app.json et ce rapport.

TypeScript et 88 tests réussis. Nouveaux tests : arrêt à la frontière sans nouvel événement de position, buffering sans fin prématurée, ancien timer invalidé après Arrêt, annulation à Pause. Répétitions et même fichier de sourate restent vérifiés.

Pas d’essai acoustique sur téléphone physique dans cet environnement. Le timer JavaScript reste soumis à la disponibilité du thread et ne constitue pas une garantie d’arrêt native exacte à la milliseconde ; un test sur l’iPhone reste nécessaire, notamment si l’application est en arrière-plan. Aucun texte, mot ou respiration n’est retranché arbitrairement.
