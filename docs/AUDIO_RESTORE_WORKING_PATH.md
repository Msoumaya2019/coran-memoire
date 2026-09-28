# Rétablissement du chemin audio validé — 0.9.28 / build 40

Historique : 52544aa (0.9.20 / build 32) avait activé le fichier complet de sourate
avec les timestamps propres au réciteur. L’utilisateur avait ensuite confirmé que
cela fonctionnait. 9f12bda a désactivé ce chemin par défaut au profit des fichiers
IPA par verset. La gestion des fichiers a ainsi remplacé le chemin stable.

Le défaut de chapterAudio est rétabli. Husary, Mishary, Minshawi et Shatri utilisent
leurs ressources respectives 6/7/9/4 et leurs caches séparés. Les nouveaux réciteurs
sans timestamps compatibles restent sur leurs propres fichiers par verset.
Une source de sourate indisponible conserve le repli existant vers ces fichiers.
Aucun timestamp n’est partagé entre réciteurs.

La pause reste à 200 ms. Entre versets contigus : pause puis reprise du même fichier.
Pour les répétitions : seek vers le début exact du segment, puis play, sans replace.
Le contrôle de frontière basé sur l’horloge native est conservé. Les contrôles de
l’écran verrouillé ne sont plus réenregistrés pendant la répétition du même verset.
Les correctifs de file et d’annulation du build 39 sont conservés.

Tests : sélection réelle du défaut du service (pas seulement un service simulé),
identifiants de ressource, caches séparés, repli des trois nouveaux réciteurs,
source unique et seek aux répétitions, pause 200 ms, annulation et doubles fins.
Pas de téléphone connecté : la cause interne de HostFunction et la disparition
sur le nouvel IPA doivent encore être confirmées avec le réciteur/message exact.
Aucune migration Supabase. L’affichage et les préférences sont inchangés.
