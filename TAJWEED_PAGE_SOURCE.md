# Moushaf Tajweed : état des sources

Le mode `tajweed` conservé dans les préférences est maintenant appelé **Lecture simplifiée**. Il utilise les versets Hafs et les annotations Tajweed par verset déjà intégrés. Le mode de pages couleur `tajweedPages` possède un identifiant séparé pour éviter toute migration destructive des préférences, mais il n'est pas activé tant que les ressources requises ne sont pas vérifiées.

## Sources examinées

- [Quran Foundation, page layout](https://api-docs.quran.foundation/docs/tutorials/fonts/page-layout/) : éditions Tajweed 11 et QCF Tajweed V4 19. L'API donne les limites de pages et les lignes/mots. Elle requiert un client et un jeton ; elle ne fournit pas un jeu d'images de pages avec coordonnées en pixels de chaque verset.
- [Quran Foundation, fonts](https://api-docs.quran.foundation/docs/tutorials/fonts/font-rendering/) : police couleur par page pour QCF Tajweed V4. C'est une voie possible pour un futur rendu traditionnel avec interactions, sous réserve de l'accès développeur et de ses [conditions](https://api-docs.quran.foundation/legal/developer-terms/).
- [QuranHub, quran-pages-images](https://github.com/QuranHub/quran-pages-images) : 604 images JPEG dans `easyquran.com/hafs-tajweed`. Le dépôt fournit des coordonnées pour une autre édition (`ayat/hafs`), pas pour ces images Tajweed. Son README annonce GPLv3 alors que le fichier LICENSE contient l'Unlicense. La provenance `easyquran.com` renvoie à Dar Al Maarifah, dont le [site officiel](https://www.easyquran.com/) indique « All rights reserved ». Le dépôt ne prouve donc pas une autorisation de redistribution des pages.
- [Quran SVG](https://github.com/quran-ws/quran-svg) : pages vectorielles et polygones d'ayah cohérents pour leurs propres éditions Hafs. Elles ne sont pas le Moushaf Tajweed coloré demandé.
- [Quran.ws, Elements + Tajweed](https://quran.ws/docs/concepts/text-vs-visual/) : piste ouverte et mieux documentée pour colorer avec précision une page imprimée issue de leur propre édition Hafs, à partir des formes de lettres et signes, puis réutiliser ses polygones de versets. Son rendu mobile demande une intégration supplémentaire du moteur de pages et ne reproduit pas l'édition EasyQuran de la capture. Les [licences par ressource](https://quran.ws/docs/reference/licensing/) ont été examinées ; le rendu final devra être validé page par page avant d'être proposé comme mode actif.

Les coordonnées du Moushaf de Médine inclus dans l'application ne sont **pas** réutilisées sur les images EasyQuran. Leur mise en page est différente ; les employer ferait sélectionner ou surligner le mauvais verset.

## Conditions d'activation

1. Obtenir une licence explicite pour une édition complète de pages Hafs Tajweed, ou utiliser la voie officielle Quran Foundation dans les limites de son accord développeur.
2. Constituer la liste vérifiée des 604 pages et de leurs limites de versets.
3. Fournir et vérifier des polygones/rectangles de versets issus **des mêmes images/du même rendu**.
4. Tester les pages avec changement de sourate, versets répartis sur plusieurs lignes, lecture audio, répétitions, suivi de page et appui long sur iPhone et Android.

Jusqu'à ces vérifications, l'option « Moushaf Tajweed » est visible mais indique clairement qu'elle est en préparation. Elle n'installe ni pages sous droits incertains ni surlignage approximatif. Le Moushaf de Médine et la Lecture simplifiée continuent de fonctionner.
