# Révisions et barre unique — version 0.9.23 (35)

## 1. Ancien fonctionnement et cause
Le planificateur répartissait des échéances individuelles `reviewDue`. Après notation, chaque verset était reporté de 7/14/21/30 jours s’il était parfait, de 2 jours en cas d’hésitation, d’un jour sinon. Les contenus récents étaient limités aux âges 0–2 jours et devenaient habituels au troisième jour écoulé. Les vrais Nisf et un plafond de rattrapage pouvaient modifier les volumes quotidiens. Aucun snapshot garantissant une couverture exacte du corpus sur X jours n’existait, ni checkpoints J+1/J+3/J+7 persistants.

## 2. Nouvelle planification
Le même module `core/review.ts` et les mêmes connaissances `perfect`/`review` pilotent désormais :
- Un snapshot ordonné des identifiants de versets connus établis, immutable durant le cycle.
- Les nouveaux versets datés, consolidés à J+1/J+3/J+7 avant admission dans un prochain snapshot.
- Les priorités utilisateur/professeur, avec une échéance distincte de la planification du cycle.
Les connaissances anciennes déclarées avant l’arrivée de ce modèle sont conservées comme connaissances établies ; leurs consolidations historiques sont créditées seulement si des révisions réellement effectuées les justifient.

### Algorithme du cycle
1. Trier et dédupliquer les versets éligibles en ordre coranique.
2. Si le corpus est exactement composé d’unités complètes répartissables, utiliser les vraies limites Hizb, puis Nisf, puis Rubu’ (7 Hizb / 14 jours = 14 vrais Nisf).
3. Sinon, calculer le poids de chaque verset comme sa fraction de la page réelle, d’après le volume du texte arabe. Découper aux préfixes cumulés les plus proches des cibles journalières ; préférer une frontière réelle proche, dans une tolérance de 15 % de la part moyenne. Aucun verset n’est coupé.
4. Les parts concaténées correspondent exactement au snapshot, sans trous ni doublons. Les zones inconnues entre connaissances non contiguës sont exclues.
5. L’affectation d’une part à une date est persistée. Une seule part ordinaire au maximum est proposée par jour : en cas de retard, la plus ancienne inachevée reste à faire et la fin du cycle est prolongée. Aucune validation automatique.
6. Nouveau snapshot seulement quand le corpus est terminé et la durée écoulée. Changer volontairement la durée recrée la répartition avec les connaissances alors éligibles ; l’historique reste conservé.

### Consolidations
`memorizedAt` reste la date source. Chaque verset possède trois dates de validation persistantes. La première étape non terminée devient exigible à sa date initiale. Une étape manquée reste due ; une seule étape peut être validée par verset et par jour, même si plusieurs dates ont été manquées. Après J+7 réellement validé, le nouveau verset est admissible au prochain cycle. Une connaissance déclarée pendant l’onboarding est traitée comme savoir préexistant ; une nouvelle connaissance validée après l’onboarding est datée pour consolidation.

### Qualité et recouvrements
Parfait valide la séance et retire le marqueur utilisateur ; un marqueur professeur est conservé. Quelques hésitations crée/conserve une priorité pour J+2 ; À retravailler pour J+1. Les deux valident aussi le travail du cycle : la difficulté ne bloque pas la couverture des autres versets. L’historique de notes est conservé. Une séance suit consolidation → priorité → cycle, sans doublon. Une lecture d’un verset due dans plusieurs mécanismes est créditée à chacun de ceux qui sont exigibles.

## 3. Unités d’affichage
Une quantité est nommée Hizb/Nisf/Rubu’ seulement si elle représente exactement des divisions complètes présentes dans le mapping Quran. Puis viennent les pages complètes. Les quantités partielles importantes utilisent une approximation explicitement préfixée par « ≈ » basée sur le poids réel des pages ; les petites quantités sont données en versets. Les statistiques comptent les vrais Juz’, Rubu’ et Nisf entièrement connus.

## 4. Interface
`ReviewDashboard` remplace l’organisation ancienne, avec un seul démarrage quotidien, une progression fondée sur le contenu effectivement revu et des timelines de consolidation. Le lecteur de révision utilise désormais le lecteur compact partagé Lecture/Apprentissage. `RevisionBottomActionBar` comporte les cinq actions sur une seule rangée. La sélection audio/voix utilise un état rempli ; une note valide immédiatement le travail et ouvre la suite de la séance. Aucune note n’est sélectionnée par défaut avant validation.

