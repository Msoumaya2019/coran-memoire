import {File,FileHandle,FileMode,Paths} from 'expo-file-system';

function wavHeader(sampleCount:number){
  const bytes=new Uint8Array(44),view=new DataView(bytes.buffer);
  const label=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
  label(0,'RIFF');view.setUint32(4,36+sampleCount*2,true);label(8,'WAVE');label(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  label(36,'data');view.setUint32(40,sampleCount*2,true);
  return bytes;
}

export class RecitationCapture{
  readonly file:File;
  private handle:FileHandle;
  private inputFrames=0;
  private outputAt=0;
  private previous=0;
  private sampleCount=0;
  private closed=false;

  constructor(){
    this.file=new File(Paths.cache,`recitation-check-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    this.file.create();
    this.handle=this.file.open(FileMode.ReadWrite);
    this.handle.writeBytes(wavHeader(0));
  }

  append(data:ArrayBuffer,sampleRate:number,channels:number):Float32Array{
    if(this.closed||sampleRate<=0||channels<1)return new Float32Array();
    const input=new Float32Array(data),frames=Math.floor(input.length/channels);
    if(!frames)return new Float32Array();
    const mono=new Float32Array(frames);
    for(let i=0;i<frames;i++){
      let sum=0;for(let channel=0;channel<channels;channel++)sum+=input[i*channels+channel];
      mono[i]=sum/channels;
    }
    const start=this.inputFrames,end=start+frames,step=sampleRate/16000;
    const output:number[]=[];
    while(this.outputAt<end-1){
      const relative=this.outputAt-start;
      const left=Math.floor(relative),fraction=relative-left;
      const before=left<0?this.previous:mono[left];
      const after=left+1<0?this.previous:mono[left+1];
      output.push(before+(after-before)*fraction);
      this.outputAt+=step;
    }
    this.inputFrames=end;this.previous=mono[frames-1];
    const samples=Float32Array.from(output),pcm=new Uint8Array(samples.length*2),view=new DataView(pcm.buffer);
    for(let i=0;i<samples.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);
    this.handle.writeBytes(pcm);this.sampleCount+=samples.length;
    return samples;
  }

  finish(){
    if(this.closed)return this.file;
    this.handle.offset=0;this.handle.writeBytes(wavHeader(this.sampleCount));this.handle.close();this.closed=true;
    return this.file;
  }

  discard(){this.finish();if(this.file.exists)this.file.delete();}
  get durationMs(){return Math.round(this.sampleCount/16);}
}
