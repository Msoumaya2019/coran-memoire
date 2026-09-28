# Répétition du même fichier — version 0.9.27 / 39

Le message reçu identifie replace comme opération native en échec, sans préciser
la cause interne à iOS. Le code avait un contrôle par égalité d’URL, mais répétait
la préparation générale (résolution, préchargement, paramètres) à chaque reprise.
Un événement d’erreur reçu après la fin pouvait invalider sourceRef avant la reprise.
Les anciens tests vérifiaient l’ordre des versets, sans imposer un seul replace.
L’exception native elle-même n’a pas été reproduite sur un téléphone connecté.

La source chargée est maintenant conservée avec son verset et son réciteur.
Une répétition identique réutilise ce segment sans nouvelle résolution ni preload :
fin verrouillée → pause native sérialisée → 200 ms → seekTo(0) await → play.
Pour un segment de sourate, seek vise le début du segment, pas le début de la sourate.
Un changement réel de source seul appelle replace avec un objet {uri} validé.
La file existante et les identifiants de session restent utilisés ; les statuts
obsolètes pendant l’attente ne peuvent plus invalider le fichier terminé.
Les frontières de sourate restent arrêtées immédiatement pour éviter le mot suivant.

Logs de développement : START, ENDED, REPEAT, VERSE CHANGE, WAIT, SEEK, REPLAY,
PLAY, REPLACE, avec verset global, répétition, session et dernier état natif.
Les erreurs natives restent visibles et précisent l’opération ; elles ne sont pas masquées.

Tests supplémentaires : même verset ×2/×3/×5 avec exactement un replace et
seek(0) aux reprises, doubles fins, statut obsolète, changement réel de verset,
Arrêt dès le callback de fin. Les tests existants couvrent Suivant, Pause/Play,
Arrêt durant l’attente, changement de session et attente d’un seek natif.
À confirmer sur iPhone et Android réels : absence de HostFunction et écoute
acoustique des frontières, pour chaque réciteur. Aucun changement de base de données.
