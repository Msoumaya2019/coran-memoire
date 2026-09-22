# Mon Coran Mémoire

Application Expo, React Native et TypeScript pour mémoriser le Coran en Hafs ‘an ‘Âsim. L’interface est en français. Le texte et les 604 pages du mushaf sont disponibles hors ligne.

## État de la version

- Questionnaire initial : sourates, juz’, hizb, passages partiels, niveaux de maîtrise, objectif, rythme et jours.
- Programme durable dans SQLite : passages connus exclus, historique conservé lors des recalculs, report des séances.
- Lecteur page par page du mushaf Hafs 1405, avec repères visuels des versets de la séance et mode récitation masqué.
- Révisions espacées indépendantes du nouvel apprentissage.
- Statistiques calculées avec un poids commun fondé sur les lettres des versets mémorisés ; une même plage n’est comptée qu’une fois.
- Compte et synchronisation Supabase facultatifs, avec règles d’accès par utilisateur.
- 480 entrées de toumoun dans `src/data/toumoun.json` **sans limites de versets** : une source fiable vérifiant les limites en Hafs reste à établir. Ce rythme est désactivé. Les rub‘, nisf, hizb et juz’ proviennent des métadonnées Hafs de Quran Meta.

## Sources coraniques

Le texte arabe vocalisé provient de Tanzil, version Uthmani Hafs, repris sans modification des versets depuis le miroir documenté `dotquran/corpus`. Voir `src/data/TANZIL-LICENSE.txt` et [Tanzil](https://tanzil.net/docs/Text_License). `src/data/verses.json` contient exactement 6 236 versets.

Les 604 images Hafs 1405 ont été extraites de l’IPA fournie par le propriétaire du projet. Le fichier `ayahinfo_1920.db` de cette IPA a servi à construire `pages.json` et `bounds.json`, afin d’associer chaque verset à sa page et d’afficher les repères dans le lecteur. Le code ne modifie pas les images du mushaf. Avant la publication publique du dépôt, confirmer que les droits invoqués couvrent bien la redistribution de ces 604 images, y compris les éléments du Complexe du roi Fahd. Le texte Tanzil reste soumis à sa propre licence.

Les limites des 30 juz’ et 240 rub‘ proviennent de [Quran Meta](https://github.com/quran-center/quran-meta), spécifiquement de son jeu Hafs. Les 60 hizb et 120 nisf sont des regroupements exacts de ces rub‘. Quran Meta fournit les toumoun pour Qaloun, sans équivalent direct Hafs ; aucun numéro de verset Qaloun n’a été transposé ici.

## Développement local

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm start
```

Ouvrir l’application dans Expo Go sur iPhone ou Android pour une première inspection. Pour les constructions natives, utiliser EAS Build.

## Synchronisation privée

1. Utiliser le projet Supabase `npbwnvrqmajwqtnncuyv`.
2. Dans **SQL Editor**, exécuter `supabase/schema.sql`. La table `user_state` est protégée par Row Level Security et chaque utilisateur ne peut accéder qu’à sa propre ligne.
3. Copier `.env.example` vers `.env`, puis renseigner l’URL du projet et la **clé publique publishable/anon**. Ne jamais utiliser la clé `service_role` dans l’application.
4. Pour les compilations EAS, ajouter ces mêmes variables publiques à l’environnement EAS du projet. La sauvegarde locale fonctionne même sans Supabase.

Pour l’IPA compilée par GitHub, renseigner dans **Settings → Secrets and variables → Actions → Variables** les variables `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY`. Le workflow les transmet au bundler Expo. La clé doit être de type **publishable/anon**, jamais `service_role`.

Le modèle de synchronisation est « dernière modification gagnante » lors de la connexion ou des modifications. Une modification simultanée sur deux téléphones peut écraser l’autre ; une résolution fine des conflits reste à ajouter.

## APK et IPA

Le workflow **Actions → IPA iPhone non signé → Run workflow** compile l’application sur un runner macOS GitHub, désactive la signature Xcode et met `coran-memoire-unsigned.ipa` dans les artefacts du run. Il ne demande ni compte Expo ni certificat Apple pour *compiler*. Cette IPA devra ensuite être signée dans eSign avec un certificat et un profil compatibles avec l’identifiant `fr.coranmemoire.app` avant installation. Le [dernier run GitHub](https://github.com/Msoumaya2019/coran-memoire/actions/runs/35749200458) a réussi ; son archive contient les 604 pages et aucune signature.

Le workflow **Actions → Vérifier et compiler → Run workflow** construit l’APK Android avec Expo EAS Build. Préparation du propriétaire du compte :

1. Se connecter à Expo (`eas login`), puis relier le projet avec `eas init`. Cela ajoute l’identifiant EAS à `app.json`.
2. Dans Expo, créer un jeton personnel et l’ajouter comme secret GitHub `EXPO_TOKEN` dans **Settings → Secrets and variables → Actions**.
3. Lancer une première compilation Android interactive (`eas build -p android --profile preview`) pour enregistrer la signature chez EAS.
4. Lancer ensuite le workflow Android. Aucun envoi aux stores n’est configuré.

Ne mettre aucun certificat, mot de passe ou profil privé dans GitHub.

## Vérifications effectuées

Le contrôle TypeScript et cinq tests du moteur passent. Les exports Metro Android et iOS ont été générés, chacun avec les 604 pages. L’APK Android a été compilé localement dans un chemin court et sa signature APK v2 a été vérifiée. Cette première compilation locale utilise la clé de développement Android créée par Expo ; le workflow EAS pourra gérer une clé dédiée pour les prochaines versions. L’IPA iOS non signée a été compilée par GitHub et son archive ZIP, son identifiant iOS et ses 604 images ont été contrôlés. L’installation réelle sur iPhone et Android reste à valider sur des appareils physiques.
