# iOS replace au deuxième verset — 0.9.29 / build 41

La capture indique Mishary, Toute la page, Fatiha 1–7, ×2, progression 2/7,
avec une erreur préfixée replace. C’est donc un changement de piste en échec,
pas la preuve d’un seek de répétition en échec. Le numéro de build installé
n’est pas visible sur les captures.

Dans expo-audio 57.0.5 installé, AudioModule.swift/preload crée un AVPlayer
séparé. replace reprend son AVPlayerItem, le détache puis l’insère dans le lecteur.
Ce transfert est un chemin natif suspect (pas une cause Objective-C reproduite
sans iPhone connecté). Les essais précédents ne simulaient pas ce transfert natif.

Sur iOS, ce chemin n’est désormais plus utilisé : préchargement des trois MP3
suivants par expo-file-system, téléchargement dédupliqué, cache disque par URL,
publication du fichier seulement après réussite, replace({uri: fichier local}).
Le lecteur audio existant reste monté ; aucune nouvelle logique de récitation.
Une répétition conserve le fichier et remet sa position au début. Android garde
son comportement de préchargement précédent. Le chemin sourate rétabli au build 40
reste disponible pour les réciteurs compatibles, avec repli vers les fichiers.

La pause demeure 200 ms. Les erreurs cacheVerseFile/replace/seekTo/play restent
visibles et diagnostiquées. Aucun secret, donnée utilisateur ou schéma cloud modifié.
Tests : cache concurrent, relecture, fichiers distincts, échec et nouvelle tentative,
absence de preload natif iOS, passage de fichiers locaux à replace, ×2/×3/×5,
annulation, suivi et frontières existants. À confirmer sur iPhone : Fatiha 1–7
avec Mishary, Chaque verset et Passage complet, plus les autres réciteurs.
