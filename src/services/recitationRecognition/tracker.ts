import {Range,verseAt} from '../../core/quran';
import {arabicWords} from './normalization';
import {alignWords,WordState} from './alignment';
import type {RecognitionEvent} from './engine';

export type TrackedVerse={id:number;words:string[];states:WordState[]};
export type RecognitionSummary={recognized:number;uncertain:number;omitted:number};

export class PassageTracker{
  readonly verses:TrackedVerse[];
  private matches=new Map<number,Map<number,number>>();
  private incompatible=new Set<number>();
  private seenVerses=new Set<number>();
  private transcript='';
  private transcriptConfidence=0;
  private finalSequence:number[]=[];

  constructor(private range:Range){
    this.verses=Array.from({length:range.end-range.start+1},(_,i)=>{
      const id=range.start+i,words=arabicWords(verseAt(id).text);
      return {id,words,states:words.map(()=>'pending' as WordState)};
    });
  }

  accept(event:RecognitionEvent){
    if(event.type==='word_progress'){
      const verse=this.verses.find(item=>item.id===event.verseId);
      if(!verse)return;
      if(event.totalWords!==verse.words.length){this.incompatible.add(event.verseId);return;}
      const matched=this.matches.get(event.verseId)??new Map<number,number>();
      for(const index of new Set(event.matchedIndices))if(index>=0&&index<verse.words.length)matched.set(index,(matched.get(index)??0)+1);
      this.matches.set(event.verseId,matched);
      this.seenVerses.add(event.verseId);
    }else if(event.type==='verse_match'){
      if(event.confidence>=0.65)this.seenVerses.add(event.verseId);
    }else if(event.type==='raw_transcript'){
      if(event.confidence>=this.transcriptConfidence||!this.transcript){this.transcript=event.text;this.transcriptConfidence=event.confidence;}
    }else if(event.type==='final_sequence')this.finalSequence=event.verseIds;
    this.refresh(false);
  }

  finish(){this.refresh(true);return this.summary();}

  summary():RecognitionSummary{
    const all=this.verses.flatMap(verse=>verse.states);
    return {recognized:all.filter(state=>state==='recognized').length,uncertain:all.filter(state=>state==='uncertain').length,omitted:all.filter(state=>state==='omitted').length};
  }

  snapshot():TrackedVerse[]{return this.verses.map(verse=>({...verse,states:[...verse.states]}));}

  private refresh(final:boolean){
    const flat=this.verses.flatMap(verse=>verse.words);
    const tentative=this.transcriptConfidence>=0.25?alignWords(flat,arabicWords(this.transcript),false):[];
    let offset=0;
    const confirmed=new Set([...this.seenVerses,...this.finalSequence]);
    for(const verse of this.verses){
      const matched=this.matches.get(verse.id);
      const hasLaterVerse=[...confirmed].some(id=>id>verse.id&&id<=this.range.end);
      verse.states=verse.words.map((_,index)=>{
        const hits=matched?.get(index)??0;
        if(hits>=(final?1:2))return 'recognized';
        const later=matched?[...matched.keys()].filter(key=>key>index&&key<=index+4).length:0;
        if(final&&!this.incompatible.has(verse.id)&&later>=2)return 'omitted';
        if(final&&!confirmed.has(verse.id)&&hasLaterVerse&&this.finalSequence.length>0)return 'omitted';
        if(hits>0||confirmed.has(verse.id)||tentative[offset+index]!=='pending'&&tentative[offset+index]!==undefined)return 'uncertain';
        return final?'uncertain':'pending';
      });
      offset+=verse.words.length;
    }
  }
}
