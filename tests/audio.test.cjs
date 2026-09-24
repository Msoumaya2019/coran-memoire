const test=require('node:test');
const assert=require('node:assert/strict');
const {nextAudioPosition,verseAudioUrl,audioRange,reciters,resolveAudioSegment,verseAudioLabel}=require('./build/core/audio.js');
const {verseId}=require('./build/core/quran.js');

function play(range,count,mode='passage'){
  const sequence=[];let current={verseId:range.start,repetition:1};
  while(current){sequence.push([current.verseId,current.repetition]);assert.ok(sequence.length<1000);current=nextAudioPosition(range,current,mode,count);}
  return sequence;
}

for(const count of [1,2,3,5,10])test(`${count} écoute(s) du passage complet`,()=>{
  const actual=play({start:1,end:3},count);
  assert.equal(actual.length,3*count);
  for(let repetition=1;repetition<=count;repetition++)assert.deepEqual(actual.slice((repetition-1)*3,repetition*3),[[1,repetition],[2,repetition],[3,repetition]]);
});

test('répéter chaque verset suit un ordre distinct',()=>{
  assert.deepEqual(play({start:1,end:3},2,'each-verse'),[[1,1],[1,2],[2,1],[2,2],[3,1],[3,2]]);
});

test('continu et arrêt automatique désactivé reprennent au début du passage',()=>{
  assert.deepEqual(nextAudioPosition({start:5,end:6},{verseId:6,repetition:12},'passage','continuous'),{verseId:5,repetition:13});
  assert.deepEqual(nextAudioPosition({start:5,end:6},{verseId:6,repetition:1},'passage',1,false),{verseId:5,repetition:2});
});

test('l’audio ne sort pas du passage et utilise le numéro global Hafs',()=>{
  assert.equal(verseAudioUrl(1),'https://cdn.islamic.network/quran/audio/128/ar.husary/1.mp3');
  assert.equal(verseAudioUrl(1,reciters[1]),'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3');
  assert.equal(verseAudioUrl(1,reciters[2]),'https://cdn.islamic.network/quran/audio/128/ar.minshawi/1.mp3');
  assert.deepEqual(audioRange(2,4),{start:2,end:4});
  assert.throws(()=>audioRange(4,2));
  assert.throws(()=>verseAudioUrl(6237));
});

test('le lecteur nomme séparément la sourate et le verset',()=>{
  assert.equal(verseAudioLabel(verseId(114,1)),'sourate 114, verset 1');
});

test('seuls les trois récitateurs Hafs retenus sont proposés',async()=>{
  assert.deepEqual(reciters.map(r=>r.name),['Mahmoud Khalil Al-Husary','Mishary Rashid Alafasy','Mohammed Siddiq Al-Minshawi']);
  for(const reciter of reciters)assert.deepEqual(await resolveAudioSegment(verseId(114,1),reciter),{
    url:`https://cdn.islamic.network/quran/audio/128/${reciter.id}/${verseId(114,1)}.mp3`,
  });
});
