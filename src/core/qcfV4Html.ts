import {QcfV4Page} from './qcfV4';

function escapeHtml(text:string){return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function glyph(code:string){return code.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_,hex:string,decimal:string)=>{
  const number=parseInt(hex??decimal,hex?16:10);
  return number>0&&number<=0x10ffff?String.fromCodePoint(number):'';
});}

/** Each span belongs to the same QCF V4 page font and carries its exact verse ID. */
export function qcfV4Html(data:QcfV4Page,playingVerseId:number|null,difficultyIds:number[],sessionStart:number,sessionEnd:number){
  const font=`https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p${data.page}.woff2`;
  const lines=data.lines.map(line=>`<div class="line" data-line="${line.number}">${line.words.map(word=>{
    const classes=['word',word.kind==='end'?'end':'',word.verseId===playingVerseId?'playing':'',difficultyIds.includes(word.verseId)?'difficult':'',word.verseId>=sessionStart&&word.verseId<=sessionEnd?'session':''].filter(Boolean).join(' ');
    const content=word.kind==='end'?(word.unicode||'۝'):glyph(word.glyph);
    return `<span class="${classes}" data-verse="${word.verseId}">${escapeHtml(content)}</span>`;
  }).join('')}</div>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta charset="utf-8"><style>
@font-face{font-family:qcf;src:url('${font}') format('woff2');font-display:block}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fffdf7;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#page{height:100%;width:100%;padding:4% 3%;display:flex;flex-direction:column;justify-content:space-around;align-items:stretch;border:5px double #d8c394;border-radius:10px;overflow:hidden}
.line{display:flex;justify-content:center;align-items:center;white-space:nowrap;direction:rtl;min-height:0;flex:1;gap:0;font-family:qcf;font-size:clamp(19px,6.4vw,38px);line-height:1.1}
.word{display:inline-block;position:relative;border-radius:5px;flex-shrink:1;min-width:0}
.word.playing{background:rgba(194,90,132,.24);box-shadow:inset 0 -2px 0 rgba(171,59,106,.75)}
.word.difficult{background:rgba(225,67,67,.22)}.word.session:not(.playing):not(.difficult){background:rgba(207,178,104,.07)}
.end{font-family:serif;color:#b99b59;font-size:.75em;margin-inline:1px}
</style></head><body><main id="page">${lines}</main><script>
const bridge=window.ReactNativeWebView;let timer=null,startX=0,startY=0,held=false;
function emit(value){bridge&&bridge.postMessage(JSON.stringify(value))}
document.addEventListener('touchstart',e=>{const point=e.touches[0];startX=point.clientX;startY=point.clientY;held=false;const word=e.target.closest('[data-verse]');if(word)timer=setTimeout(()=>{held=true;emit({type:'verse',id:Number(word.dataset.verse)})},500)}, {passive:true});
document.addEventListener('touchmove',e=>{const p=e.touches[0];if(Math.abs(p.clientX-startX)>12||Math.abs(p.clientY-startY)>12)clearTimeout(timer)},{passive:true});
document.addEventListener('touchend',()=>{clearTimeout(timer);if(!held)emit({type:'tap'})},{passive:true});
document.addEventListener('contextmenu',e=>e.preventDefault());
function setPlaying(id){document.querySelectorAll('.playing').forEach(w=>w.classList.remove('playing'));if(id!==null)document.querySelectorAll('[data-verse="'+id+'"]').forEach(w=>w.classList.add('playing'))}
function fitLines(){document.querySelectorAll('.line').forEach(line=>{let size=Math.min(38,Math.max(19,innerWidth*.064));line.style.fontSize=size+'px';while(line.scrollWidth>line.clientWidth+2&&size>13){size-=1;line.style.fontSize=size+'px'}if(line.scrollWidth>line.clientWidth+2)emit({type:'font-error'})})}
document.fonts.load('24px qcf').then(()=>{fitLines();emit({type:'ready'})}).catch(()=>emit({type:'font-error'}));
</script></body></html>`;
}