La page conserve ses dimensions originales, le Tajweed, les zones de versets, le suivi audio, les flèches et le swipe. Traduction, récitateurs, répétitions et microphone utilisent les composants existants. L’ancien choix « À réapprendre » des révisions historiques reste accessible dans les options du lecteur par appui prolongé. La lecture simplifiée conserve un défilement vertical ; les images de Moushaf utilisent le mode ajusté.

## 5. Persistance et base de données
Pas de migration SQL, pas de nouvelle table, pas de nouvelle variable d’environnement. Les champs optionnels `reviewModelStartedAt`, `reviewCycle`, `reviewConsolidations`, `reviewPriorityDue` enrichissent le JSON déjà sauvegardé dans SQLite et `Supabase.user_state.data`. La restauration du compte réutilise les services existants. La conversion des anciennes données est progressive et idempotente ; `reviewDue`, les anciennes `revisions`, `reviewHistory`, `difficultyHistory` et les connaissances ne sont pas effacés. Les anciens compteurs ne sont plus supprimés en apprenant un passage chevauchant une ancienne révision.

## 6. Fichiers
Modifiés : `src/App.tsx`, `src/core/review.ts`, `src/core/program.ts`, `tests/review.test.cjs`, `scripts/preview-design.cjs`, `app.json`, `design-qa.md`.
Créés : `src/ReviewDashboard.tsx`, `src/ui/RevisionBottomActionBar.tsx`, ce rapport.
Bibliothèque d’icônes réutilisée : Expo MaterialCommunityIcons. Aucun nouveau moteur audio, bucket, service d’enregistrement ou donnée Quran.

## 7. Tests réellement effectués
- TypeScript : aucune erreur.
- Suite : 116 tests réussis, dont les tests audio et la vérification des 604 pages/zonages Tajweed déjà présents.
- Matrice de 20 cycles : 1/7/10/30/60 Hizb × 7/14/21/30 jours ; égalité corpus/programme, unicité, équilibre, clôture réelle, nouveau cycle.
- Corpus non contigu et corpus plus petit que le nombre de jours ; aucun ajout de verset inconnu.
- Snapshot stable, nouveaux versets au cycle suivant, J+7 manqué conservé hors du corpus nouveau.
- J+1/J+3/J+7, retards, pas de validation automatique, une étape quotidienne maximum.
- Retards de cycle, notes, priorités, recouvrements, idempotence de validation, marqueurs professeur et anciens compteurs conservés.
- Sérialisation/restauration du compte et protection contre la disparition des nouveaux champs lors d’une sauvegarde par un ancien client.
- Comparaison visuelle avec les deux références ; tailles 320×568, 393×852, 430×932 ; palettes lilas et Nuit ; cinq actions sur une ligne (au moins 54×64 px CSS à 320 px).
- Parcours UI observé consolidation → priorité → cycle, ouverture des panneaux audio/voix et plein écran.

Non effectués sur appareils physiques : prise de son microphone, upload Supabase depuis un téléphone réel, récitation audible sur iOS/Android, gestes natifs et safe areas matérielles. Les contrôles natifs sont simulés dans l’aperçu navigateur. Les moteurs et services existants sont réutilisés et leur suite automatique passe ; cela ne remplace pas une validation physique.

## 8. Comment tester dans l’application
1. Ouvrir Révisions puis Modifier : choisir 7/14/21/30 jours et vérifier rythme et corpus.
2. Appuyer Commencer ma révision : les consolidations dues passent avant les priorités et le cycle.
3. Sur le lecteur, utiliser les trois notes : la séance avance automatiquement ; une difficulté doit revenir tôt sans bloquer le cycle.
4. Écouter ouvre les contrôles existants sur le passage ; vérifier lecture, répétitions, suivi et surlignage. Ma voix ouvre l’enregistreur, puis contrôler sauvegarde/réécoute et accès administrateur.
5. Tester FR/عربي, changement de page, swipe, plein écran et réouverture des contrôles.
6. Fermer et relancer : snapshot, validations, dates de consolidation et historique doivent rester identiques. Faire aussi une déconnexion/reconnexion après synchronisation.
7. Sur un compte de test, apprendre quelques versets et vérifier les trois dates à J+1/J+3/J+7 ; laisser volontairement une échéance non faite et contrôler son maintien.

## 9. Exemples réellement générés : sept premiers Hizb
Le corpus de référence est constitué des **463 versets** des sept premiers Hizb selon le mapping de l’application. Les tableaux ci-dessous sont produits par le planificateur réel ; ils ne sont pas des données figées dans l’interface.

