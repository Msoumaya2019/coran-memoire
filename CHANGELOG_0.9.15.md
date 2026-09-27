# 0.9.15 — Transition audio par verset

Les cinq sources EveryAyah (Ghamdi, Qatami, Budair, Boukhatir, Doussari) dépendent de la fin du fichier pour avancer. La version précédente utilisait uniquement `didJustFinish`. Le lecteur détecte désormais aussi la position finale d’un fichier chargé, hors buffering. Il conserve la session audio active entre les ayat. Une pause manuelle ne fait pas avancer la sélection. Le lecteur, les répétitions et le surlignage existants sont conservés.

La perte du signal natif sur le téléphone signalé n’a pas été observée directement : cette correction couvre le scénario reproduit en test.

Fichiers : `src/PassageAudioPlayer.tsx`, `tests/continuous-player.test.cjs`, `app.json`, ce rapport.

Validation : TypeScript sans erreur ; 57 tests réussis, dont Al-Fatiha 1–7 en trois passages pour chacun des cinq récitateurs, sans événement natif de fin, et contrôle qu’un buffering ne déclenche pas de transition. L’écoute sur téléphones physiques reste à vérifier.
