/** A compact inline ornament for a QCF V4 ayah end. The number always comes from verse_key. */
export function easternArabicNumber(value:number):string {
  if(!Number.isInteger(value)||value<1)throw new Error('Numéro de verset invalide.');
  return String(value).replace(/[0-9]/g,digit=>'٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
}

export function ayahMarkerHtml(verseKey:string):string {
  const match=/^(\d{1,3}):(\d{1,3})$/.exec(verseKey);
  if(!match)throw new Error('Référence de verset invalide.');
  const surah=Number(match[1]),ayah=Number(match[2]);
  if(surah<1||surah>114||ayah<1)throw new Error('Référence de verset invalide.');
  const number=easternArabicNumber(ayah);
  const size=number.length>2?16:19;
  return `<svg class="ayah-ornament" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 2 40 9 52 10 54 22 62 32 54 42 52 54 40 55 32 62 24 55 12 54 10 42 2 32 10 22 12 10 24 9Z" fill="#c8a350" stroke="#24434b" stroke-width="2"/><path d="M32 7 39 14 49 15 50 24 57 32 50 40 49 49 39 50 32 57 25 50 15 49 14 40 7 32 14 24 15 15 25 14Z" fill="#e8cf88" stroke="#fff7d6" stroke-width="1.5"/><circle cx="32" cy="32" r="20" fill="#f8f1da" stroke="#1e7080" stroke-width="2.5"/><circle cx="32" cy="32" r="17" fill="none" stroke="#cfac5c" stroke-width="1"/><text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="serif" font-size="${size}" fill="#173b48">${number}</text></svg>`;
}
