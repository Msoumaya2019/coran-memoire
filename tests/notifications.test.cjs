const test=require('node:test');
const assert=require('node:assert/strict');
const {reminderPlan,learningReminderTitle,learningReminderBody}=require('./build/core/notificationPlan.js');

test('les rappels suivent seulement les jours choisis à 19 h, sans doublon',()=>{
  assert.deepEqual(reminderPlan([1,2,3,4,5,3],true).map(x=>[x.expoWeekday,x.hour,x.minute]),
    [[2,19,0],[3,19,0],[4,19,0],[5,19,0],[6,19,0]]);
  assert.deepEqual(reminderPlan([1,2,5],true).map(x=>x.day),[1,2,5]);
  assert.deepEqual(reminderPlan([1,2,5],false),[]);
  assert.deepEqual(reminderPlan([-1,7,2.5],true),[]);
});

test('le rappel conserve exactement le hadith et sa référence',()=>{
  assert.equal(learningReminderTitle,"🌙 C'est l'heure d'apprendre le Coran !");
  assert.equal(learningReminderBody,'Le Prophète ﷺ a dit :\n\n« Le meilleur d\'entre vous est celui qui apprend le Coran et l\'enseigne. »\n\nSahih Al-Bukhari, n° 5027.');
});

test('19 h locales reste la cible lors des changements d’heure de Paris',()=>{
  const format=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  assert.equal(format.format(new Date('2026-03-23T18:00:00Z')),'19:00');
  assert.equal(format.format(new Date('2026-03-30T17:00:00Z')),'19:00');
  assert.equal(format.format(new Date('2026-10-19T17:00:00Z')),'19:00');
  assert.equal(format.format(new Date('2026-10-26T18:00:00Z')),'19:00');
  assert.equal(reminderPlan([1],true)[0].hour,19);
});
