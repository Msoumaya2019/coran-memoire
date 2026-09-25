# Moushaf Tajweed : sources, droits et limites techniques

Le mode `tajweed` conservé dans les préférences est maintenant appelé **Lecture simplifiée**. Le nouveau mode `tajweedPages` affiche **604 pages complètes distinctes** en couleur, dans leur mise en page traditionnelle. Les images proviennent du répertoire [`easyquran.com/hafs-tajweed`](https://github.com/QuranHub/quran-pages-images/tree/main/easyquran.com/hafs-tajweed) de QuranHub, attribué à Dar Al Maarifah / EasyQuran. Le propriétaire du projet a déclaré le 24 septembre 2026 disposer d'une **autorisation écrite** pour intégrer et redistribuer ces pages dans l'application et le dépôt public. Cette autorisation n'a pas été transmise au dépôt ; elle doit être conservée par le propriétaire.

Le dépôt QuranHub annonce GPLv3 dans son README alors que son fichier LICENSE contient l'Unlicense. Cette ambiguïté ne constitue pas notre autorisation ; celle déclarée par le propriétaire du projet pour l'édition originale est déterminante. Le code de téléchargement et ses empreintes figurent dans `scripts/download-tajweed-pages.mjs` et `src/data/tajweedImageHashes.json`. Les pages ne sont ni recoloriées ni recomposées.

Les pages 2, 3, 100, 555 et 604 ont été comparées visuellement avec les limites Hafs utilisées dans l'application. Cette vérification ponctuelle ne démontre pas encore que **chaque** limite des 604 pages est identique. En cas de différence, la correspondance verset/page doit être corrigée dans les données propres à cette édition, sans toucher aux données du Moushaf de Médine.

## Fonctions actuellement utilisables

- Tourner les 604 pages par geste ou flèche ; conserver le numéro de page lors du changement de mode.
- Lire une séance ou un passage sélectionné avec le lecteur audio existant, ses récitants et ses répétitions.
- Passer à la traduction française par page et revenir à l'image sans interrompre l'audio.
- Lire en plein écran et masquer le lecteur flottant.
- Afficher la référence exacte du verset récité et tourner automatiquement la page quand le lecteur passe à une autre page, si l'option de suivi est activée. Les pages 3, 255 et 604 ont également été comparées avec l'édition de Médine pour ce suivi de page. Cette vérification par échantillon ne valide pas encore les 604 limites.

## Limites de l'image de repli

Le dépôt d'images de repli ne contient pas de **coordonnées de versets pour ces images Tajweed**. Ses données `ayat/hafs` appartiennent à une autre édition. Les superposer ici risquerait de surligner ou de sélectionner le mauvais verset. Quand le repli est affiché, il n'y a donc ni surlignage d'ayah ni appui long sur un verset de l'image. Le suivi automatique change la page et indique le verset sous l'image. Les contrôles de sélection du passage dans le lecteur audio fonctionnent indépendamment. Les deux autres modes conservent leur suivi et leurs interactions existants.

## Nouveau rendu QCF V4 (en cours de validation sur appareils)

Le compte développeur Quran Foundation « Apprendre le Coran » a un accès **Content** en production. Les identifiants de production sont stockés uniquement dans les secrets de fonctions Supabase. La fonction `qcf-v4-page` récupère les mots de la page demandée avec `mushaf=19`, `code_v2`, la page et la ligne. Elle exige une session Supabase valide et ne renvoie que les champs utiles à la page. La police couleur QCF V4 est chargée depuis le domaine de Quran Foundation dans une WebView. Chaque mot conserve son identifiant de verset Hafs ; le surlignage et l'appui long portent sur ces vrais mots, y compris lorsqu'un verset traverse plusieurs lignes.

L'application compare le premier et le dernier verset reçu avec la page de l'édition locale avant d'afficher le rendu QCF. En cas de différence, d'absence de compte ou d'échec réseau/police, l'image EasyQuran existante reste visible **sans** faux surlignage. Le changement automatique de page repose encore sur les limites de page locales ; il faut confirmer la correspondance des 604 pages avant d'affirmer que ce suivi est exact partout. Le rendu, les couleurs de la police, la taille des lignes et les gestes doivent être contrôlés sur un iPhone et un Android réels après compilation. La page QCF est une composition de ses glyphes et métadonnées, pas une photographie de l'édition Dar Al Maarifah.

Les contenus Quran Foundation ne sont pas placés en bloc dans le dépôt public. L'application ne conserve les réponses de page qu'en mémoire pendant six heures. Attribution : Quran Foundation / QCF V4 Tajweed, selon les [conditions développeur](https://api-docs.quran.foundation/legal/developer-terms/).

## Recherche des données de positionnement

- [Quran Foundation, page layout](https://api-docs.quran.foundation/docs/tutorials/fonts/page-layout/) distingue les éditions Tajweed 11 et QCF Tajweed V4 19, mais ne donne pas les coordonnées en pixels des images EasyQuran. Ses données ne peuvent pas être transposées ici.
- [QuranHub, quran-images-utils](https://github.com/QuranHub/quran-images-utils) contient un détecteur de médaillons d'ayah. Il nécessite un gabarit adapté aux pages EasyQuran et une vérification des 6 236 repères avant de pouvoir fournir une géométrie fiable. Une détection automatique seule ne suffit pas à authentifier chaque polygone de verset.
- [Quran.ws, Elements + Tajweed](https://quran.ws/docs/concepts/text-vs-visual/) offre une autre voie, fondée sur ses propres pages et géométries Hafs, mais elle produit une édition visuelle différente des images EasyQuran choisies.
- [Quran Foundation, QCF V4 Tajweed](https://api-docs.quran.foundation/docs/tutorials/fonts/font-rendering/) fournit la police couleur et les données par mot utilisées dans le nouveau rendu. Le test visuel sur les deux plateformes et la comparaison de toutes les limites de pages restent à faire.
- [NedaaDevs, Quran Image Generator](https://github.com/NedaaDevs/quran-image-generator) peut produire des pages V4 et des limites de glyphes issues du même rendu, mais son auteur avertit que le résultat n'a pas été relu contre un Moushaf imprimé et ne doit pas être distribué en production sans vérification approfondie. Ce générateur n'est donc pas une source de remplacement immédiatement validée.

L'activation du suivi sur image et de l'appui long exigera des positions propres à cette édition, un contrôle de la numérotation sur les 604 pages et des tests sur appareil réel. Aucun masque approximatif n'est présenté comme vérifié.
