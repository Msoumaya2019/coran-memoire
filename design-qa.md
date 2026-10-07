# Roqya — vérification visuelle

Comparaison effectuée avec les quatre maquettes fournies, à largeur mobile de 393 px. Aperçus produits à partir des composants React Native réels via react-native-web, avec données de démonstration uniquement dans le script d’aperçu.

Résultat : conforme à l’univers demandé. Fond crème/blanc, vert doux, accents dorés, cartes arrondies, couvertures sobres, lecteur audio sans versets. Accueil, catalogue, bibliothèque, lecteur et état vide inspectés. Les filtres trop hauts et la disposition de la carte principale ont été corrigés après comparaison. La navigation et la typographie existantes sont conservées ; les contenus longs défilent sur les petits écrans.

Interactions vérifiées : changement de récitateur, vitesse, favoris, seek, lecture/pause, mini-lecteur et réouverture. Aucun message d’erreur navigateur. Les autres thèmes utilisent les couleurs du thème existant.

Limites : l’aperçu simule l’audio. Les commandes système, la lecture verrouillée et les restrictions des systèmes doivent être testées sur appareils avec des fichiers réels. Les tests automatisés couvrent les téléchargements, les reprises et les permissions SQL.

Administration Roqya : création via le formulaire réel vérifiée dans l’aperçu web, écran inspecté à 393 × 852. L’aperçu simule Supabase et l’envoi ; les politiques SQL et le transfert natif sont testés séparément. Composants et thème existants réutilisés.
