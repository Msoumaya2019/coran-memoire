# Répétitions audio et micro-pause de 200 ms

## Diagnostic vérifié dans le code

L’enchaînement réutilise le même player et rembobine un fichier terminé par seekTo. Ce repositionnement est asynchrone, tandis que les commandes Suivant / Recommencer et les changements de source pouvaient démarrer indépendamment. Une source pouvait donc être remplacée pendant un seek encore en attente. Les tests reproduisent désormais cette situation avec un seek volontairement suspendu.

Le libellé « Exception in HostFunction: <unknown> » fourni par l’iPhone ne contient pas de pile ni le nom de l’opération. Il n’est pas possible d’affirmer que cette concurrence est son unique cause sur cet appareil sans journal natif. Chaque préparation native est désormais instrumentée : resolveAudioSegment, replace, setPlaybackRate, setActiveForLockScreen, seekTo et play. Les erreurs restent visibles et sont accompagnées de l’opération, du verset, de la répétition, de la session, du dernier statut et de la pile. Les traces START / FINISHED / NEXT sont limitées au développement.

## Changements

- src/PassageAudioPlayer.tsx : file de transitions sérialisées, vérifications de session entre les opérations, fins de piste ignorées pendant la préparation, timers invalidés et annulés, attente avant release, reprise après Pause et annulation par Suivant / Arrêt. Compteur de répétition visible en mode compact. Le player existant est conservé.
- src/core/audio.ts : DEFAULT_AYAH_GAP_MS = 200 ; mode Chaque verset infini répète le même verset jusqu’à une intervention.
- tests/continuous-player.test.cjs : 16 scénarios supplémentaires, incluant As Saffat 3–5, ×1 / ×3 / ×5, les deux modes, délai 200 ms, pause utilisateur 0 / 2 / 5 / 10 s, Pause / Play, Suivant, Arrêt, seek suspendu, fermeture et diagnostic d’erreur native.

Entre deux versets : 200 ms minimum après la fin réelle. Entre répétitions : maximum de 200 ms et de la pause choisie. Une pause utilisateur de 2 s dure donc 2 s, et non 2,2 s. Le choix Répétition ∞ conserve le mode Chaque verset s’il est sélectionné.

## Validation et limites

TypeScript et 81 tests réussis. Les tests utilisent un double du player natif et contrôlent réellement l’ordre des appels et l’annulation des opérations. Ils ne constituent pas un essai acoustique ou matériel.

Un vrai iPhone et un Android ne sont pas disponibles dans cet environnement. Validation matérielle encore requise : As Saffat 3–5 ×3 Chaque verset, même passage ×3 Passage complet, Pause / Play, Suivant durant une répétition, Arrêt durant les 200 ms et changement de récitateur. Si l’erreur subsiste, le journal AUDIO ERROR permettra d’attribuer précisément l’échec natif au lieu de supposer sa cause.

Aucune migration ni modification des autres écrans. Les APK/IPA 0.9.18 déjà livrés ne contiennent pas ce nouveau correctif.
