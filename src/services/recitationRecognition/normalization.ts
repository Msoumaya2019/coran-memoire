export function normalizeArabic(input:string):string{
  return input.normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
    .replace(/[^\u0621-\u064A\s]/g,' ')
    .replace(/\s+/g,' ').trim();
}

export function arabicWords(input:string):string[]{
  return input.split(/\s+/).map(word=>word.trim()).filter(word=>normalizeArabic(word).length>0);
}