### Cycle 7 jours — 1 Hizb / jour

| Jour | Quantité | Versets | Début | Fin |
|---|---|---:|---|---|
| 1 | 1 Hizb | 81 | Al Fâtiha 1–1 | Al Baqarah 74–74 |
| 2 | 1 Hizb | 67 | Al Baqarah 75–75 | Al Baqarah 141–141 |
| 3 | 1 Hizb | 61 | Al Baqarah 142–142 | Al Baqarah 202–202 |
| 4 | 1 Hizb | 50 | Al Baqarah 203–203 | Al Baqarah 252–252 |
| 5 | 1 Hizb | 48 | Al Baqarah 253–253 | Al 'Imran 14–14 |
| 6 | 1 Hizb | 78 | Al 'Imran 15–15 | Al 'Imran 92–92 |
| 7 | 1 Hizb | 78 | Al 'Imran 93–93 | Al 'Imran 170–170 |

Total : 463 versets distincts, soit exactement le corpus.

### Cycle 14 jours — 1 Nisf / jour

| Jour | Quantité | Versets | Début | Fin |
|---|---|---:|---|---|
| 1 | 1 Nisf | 50 | Al Fâtiha 1–1 | Al Baqarah 43–43 |
| 2 | 1 Nisf | 31 | Al Baqarah 44–44 | Al Baqarah 74–74 |
| 3 | 1 Nisf | 31 | Al Baqarah 75–75 | Al Baqarah 105–105 |
| 4 | 1 Nisf | 36 | Al Baqarah 106–106 | Al Baqarah 141–141 |
| 5 | 1 Nisf | 35 | Al Baqarah 142–142 | Al Baqarah 176–176 |
| 6 | 1 Nisf | 26 | Al Baqarah 177–177 | Al Baqarah 202–202 |
| 7 | 1 Nisf | 30 | Al Baqarah 203–203 | Al Baqarah 232–232 |
| 8 | 1 Nisf | 20 | Al Baqarah 233–233 | Al Baqarah 252–252 |
| 9 | 1 Nisf | 19 | Al Baqarah 253–253 | Al Baqarah 271–271 |
| 10 | 1 Nisf | 29 | Al Baqarah 272–272 | Al 'Imran 14–14 |
| 11 | 1 Nisf | 37 | Al 'Imran 15–15 | Al 'Imran 51–51 |
| 12 | 1 Nisf | 41 | Al 'Imran 52–52 | Al 'Imran 92–92 |
| 13 | 1 Nisf | 40 | Al 'Imran 93–93 | Al 'Imran 132–132 |
| 14 | 1 Nisf | 38 | Al 'Imran 133–133 | Al 'Imran 170–170 |

Total : 463 versets distincts, soit exactement le corpus.

### Cycle 21 jours — ≈ 3,4 pages / jour

| Jour | Quantité | Versets | Début | Fin |
|---|---|---:|---|---|
| 1 | ≈ 3 pages | 27 | Al Fâtiha 1–1 | Al Baqarah 20–20 |
| 2 | ≈ 3 pages | 23 | Al Baqarah 21–21 | Al Baqarah 43–43 |
| 3 | 1 Nisf | 31 | Al Baqarah 44–44 | Al Baqarah 74–74 |
| 4 | 1 Rubu’ | 17 | Al Baqarah 75–75 | Al Baqarah 91–91 |
| 5 | ≈ 3 pages | 21 | Al Baqarah 92–92 | Al Baqarah 112–112 |
| 6 | ≈ 3 pages | 25 | Al Baqarah 113–113 | Al Baqarah 137–137 |
| 7 | ≈ 3 pages | 24 | Al Baqarah 138–138 | Al Baqarah 161–161 |
| 8 | ≈ 3 pages | 22 | Al Baqarah 162–162 | Al Baqarah 183–183 |
| 9 | ≈ 4 pages | 19 | Al Baqarah 184–184 | Al Baqarah 202–202 |
| 10 | 1 Rubu’ | 16 | Al Baqarah 203–203 | Al Baqarah 218–218 |
| 11 | ≈ 4 pages | 17 | Al Baqarah 219–219 | Al Baqarah 235–235 |
| 12 | ≈ 3 pages | 17 | Al Baqarah 236–236 | Al Baqarah 252–252 |
| 13 | ≈ 4 pages | 14 | Al Baqarah 253–253 | Al Baqarah 266–266 |
| 14 | ≈ 3 pages | 16 | Al Baqarah 267–267 | Al Baqarah 282–282 |
| 15 | 1 Rubu’ | 18 | Al Baqarah 283–283 | Al 'Imran 14–14 |
| 16 | ≈ 4 pages | 28 | Al 'Imran 15–15 | Al 'Imran 42–42 |
| 17 | ≈ 4 pages | 32 | Al 'Imran 43–43 | Al 'Imran 74–74 |
| 18 | 1 Rubu’ | 18 | Al 'Imran 75–75 | Al 'Imran 92–92 |
| 19 | ≈ 4 pages | 28 | Al 'Imran 93–93 | Al 'Imran 120–120 |
| 20 | ≈ 4 pages | 32 | Al 'Imran 121–121 | Al 'Imran 152–152 |
| 21 | 1 Rubu’ | 18 | Al 'Imran 153–153 | Al 'Imran 170–170 |

