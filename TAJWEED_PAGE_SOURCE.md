# Moushaf Tajweed : sources, droits et limites techniques

Le mode `tajweed` conservé dans les préférences est maintenant appelé **Lecture simplifiée**. Le nouveau mode `tajweedPages` affiche **604 pages complètes distinctes** en couleur, dans leur mise en page traditionnelle. Les images proviennent du répertoire [`easyquran.com/hafs-tajweed`](https://github.com/QuranHub/quran-pages-images/tree/main/easyquran.com/hafs-tajweed) de QuranHub, attribué à Dar Al Maarifah / EasyQuran. Le propriétaire du projet a déclaré le 24 septembre 2026 disposer d'une **autorisation écrite** pour intégrer et redistribuer ces pages dans l'application et le dépôt public. Cette autorisation n'a pas été transmise au dépôt ; elle doit être conservée par le propriétaire.

Le dépôt QuranHub annonce GPLv3 dans son README alors que son fichier LICENSE contient l'Unlicense. Cette ambiguïté ne constitue pas notre autorisation ; celle déclarée par le propriétaire du projet pour l'édition originale est déterminante. Le code de téléchargement et ses empreintes figurent dans `scripts/download-tajweed-pages.mjs` et `src/data/tajweedImageHashes.json`. Les pages ne sont ni recoloriées ni recomposées.

Les pages 2, 3, 100, 555 et 604 ont été comparées visuellement avec les limites Hafs utilisées dans l'application. Cette vérification ponctuelle ne démontre pas encore que **chaque** limite des 604 pages est identique. En cas de différence, la correspondance verset/page doit être corrigée dans les données propres à cette édition, sans toucher aux données du Moushaf de Médine.

## Fonctions actuellement utilisables

- Tourner les 604 pages par geste ou flèche ; conserver le numéro de page lors du changement de mode.
- Lire une séance ou un passage sélectionné avec le lecteur audio existant, ses récitants et ses répétitions.
- Passer à la traduction française par page et revenir à l'image sans interrompre l'audio.
- Lire en plein écran et masquer le lecteur flottant.

## Fonctions retenues jusqu'à vérification des positions

Le dépôt de pages ne contient pas de **coordonnées de versets pour ces images Tajweed**. Ses données `ayat/hafs` appartiennent à une autre édition. Les superposer ici risquerait de surligner ou de sélectionner le mauvais verset. En conséquence, le mode pages couleur ne montre aucun surlignage d'ayah, ne déclenche pas d'action par appui long sur l'image et ne tourne pas la page automatiquement avec l'audio. Les contrôles de sélection du passage dans le lecteur audio fonctionnent indépendamment. Les autres deux modes conservent leur suivi et leurs interactions existants.

## Recherche des données de positionnement

- [Quran Foundation, page layout](https://api-docs.quran.foundation/docs/tutorials/fonts/page-layout/) distingue les éditions Tajweed 11 et QCF Tajweed V4 19, mais ne donne pas les coordonnées en pixels des images EasyQuran. Ses données ne peuvent pas être transposées ici.
- [QuranHub, quran-images-utils](https://github.com/QuranHub/quran-images-utils) contient un détecteur de médaillons d'ayah. Il nécessite un gabarit adapté aux pages EasyQuran et une vérification des 6 236 repères avant de pouvoir fournir une géométrie fiable. Une détection automatique seule ne suffit pas à authentifier chaque polygone de verset.
- [Quran.ws, Elements + Tajweed](https://quran.ws/docs/concepts/text-vs-visual/) offre une autre voie, fondée sur ses propres pages et géométries Hafs, mais elle produit une édition visuelle différente des images EasyQuran choisies.

L'activation du suivi sur image et de l'appui long exigera des positions propres à cette édition, un contrôle de la numérotation sur les 604 pages et des tests sur appareil réel. Aucun masque approximatif n'est présenté comme vérifié.
