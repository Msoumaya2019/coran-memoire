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

export function revisionReminderDates(dueDates:string[],enabled:boolean,now=new Date()):Date[]{
  if(!enabled)return [];
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),19);
  const overdue=dueDates.some(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(`${value}T19:00:00`)<=now);
  const dates=[...new Set(dueDates)].filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value))
    .map(value=>new Date(`${value}T19:00:00`)).filter(date=>!Number.isNaN(date.getTime())&&date>now);
  if(overdue)dates.push(today>now?today:new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,19));
  return [...new Map(dates.map(date=>[date.getTime(),date])).values()]
    .sort((a,b)=>a.getTime()-b.getTime()).slice(0,32);
}
