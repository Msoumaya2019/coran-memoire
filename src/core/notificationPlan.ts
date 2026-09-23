// Les jours du programme sont ceux de Date.getDay() : dimanche = 0.
// Expo utilise dimanche = 1 pour les déclencheurs hebdomadaires.
export const learningReminderTitle = "🌙 C'est l'heure d'apprendre le Coran !";
export const learningReminderBody = 'Le Prophète ﷺ a dit :\n\n« Le meilleur d\'entre vous est celui qui apprend le Coran et l\'enseigne. »\n\nSahih Al-Bukhari, n° 5027.';

export type ReminderPlan = { day: number; expoWeekday: number; hour: 19; minute: 0 };
export function reminderPlan(days:number[],enabled:boolean):ReminderPlan[]{
  if(!enabled)return [];
  return [...new Set(days)].filter(day=>Number.isInteger(day)&&day>=0&&day<=6)
    .sort((a,b)=>a-b).map(day=>({day,expoWeekday:day+1,hour:19,minute:0}));
}
