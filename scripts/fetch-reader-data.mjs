import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('src/data');
mkdirSync(root, { recursive: true });
async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

const text = await (await download('https://github.com/cpfair/quran-tajweed/files/7281388/quran-uthmani.txt')).text();
const lines = text.trim().split(/\r?\n/).filter(line => /^\d+\|\d+\|/.test(line)).map(line => {
  const match = line.match(/^(\d+)\|(\d+)\|(.+)$/);
  if (!match) throw new Error(`Invalid Tanzil row: ${line.slice(0, 40)}`);
  return { surah: Number(match[1]), ayah: Number(match[2]), text: match[3] };
});
const annotations = await (await download('https://raw.githubusercontent.com/cpfair/quran-tajweed/master/output/tajweed.hafs.uthmani-pause-sajdah.json')).json();
if (lines.length !== 6236 || annotations.length !== 6236) throw new Error('Incomplete Tajweed data');
for (let i = 0; i < 6236; i++) {
  const verse = lines[i], rules = annotations[i];
  if (verse.surah !== rules.surah || verse.ayah !== rules.ayah) throw new Error(`Tajweed verse mismatch ${i}`);
  const length = [...verse.text].length;
  if (rules.annotations.some(rule => rule.start < 0 || rule.end > length || rule.start >= rule.end)) throw new Error(`Tajweed offset mismatch ${i}`);
}
writeFileSync(resolve(root, 'tajweed-text.json'), JSON.stringify(lines));
writeFileSync(resolve(root, 'tajweed-rules.json'), JSON.stringify(annotations));

const translation = [];
for (let surah = 1; surah <= 114; surah++) {
  const result = await (await download(`https://quranenc.com/api/v1/translation/sura/french_rashid/${surah}`)).json();
  if (!Array.isArray(result.result)) throw new Error(`Translation unavailable for surah ${surah}`);
  for (const row of result.result) {
    if (Number(row.sura) !== surah || Number(row.aya) !== translation.filter(v => v.surah === surah).length + 1) throw new Error(`Translation ordering mismatch at ${surah}:${row.aya}`);
    translation.push({ surah, ayah: Number(row.aya), translation: row.translation, footnotes: row.footnotes });
  }
}
if (translation.length !== 6236 || translation.some((row, index) => row.surah !== lines[index].surah || row.ayah !== lines[index].ayah)) throw new Error('Incomplete translation');
writeFileSync(resolve(root, 'translation-fr-rashid.json'), JSON.stringify(translation));
console.log(`Validated ${lines.length} Tajweed verses and ${translation.length} French translations.`);
