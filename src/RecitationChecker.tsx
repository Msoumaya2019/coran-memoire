import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,View} from 'react-native';
import {createAudioPlayer,requestRecordingPermissionsAsync,setAudioModeAsync,useAudioStream} from 'expo-audio';
import {Button,Card,colors,Label,Title} from './ui/theme';
import {pageOf,Range,reference,surahAt,verseAt} from './core/quran';
import {modelAvailable,modelDownloadBytes,ensureModel} from './services/recitationRecognition/model';
import {RecitationCapture} from './services/recitationRecognition/capture';
import {TilawaRecognitionEngine} from './services/recitationRecognition/engine';
import {PassageTracker,TrackedVerse,RecognitionSummary} from './services/recitationRecognition/tracker';
import {saveLocalRecitation,saveRecitationAnalysis,syncPendingRecitations} from './services/recitations';
import {supabase} from './services/sync';
import {AudioCommand,PassageAudioPlayer} from './PassageAudioPlayer';

export function RecitationChecker({range,onClose}:{range:Range;onClose:()=>void}){
  const stateColors={pending:colors.muted,recognized:colors.green2,uncertain:'#B77724',omitted:colors.red};
  const stateBackgrounds={pending:'transparent',recognized:colors.soft,uncertain:'#FFF0D8',omitted:'#FCE8E8'};
  const [phase,setPhase]=useState<'ready'|'loading'|'listening'|'result'>('ready');
  const [available,setAvailable]=useState(modelAvailable());
  const [progress,setProgress]=useState(0);
  const [message,setMessage]=useState('');
  const [tracked,setTracked]=useState<TrackedVerse[]>(()=>new PassageTracker(range).snapshot());
  const [summary,setSummary]=useState<RecognitionSummary|null>(null);
  const [reviewOnly,setReviewOnly]=useState(false);
  const [saved,setSaved]=useState(false);
  const [audioCommand,setAudioCommand]=useState<AudioCommand|null>(null);
  const [reviewVerse,setReviewVerse]=useState<number|null>(null);
  const [seconds,setSeconds]=useState(0);
  const tracker=useRef(new PassageTracker(range));
  const engine=useRef<TilawaRecognitionEngine|null>(null);
  const capture=useRef<RecitationCapture|null>(null);
  const playing=useRef<ReturnType<typeof createAudioPlayer>|null>(null);
  const feedQueue=useRef<Promise<void>>(Promise.resolve());
  const active=useRef(false),savedRef=useRef(false),serial=useRef(0);
  const {stream}=useAudioStream({sampleRate:16000,channels:1,encoding:'float32',onBuffer:buffer=>{
    if(!active.current||!capture.current||!engine.current)return;
    try{
      const samples=capture.current.append(buffer.data,buffer.sampleRate,buffer.channels);
      if(samples.length){feedQueue.current=feedQueue.current.then(()=>engine.current?.feed(samples)).then(()=>{}).catch(error=>{active.current=false;setMessage(`Analyse interrompue : ${error?.message??String(error)}`);});}
    }catch(error:any){active.current=false;setMessage(`Microphone interrompu : ${error?.message??String(error)}`);}
  }});
  useEffect(()=>{const timer=setInterval(()=>{if(active.current&&capture.current)setSeconds(Math.floor(capture.current.durationMs/1000));},500);return()=>clearInterval(timer);},[]);
  useEffect(()=>()=>{
    active.current=false;stream.stop();engine.current?.dispose().catch(()=>{});playing.current?.release();
    if(!savedRef.current)capture.current?.discard();
  },[stream]);

  const download=async()=>{
    setPhase('loading');setMessage('Téléchargement du correcteur de récitation…');
    try{await ensureModel((fraction,label)=>{setProgress(Math.round(fraction*100));setMessage(`Téléchargement : ${label}`);});setAvailable(true);setMessage('Correcteur disponible hors ligne.');}
    catch(error:any){setMessage(`Téléchargement impossible : ${error?.message??String(error)}`);}
    finally{setPhase('ready');}
  };

  const start=async()=>{
    if(!available){setMessage('Télécharge d’abord le correcteur.');return;}
    setPhase('loading');setMessage('Chargement du modèle sur ce téléphone…');setReviewOnly(false);setSummary(null);setSaved(false);savedRef.current=false;
    try{
      const permission=await requestRecordingPermissionsAsync();
      if(!permission.granted)throw new Error('Autorise le microphone dans les réglages du téléphone.');
      tracker.current=new PassageTracker(range);setTracked(tracker.current.snapshot());
      const recognizer=new TilawaRecognitionEngine();engine.current=recognizer;
      await recognizer.initialize(range,event=>{tracker.current.accept(event);setTracked(tracker.current.snapshot());});
      if(capture.current&&!savedRef.current)capture.current.discard();
      capture.current=new RecitationCapture();feedQueue.current=Promise.resolve();setSeconds(0);
      await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
      active.current=true;await stream.start();
      setPhase('listening');setMessage('Écoute active · l’analyse reste sur ce téléphone.');
    }catch(error:any){active.current=false;stream.stop();await engine.current?.dispose().catch(()=>{});engine.current=null;capture.current?.discard();capture.current=null;setPhase('ready');setMessage(`Impossible de commencer : ${error?.message??String(error)}`);}
  };

  const finish=async()=>{
    active.current=false;stream.stop();setPhase('loading');setMessage('Analyse de la récitation…');
    try{
      capture.current?.finish();
      await feedQueue.current;
      await engine.current?.stop();
      const result=tracker.current.finish();setTracked(tracker.current.snapshot());setSummary(result);
      setPhase('result');setMessage('Correction automatique expérimentale. Les mots signalés peuvent comporter des erreurs.');
    }catch(error:any){setPhase('result');setSummary(tracker.current.finish());setMessage(`Analyse incomplète : ${error?.message??String(error)}`);}
    finally{await engine.current?.dispose().catch(()=>{});engine.current=null;await setAudioModeAsync({allowsRecording:false}).catch(()=>{});}
  };

  const playback=()=>{
    if(!capture.current?.file.exists)return;
    playing.current?.release();playing.current=createAudioPlayer({uri:capture.current.file.uri});playing.current.play();
  };

  const save=()=>Alert.alert('Conserver cette récitation ?','Elle sera sauvegardée sur ce téléphone puis synchronisée avec Supabase. L’administrateur pourra l’écouter et la corriger, comme tes autres récitations.',[
    {text:'Annuler',style:'cancel'},
    {text:'Conserver',onPress:async()=>{try{
      if(!supabase)throw new Error('Connexion au compte indisponible.');
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('Connecte-toi pour conserver et synchroniser ta récitation.');
      const recorded=capture.current?.file;if(!recorded?.exists)throw new Error('Enregistrement introuvable.');
      const item=await saveLocalRecitation(recorded.uri,range.start,range.end,capture.current!.durationMs,session.user.id);
      const reviewWords=tracked.flatMap(verse=>verse.words.flatMap((word,index)=>verse.states[index]==='uncertain'||verse.states[index]==='omitted'?[{verseId:verse.id,word}]:[]));
      saveRecitationAnalysis(item.id,session.user.id,{...(summary??tracker.current.summary()),reviewWords});
      savedRef.current=true;recorded.delete();setSaved(true);setMessage('Récitation ajoutée à Mes récitations. Synchronisation en cours.');
      syncPendingRecitations().catch(()=>setMessage('Récitation conservée localement. Synchronisation en attente.'));
    }catch(error:any){setMessage(error?.message??String(error));}}},
  ]);

  const restart=()=>{playing.current?.pause();if(!savedRef.current)capture.current?.discard();capture.current=null;setPhase('ready');setSummary(null);setTracked(new PassageTracker(range).snapshot());setMessage('');setSeconds(0);};
  const wordCount=tracked.reduce((count,verse)=>count+verse.words.length,0);
  return <View style={{flex:1,backgroundColor:colors.cream}}>
    <ScrollView contentContainerStyle={{padding:18,paddingBottom:100}}>
      <Pressable onPress={onClose}><Label style={{fontSize:20}}>‹ Retour au Coran</Label></Pressable>
      <Title>Vérifier ma récitation</Title>
      <Label style={{color:colors.muted,marginTop:6}}>{reference(range)} · {wordCount} mots</Label>
      <Label style={{fontSize:12,color:colors.muted,marginTop:4}}>Correction automatique expérimentale</Label>
      {!available&&<Card><Label style={{fontWeight:'700'}}>Correcteur hors ligne</Label><Label style={{color:colors.muted,marginVertical:8}}>Téléchargement unique · environ {Math.round(modelDownloadBytes/1000000)} Mo. L’audio est analysé sur ton téléphone.</Label><Button disabled={phase==='loading'} onPress={download}>{phase==='loading'?`Téléchargement ${progress} %`:'Télécharger le correcteur de récitation'}</Button></Card>}
      {available&&phase==='ready'&&<Button onPress={start}>🎙 Commencer ma récitation</Button>}
      {phase==='listening'&&<Card><Label style={{fontWeight:'700',color:colors.red}}>● Écoute active · {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</Label><Button onPress={finish}>Terminer ma récitation</Button></Card>}
      {phase==='loading'&&available&&<Card><Label>Préparation du correcteur…</Label></Card>}
      {!!message&&<Label style={{color:colors.muted,fontSize:12,marginVertical:10}}>{message}</Label>}
      {summary&&<Card><Label style={{fontWeight:'700',fontSize:18}}>Récitation terminée</Label><Label style={{marginTop:8}}>✅ {summary.recognized} mots reconnus</Label><Label>🟠 {summary.uncertain} mots à vérifier</Label><Label>🔴 {summary.omitted} passages potentiellement omis</Label><Button secondary onPress={()=>setReviewOnly(!reviewOnly)}>{reviewOnly?'Voir tout le passage':'Revoir mes erreurs'}</Button><Button secondary onPress={playback}>▶ Réécouter ma récitation</Button>{!saved&&<Button onPress={save}>Conserver dans Mes récitations</Button>}<Button secondary onPress={restart}>Recommencer</Button><Button secondary onPress={onClose}>Terminer</Button></Card>}
      {tracked.map(verse=>{
        const displayed=verse.words.map((word,index)=>({word,index,status:verse.states[index]})).filter(item=>!reviewOnly||item.status==='uncertain'||item.status==='omitted');
        if(!displayed.length)return null;
        return <Card key={verse.id}><Label style={{fontWeight:'700',marginBottom:10}}>{surahAt(verse.id).name} · verset {verseAt(verse.id).ayah}</Label><Text style={{fontSize:24,lineHeight:48,textAlign:'right',writingDirection:'rtl',color:colors.text}}>{displayed.map(item=><Text key={item.index} style={{color:stateColors[item.status],backgroundColor:stateBackgrounds[item.status]}}>{item.word} </Text>)}</Text>{reviewOnly&&<Button small secondary onPress={()=>{setReviewVerse(verse.id);setAudioCommand({serial:++serial.current,id:verse.id,action:'listen'});}}>▶ Écouter ce verset</Button>}</Card>;
      })}
      {reviewVerse!==null&&<PassageAudioPlayer sessionRange={{start:reviewVerse,end:reviewVerse}} page={pageOf(reviewVerse)} command={audioCommand} onVerseChange={()=>{}} hideLaunch />}
    </ScrollView>
  </View>;
}
