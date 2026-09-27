# Version 0.9.14 — build 26

## Changements

- Icônes de l’accueil : six compositions SVG avec `react-native-svg` 15.15.4, version prévue par Expo 57. Livre, diplôme, boucle sauge, bulles A/ع, mosquée et croissant, livre avec flèche de reprise. Les cinq conteneurs restent de 48 × 48 ; la carte de reprise garde ses dimensions et sa navigation.
- « Espace Administrateur », « Coran de Médine » et « Coran Tajweed ». Tajweed devient le réglage initial ; les préférences déjà enregistrées restent respectées.
- Suppression du bouton, des états et du rendu permettant de masquer les versets.
- Ajout de Shatri, Ghamdi, Qatami, Budair, Boukhatir et Doussari. Aloosi, Nufais, Badr Turki et Lohaydan ne sont pas ajoutés : aucune source complète par verset avec identité vérifiée n’a été confirmée dans les catalogues consultés. Ils ne sont pas déclarés indisponibles partout.
- Images de galerie et fichiers audio MP3/M4A/AAC pour les contenus administrés. Les URL restent possibles. Bucket privé, URL signées à la consultation, upload réservé aux administrateurs. Images : 5 Mo maximum ; audio : 30 Mo. Les fichiers remplacés ou abandonnés sont nettoyés lorsqu’ils ne sont plus référencés.

## Audio continu

La coupure technique venait de `player.replace()` suivi de `play()` à chaque fin de MP3. Le player lui-même était déjà conservé.

Pour Husary, Alafasy, Minshawi et Shatri, un fichier de sourate complet est maintenant lu par le même lecteur Expo Audio. Les timestamps de Quran.com déterminent le verset actif : aucune pause, requête réseau, substitution de fichier ou recherche de position entre deux versets consécutifs. Un seek précis est utilisé au début d’une sélection et lors d’une répétition volontaire. Les timestamps sont mis en cache en mémoire et dans AsyncStorage. Le surlignage rattrape les mises à jour retardées sans sortir de la sélection.

Sources vérifiées :

- [Documentation des fichiers de sourate et timestamps](https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/chapter-reciter-audio-file/)
- `https://api.quran.com/api/v4/chapter_recitations/{id}/{surah}?segments=true` : IDs 6 Husary, 7 Alafasy, 9 Minshawi, 4 Shatri ; identité vérifiée avec les URL réelles des fichiers.
- [Catalogue EveryAyah](https://everyayah.com/data/recitations.js) pour les cinq autres ajouts par verset.

Quand une source continue manque ou échoue, le chemin existant par verset reste disponible avec préchargement des trois prochains fichiers. Ce repli réduit les chargements mais ne garantit pas une transition à 0 ms. Aucun silence ou souffle n’est coupé dans les fichiers originaux. Une transition entre deux sourates reste un changement de fichier.

## Fichiers

- `src/App.tsx`
- `src/ui/HomeIcon.tsx` (nouveau)
- `src/MushafPage.tsx`
- `src/core/program.ts`
- `src/core/audio.ts`
- `src/PassageAudioPlayer.tsx`
- `src/services/quranAudioTimeline.ts` (nouveau)
- `src/AdminDailyContents.tsx`
- `src/DailyContentsScreen.tsx`
- `src/services/dailyContents.ts`
- `src/services/dailyContentMedia.ts` (nouveau)
- `supabase/daily-content-media.sql` (nouveau, appliqué)
- `tests/audio.test.cjs`, `tests/continuous-player.test.cjs`
- `app.json`, `package.json`, `pnpm-lock.yaml`
- `README.md`, ce rapport

## Vérifications

- TypeScript : sans erreur.
- Tests automatisés : 52 réussis (50 tests de la suite et deux tests d’intégration du lecteur), dont répétitions 1/2/3/5/10, suivi continu, événements retardés et refus des timestamps incohérents.
- API réelle : timestamps valides pour les sourates 1, 2 et 114 des quatre sources continues ; HTTP 200 pour les six nouveaux récitateurs.
- Supabase : bucket privé et policies vérifiés ; upload administrateur autorisé, upload sans droits refusé, fichiers de contenus inactifs invisibles ; données temporaires annulées par rollback.
- Test d’intégration du lecteur : un seul remplacement de fichier pour 12 ayat joués en trois passages, aucun pause/play entre ayat, seek précis uniquement au début et aux répétitions, libération unique à la fermeture.
- Aperçu SVG contrôlé avec les tailles réelles des icônes.

Les tests sur téléphones physiques (écoute, transitions, galerie, sélecteur de fichier et upload effectif) restent à réaliser sur les builds. Les vérifications de sources, SQL et compilation ne remplacent pas ces tests. Aucun certificat APNs ou autre système audio n’a été remplacé.
