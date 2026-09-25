import {normalizeArabic} from './normalization';

export type WordState='pending'|'recognized'|'uncertain'|'omitted';

function similarity(a:string,b:string){
  if(a===b)return 1;
  if(!a.length||!b.length)return 0;
  const row=Array.from({length:b.length+1},(_,index)=>index);
  for(let i=1;i<=a.length;i++){
    let previous=row[0];row[0]=i;
    for(let j=1;j<=b.length;j++){
      const current=row[j];
      row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));
      previous=current;
    }
  }
  return 1-row[b.length]/Math.max(a.length,b.length);
}

export function alignWords(expected:string[],spoken:string[],final=false):WordState[]{
  const a=expected.map(normalizeArabic),b=spoken.map(normalizeArabic);
  const costs=Array.from({length:a.length+1},()=>Array<number>(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)costs[i][0]=i;
  for(let j=0;j<=b.length;j++)costs[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    const score=similarity(a[i-1],b[j-1]);
    costs[i][j]=Math.min(costs[i-1][j]+1,costs[i][j-1]+(b[j-1]===b[j-2]?0.25:1),costs[i-1][j-1]+(score===1?0:score>=0.75?0.45:1.2));
  }
  const result:WordState[]=Array(a.length).fill('pending');
  const end=final?a.length:costs.reduce((best,row,index)=>row[b.length]<costs[best][b.length]?index:best,0);
  let i=end,j=b.length;
  while(i>0||j>0){
    if(i>0&&j>0){
      const score=similarity(a[i-1],b[j-1]);
      const substitution=score===1?0:score>=0.75?0.45:1.2;
      if(Math.abs(costs[i][j]-(costs[i-1][j-1]+substitution))<0.001){
        result[i-1]=score===1?'recognized':'uncertain';i--;j--;continue;
      }
    }
    if(j>0&&Math.abs(costs[i][j]-(costs[i][j-1]+(b[j-1]===b[j-2]?0.25:1)))<0.001){j--;continue;}
    if(i>0){result[i-1]='uncertain';i--;continue;}
    j--;
  }
  let lastMatched=-1;
  for(let index=result.length-1;index>=0;index--)if(result[index]==='recognized'){lastMatched=index;break;}
  for(let index=0;index<result.length;index++){
    if(result[index]!=='uncertain'||index>=lastMatched)continue;
    const following=result.slice(index+1,index+4).filter(value=>value==='recognized').length;
    if(following>=2&&final)result[index]='omitted';
  }
  if(final&&b.length===0)return result.map(()=> 'uncertain');
  return result;
}
