# Audio — 0.9.20, build 32

Dernière instruction utilisateur : conserver la micro-pause si sa responsabilité dans l’erreur n’est pas établie. La marge de 200 ms est donc conservée. Sa responsabilité n’a pas été démontrée : HostFunction désigne un appel natif et le message fourni ne contient pas sa pile.

Le lecteur utilise désormais le fichier complet de sourate avec timestamps, via le service existant quranAudioTimeline. Entre deux versets contigus : pause 200 ms puis reprise du même fichier, sans replace, seekTo ou réenregistrement des commandes écran verrouillé. Les opérations de remplacement de piste sont supprimées de ce chemin. Le surlignage est actualisé au moment de la reprise. Les répétitions nécessitent encore un repositionnement pour revenir au début du verset ou du passage.

Source Shatri / As Saffat vérifiée : fichier HTTPS et 182 timestamps. Cache de timestamps contrôlé avant usage. Si la source continue est indisponible, retour aux fichiers individuels. Les pauses utilisateur et les préférences restent conservées ; 2 s ne deviennent pas 2,2 s.

Fichiers : src/PassageAudioPlayer.tsx, src/core/audio.ts, src/services/quranAudioTimeline.ts, tests/continuous-player.test.cjs et app.json. Aucun changement Supabase ou autre écran.

Tests : suivi des versets, même fichier pendant tout le passage, seek uniquement pour répétitions, annulation des anciennes sessions, Pause / Play et Arrêt. Pas de téléphone iPhone/Android physique disponible : la disparition du HostFunction reste à valider matériellement. L’erreur affiche désormais son opération native exacte pour éviter un nouveau diagnostic fondé sur un message générique.
