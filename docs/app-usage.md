# Durée de la dernière session

Appliquer `supabase/app-usage.sql` dans le projet Supabase existant. Cette migration ajoute une table dédiée et deux RPC sans changer les comptes ni le RPC de progression. Elle réutilise `private.is_app_admin()`.

Comptes et progression affiche la date et la durée de la dernière session au premier plan. Le verrouillage ou le passage en arrière-plan clôt la session ; le retour démarre une nouvelle session. L’audio en arrière-plan ne compte pas. Le suivi commence après installation de cette version, sans reconstruction des anciennes connexions.

La durée est persistée localement et envoyée toutes les 15 secondes et à la mise en arrière-plan. Les échecs réseau restent en attente pour le même compte. Une fermeture forcée peut perdre jusqu’à environ 15 secondes ; l’état « En cours » expire après 45 secondes sans mise à jour. Les mesures sont déclarées par le téléphone et sont indicatives, pas un journal d’audit. Aucun écran consulté n’est enregistré. La lecture distante est réservée aux administrateurs ; les utilisateurs peuvent seulement enregistrer leurs propres sessions via la RPC.

Correctif du suivi : les sessions locales transmises sont retirées de la file même si l’application avait été fermée brutalement ; elles ne peuvent plus occuper les 50 premières places indéfiniment. Le démarrage accepte l’état natif initial inconnu et une restauration d’authentification déclenche une tentative d’envoi. L’admin distingue explicitement une migration manquante, une erreur de lecture et une absence réelle de session.
