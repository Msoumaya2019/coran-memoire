# Destinataires en modération

Exécuter `supabase/admin-message-recipients.sql` dans le projet Supabase existant. La RPC réutilise `private.is_app_admin()` et ne modifie ni les tables ni les règles de lecture des conversations pour les utilisateurs.

L’espace Modération affiche l’auteur et le destinataire des messages privés dans les deux sens, ainsi que le nom du groupe pour les discussions collectives. Ces informations apparaissent également sur les signalements dont le message est présent parmi les 100 messages récents chargés. Un message plus ancien conserve la présentation existante. Les noms manquants ont un libellé de secours. Avant application de la migration, la liste existante reste accessible et le destinataire est indiqué indisponible.
