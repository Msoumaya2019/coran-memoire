import {Range,verseId} from '../../core/quran';
import {ensureModel} from './model';

export type RecognitionEvent=
  |{type:'word_progress';verseId:number;totalWords:number;matchedIndices:number[]}
  |{type:'verse_match';verseId:number;confidence:number}
  |{type:'raw_transcript';text:string;confidence:number}
  |{type:'final_sequence';verseIds:number[];confidence:number};

export interface RecitationRecognitionEngine{
  initialize(expectedPassage:Range,onEvent:(event:RecognitionEvent)=>void):Promise<void>;
  feed(audio16k:Float32Array):Promise<void>;
  stop():Promise<void>;
  dispose():Promise<void>;
}

export class TilawaRecognitionEngine implements RecitationRecognitionEngine{
  private session:import('@tilawa/core').TilawaSession|null=null;
  private runtimeSession:import('onnxruntime-react-native').InferenceSession|null=null;
  private expected:Range|null=null;
  private onEvent:((event:RecognitionEvent)=>void)|null=null;

  async initialize(expectedPassage:Range,onEvent:(event:RecognitionEvent)=>void){
    if(expectedPassage.start<1||expectedPassage.end>6236||expectedPassage.start>expectedPassage.end)throw new Error('Passage coranique invalide.');
    this.expected=expectedPassage;this.onEvent=onEvent;
    const files=await ensureModel();
    const [{createTilawaSession,CONSERVATIVE_STREAMING_CONFIG},ort]=await Promise.all([import('@tilawa/core'),import('onnxruntime-react-native')]);
    const [vocab,tokens,quran]=await Promise.all([files.vocab.json(),files.tokens.json(),files.quran.json()]);
    const allowed=new Set<string>();
    const selected=(quran as {surah:number;ayah:number}[]).filter(verse=>{
      const id=verseId(verse.surah,verse.ayah);
      if(id===null||id<expectedPassage.start||id>expectedPassage.end)return false;
      allowed.add(`${verse.surah}:${verse.ayah}`);return true;
    });
    if(!selected.length)throw new Error('Aucun verset trouvé pour ce passage.');
    const selectedTokens:Record<string,number[]>={};
    for(const [key,value] of Object.entries(tokens as Record<string,number[]>)){
      const parts=key.split(':');
      if(parts.length===3&&allowed.has(`${parts[0]}:${parts[1]}`)&&allowed.has(`${parts[0]}:${parts[2]}`))selectedTokens[key]=value;
    }
    const modelPath=files.model.uri.replace(/^file:\/\//,'');
    this.runtimeSession=await ort.InferenceSession.create(modelPath);
    this.session=createTilawaSession({run:async audio=>{
      if(!this.runtimeSession)throw new Error('Correcteur indisponible.');
      const signal=new ort.Tensor('float32',audio,[1,audio.length]);
      const length=new ort.Tensor('int64',BigInt64Array.from([BigInt(audio.length)]),[1]);
      const output=await this.runtimeSession.run({audio_signal:signal,length});
      const result=output[this.runtimeSession.outputNames[0]];
      const [,timeSteps,vocabSize]=result.dims as number[];
      return {logprobs:result.data as Float32Array,timeSteps,vocabSize};
    }},{vocab,quranCtcTokens:selectedTokens,quran:selected},{
      config:CONSERVATIVE_STREAMING_CONFIG,
      onOutput:event=>{
        if(!this.onEvent||!this.expected)return;
        if(event.type==='word_progress'||event.type==='verse_match'){
          const id=verseId(event.surah,event.ayah);
          if(id===null||id<this.expected.start||id>this.expected.end)return;
          if(event.type==='word_progress')this.onEvent({type:'word_progress',verseId:id,totalWords:event.total_words,matchedIndices:event.matched_indices});
          else this.onEvent({type:'verse_match',verseId:id,confidence:event.confidence});
        }else if(event.type==='raw_transcript')this.onEvent({type:'raw_transcript',text:event.text,confidence:event.confidence});
        else if(event.type==='final_sequence')this.onEvent({type:'final_sequence',verseIds:event.verses.map(verse=>verseId(verse.surah,verse.ayah)).filter((id):id is number=>id!==null&&id>=this.expected!.start&&id<=this.expected!.end),confidence:event.confidence});
      },
    });
  }

  async feed(audio16k:Float32Array){if(!this.session)throw new Error('Correcteur non chargé.');await this.session.feed(audio16k);}
  async stop(){if(this.session)await this.session.feed(new Float32Array(32000));}
  async dispose(){this.session=null;this.onEvent=null;await this.runtimeSession?.release();this.runtimeSession=null;}
}
