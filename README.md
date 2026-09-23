# Mon Coran Mémoire

Application Expo, React Native et TypeScript pour mémoriser le Coran en Hafs ‘an ‘Âsim. L’interface est en français. Le texte et les 604 pages du mushaf sont disponibles hors ligne.

L’icône de l’application provient de l’image fournie par le propriétaire du projet et se trouve dans `assets/icon.png`.

## État de la version

- Questionnaire initial : cases à cocher pour les sourates, juz’ et hizb connus par cœur, avec saisie des passages partiels. Les objectifs sont présentés des dix dernières sourates jusqu’au Coran entier, puis l’objectif personnalisé.
- Trois niveaux de rythme : Débutant (1 à 5 versets par séance), Intermédiaire (une demi-page) et Intensif (1 page, 2 pages ou 1 rub‘). Une séance quotidienne est possible en sélectionnant les sept jours.
- Programme durable dans SQLite : passages connus exclus, historique conservé lors des recalculs, report des séances. Pour l’objectif « Tout le Coran », choix entre commencer par Al-Fatiha ou par An-Nâs, puis parcourir les sourates précédentes en gardant les versets de chaque sourate dans leur ordre.
- Lecteur page par page du mushaf Hafs 1405, avec glissement horizontal dans les deux sens, repères visuels des versets de la séance et mode récitation masqué.
- Révisions espacées indépendantes du nouvel apprentissage.
- Statistiques calculées avec un poids commun fondé sur les lettres des versets mémorisés ; une même plage n’est comptée qu’une fois.
- Compte et synchronisation Supabase facultatifs, avec règles d’accès par utilisateur.
- Remise à zéro de l’apprentissage, des révisions et de l’historique depuis Réglages, avec synchronisation du nouvel état au compte connecté.
- 480 entrées de toumoun dans `src/data/toumoun.json` **sans limites de versets** : une source fiable vérifiant les limites en Hafs reste à établir. Le moteur accepte ce rythme uniquement si les 480 entrées sont sourcées, vérifiées et contiguës. Il est actuellement indisponible. Les rub‘, nisf, hizb et juz’ proviennent des métadonnées Hafs de Quran Meta.

## Sources coraniques

Le texte arabe vocalisé provient de Tanzil, version Uthmani Hafs, repris sans modification des versets depuis le miroir documenté `dotquran/corpus`. Voir `src/data/TANZIL-LICENSE.txt` et [Tanzil](https://tanzil.net/docs/Text_License). `src/data/verses.json` contient exactement 6 236 versets.

Les 604 images Hafs 1405 ont été extraites de l’IPA fournie par le propriétaire du projet. Le fichier `ayahinfo_1920.db` de cette IPA a servi à construire `pages.json` et `bounds.json`, afin d’associer chaque verset à sa page et d’afficher les repères dans le lecteur. Le code ne modifie pas les images du mushaf. Avant la publication publique du dépôt, confirmer que les droits invoqués couvrent bien la redistribution de ces 604 images, y compris les éléments du Complexe du roi Fahd. Le texte Tanzil reste soumis à sa propre licence.

Les limites des 30 juz’ et 240 rub‘ proviennent de [Quran Meta](https://github.com/quran-center/quran-meta), spécifiquement de son jeu Hafs. Les 60 hizb et 120 nisf sont des regroupements exacts de ces rub‘. Quran Meta fournit les toumoun pour Qaloun, sans équivalent direct Hafs ; aucun numéro de verset Qaloun n’a été transposé ici.

Une [présentation du Mushaf Afrique](https://cp.alukah.net/personal_pages/0/27321/%D9%85%D8%B5%D8%AD%D9%81-%D8%A5%D9%81%D8%B1%D9%8A%D9%82%D9%8A%D8%A7/) décrit un découpage en toumoun sur une édition Hafs. Elle signale trois limites situées au milieu des versets 2:196, 3:7 et 18:22. Ce découpage ne peut donc pas être représenté *exactement* par de simples plages de versets entiers. Pour activer le rythme, il faut une liste complète de 480 limites vérifiées et une décision éditoriale explicite pour ces trois passages ; une approximation ne sera pas présentée comme authentifiée.

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

Le workflow **Actions → IPA iPhone non signé → Run workflow** compile l’application sur un runner macOS GitHub, désactive la signature Xcode et met `coran-memoire-unsigned.ipa` dans les artefacts du run. Il ne demande ni compte Expo ni certificat Apple pour *compiler*. Cette IPA devra ensuite être signée dans eSign avec un certificat et un profil compatibles avec l’identifiant `fr.coranmemoire.app` avant installation. Le [dernier run GitHub](https://github.com/Msoumaya2019/coran-memoire/actions/runs/35777673278) a réussi ; son archive contient les 604 pages, la configuration Supabase publique et aucune signature.

Le workflow **Actions → APK Android autonome → Run workflow** compile aussi un APK installable depuis GitHub, signé avec la clé Android de développement générée par Expo. Le [dernier run GitHub](https://github.com/Msoumaya2019/coran-memoire/actions/runs/35777669880) a réussi et intègre les variables Supabase publiques du dépôt. Cette clé de développement sert aux essais ; pour une distribution durable et les mises à jour, utiliser une clé de publication stable via EAS.

Le workflow **Actions → Vérifier et compiler → Run workflow** construit l’APK Android avec Expo EAS Build. Préparation du propriétaire du compte :

1. Se connecter à Expo (`eas login`), puis relier le projet avec `eas init`. Cela ajoute l’identifiant EAS à `app.json`.
2. Dans Expo, créer un jeton personnel et l’ajouter comme secret GitHub `EXPO_TOKEN` dans **Settings → Secrets and variables → Actions**.
3. Lancer une première compilation Android interactive (`eas build -p android --profile preview`) pour enregistrer la signature chez EAS.
4. Lancer ensuite le workflow Android. Aucun envoi aux stores n’est configuré.

Ne mettre aucun certificat, mot de passe ou profil privé dans GitHub.

## Vérifications effectuées

Le contrôle TypeScript et dix tests du moteur passent. Le parcours depuis An-Nâs couvre les 6 236 versets une seule fois et termine par Al-Fatiha. Les exports Metro Android et iOS ont été générés, chacun avec les 604 pages. Les compilations Android et iOS ont réussi sur GitHub. Les deux fichiers contiennent la configuration Supabase publique ; l’APK contient un bloc de signature Android et l’IPA ne contient aucune signature Apple. La base Supabase a été vérifiée : table `user_state` avec les colonnes attendues, RLS activée, quatre politiques par utilisateur et aucun droit de lecture anonyme. L’installation et la synchronisation sur deux téléphones physiques restent à valider.
