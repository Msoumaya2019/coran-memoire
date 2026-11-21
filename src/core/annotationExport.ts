export function exportPageNumbers(input:string,max=20){
 const pages=new Set<number>();
 for(const part of input.split(',').map(v=>v.trim()).filter(Boolean)){
  const match=/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?$/.exec(part);
  if(!match)throw Error('Utilise des numéros de page ou des plages, par exemple 3, 5–8 (avec un tiret simple).');
  const start=Number(match[1]),end=Number(match[2]??match[1]);
  if(start<1||end>604||end<start)throw Error('Les pages doivent être comprises entre 1 et 604.');
  for(let p=start;p<=end;p++){pages.add(p);if(pages.size>max)throw Error(`Choisis au maximum ${max} pages par export.`);}
 }
 if(!pages.size)throw Error('Choisis au moins une page.');
 return [...pages].sort((a,b)=>a-b);
}
export function capturedPagesHtml(images:string[]){
 if(!images.length||images.some(value=>!/^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/.test(value)))throw Error('Image de page invalide.');
 return '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white}.sheet{width:595pt;height:842pt;display:flex;align-items:center;justify-content:center;page-break-after:always;break-after:page}.sheet:last-child{page-break-after:auto;break-after:auto}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>'+images.map(uri=>'<div class="sheet"><img src="'+uri+'"></div>').join('')+'</body></html>';
}