Total : 463 versets distincts, soit exactement le corpus.

### Cycle 30 jours — ≈ 2,4 pages / jour

| Jour | Quantité | Versets | Début | Fin |
|---|---|---:|---|---|
| 1 | ≈ 2 pages | 16 | Al Fâtiha 1–1 | Al Baqarah 9–9 |
| 2 | ≈ 2 pages | 18 | Al Baqarah 10–10 | Al Baqarah 27–27 |
| 3 | ≈ 2 pages | 22 | Al Baqarah 28–28 | Al Baqarah 49–49 |
| 4 | ≈ 2 pages | 17 | Al Baqarah 50–50 | Al Baqarah 66–66 |
| 5 | ≈ 2 pages | 17 | Al Baqarah 67–67 | Al Baqarah 83–83 |
| 6 | ≈ 2 pages | 13 | Al Baqarah 84–84 | Al Baqarah 96–96 |
| 7 | ≈ 2 pages | 14 | Al Baqarah 97–97 | Al Baqarah 110–110 |
| 8 | ≈ 2 pages | 17 | Al Baqarah 111–111 | Al Baqarah 127–127 |
| 9 | ≈ 2 pages | 16 | Al Baqarah 128–128 | Al Baqarah 143–143 |
| 10 | ≈ 2 pages | 18 | Al Baqarah 144–144 | Al Baqarah 161–161 |
| 11 | ≈ 2 pages | 15 | Al Baqarah 162–162 | Al Baqarah 176–176 |
| 12 | 1 Rubu’ | 12 | Al Baqarah 177–177 | Al Baqarah 188–188 |
| 13 | 1 Rubu’ | 14 | Al Baqarah 189–189 | Al Baqarah 202–202 |
| 14 | 1 Rubu’ | 16 | Al Baqarah 203–203 | Al Baqarah 218–218 |
| 15 | ≈ 2 pages | 11 | Al Baqarah 219–219 | Al Baqarah 229–229 |
| 16 | ≈ 3 pages | 13 | Al Baqarah 230–230 | Al Baqarah 242–242 |
| 17 | ≈ 2 pages | 8 | Al Baqarah 243–243 | Al Baqarah 250–250 |
| 18 | ≈ 2 pages | 9 | Al Baqarah 251–251 | Al Baqarah 259–259 |
| 19 | ≈ 2 pages | 12 | Al Baqarah 260–260 | Al Baqarah 271–271 |
| 20 | 1 Rubu’ | 11 | Al Baqarah 272–272 | Al Baqarah 282–282 |
| 21 | ≈ 2 pages | 14 | Al Baqarah 283–283 | Al 'Imran 10–10 |
| 22 | ≈ 2 pages | 16 | Al 'Imran 11–11 | Al 'Imran 26–26 |
| 23 | ≈ 2 pages | 19 | Al 'Imran 27–27 | Al 'Imran 45–45 |
| 24 | ≈ 2 pages | 19 | Al 'Imran 46–46 | Al 'Imran 64–64 |
| 25 | ≈ 2 pages | 17 | Al 'Imran 65–65 | Al 'Imran 81–81 |
| 26 | ≈ 2 pages | 20 | Al 'Imran 82–82 | Al 'Imran 101–101 |
| 27 | ≈ 2 pages | 17 | Al 'Imran 102–102 | Al 'Imran 118–118 |
| 28 | ≈ 2 pages | 22 | Al 'Imran 119–119 | Al 'Imran 140–140 |
| 29 | ≈ 2 pages | 14 | Al 'Imran 141–141 | Al 'Imran 154–154 |
| 30 | ≈ 2 pages | 16 | Al 'Imran 155–155 | Al 'Imran 170–170 |

Total : 463 versets distincts, soit exactement le corpus.
