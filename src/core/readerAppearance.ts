export const quranPaperOptions=[
 {key:'ivory',label:'Ivoire',color:'#faf7f2'},
 {key:'rose',label:'Rosé',color:'#f5e1e7'},
 {key:'sand',label:'Sable',color:'#e8dcc8'},
 {key:'sepia',label:'Sépia',color:'#d7c5ad'},
] as const;
export type QuranPaper=typeof quranPaperOptions[number]['key'];
export function quranPaperColor(key?:string){return (quranPaperOptions.find(option=>option.key===key)??quranPaperOptions[0]).color;}
