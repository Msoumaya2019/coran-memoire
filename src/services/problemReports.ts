import * as SQLite from 'expo-sqlite';
import {Directory,File,Paths} from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';
import {AppState,Platform} from 'react-native';
import {supabase} from './sync';
import {loadState} from './storage';
import config from '../../app.json';

export const problemTypes=['Bug','Affichage','Audio','Notification','Autre'] as const;
export type ProblemType=typeof problemTypes[number];
export type ProblemAttachment={uri:string;extension:'jpg'|'png';mime:string};
export type ProblemReport={id:string;user_id:string;type:ProblemType;description:string;screenshot_path:string|null;app_version:string;platform:string;created_at:string;status:'open'|'resolved'};
const bucket='problem-report-screenshots',db=SQLite.openDatabaseSync('coran-problem-reports.db');
db.execSync('CREATE TABLE IF NOT EXISTS problem_report_queue(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,payload TEXT NOT NULL,local_uri TEXT,mime TEXT)');
const uuid=()=>'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return (c==='x'?n:(n&3)|8).toString(16);});
const client=()=>{if(!supabase)throw new Error('Connexion au serveur indisponible.');return supabase;};
export async function chooseProblemScreenshot():Promise<ProblemAttachment|null>{
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,allowsEditing:false,quality:0.8});
 if(result.canceled)return null;
 const asset=result.assets[0],mime=asset.mimeType??(/\.png$/i.test(asset.uri)?'image/png':'image/jpeg');
 if(!['image/png','image/jpeg'].includes(mime))throw new Error('Choisis une capture au format JPEG ou PNG.');
 if(new File(asset.uri).size>5*1024*1024)throw new Error('La capture doit faire moins de 5 Mo.');
 return {uri:asset.uri,extension:mime==='image/png'?'png':'jpg',mime};
}
let flight:Promise<void>|null=null;
export function flushProblemReports():Promise<void>{
 if(flight)return flight;const user=loadState().userId;if(!user)return Promise.resolve();
 flight=(async()=>{do{const rows=db.getAllSync<{id:string;payload:string;local_uri:string|null;mime:string|null}>('SELECT * FROM problem_report_queue WHERE user_id=? ORDER BY rowid',user);
 for(const row of rows){if(loadState().userId!==user)return;const report=JSON.parse(row.payload) as ProblemReport;
 if(row.local_uri&&report.screenshot_path){const bytes=await new File(row.local_uri).bytes();const {error}=await client().storage.from(bucket).upload(report.screenshot_path,bytes,{contentType:row.mime??'image/jpeg',upsert:false});if(error&&!['409','Duplicate'].includes(String(error.statusCode))&&!/already exists|duplicate/i.test(error.message))throw error;}
 if(loadState().userId!==user)return;const {error}=await client().from('app_problem_reports').upsert(report,{onConflict:'id',ignoreDuplicates:true});if(error)throw error;
 const {data,error:confirmation}=await client().from('app_problem_reports').select('id').eq('id',row.id).eq('user_id',user).maybeSingle();if(confirmation)throw confirmation;if(!data)throw new Error('Confirmation du signalement en attente.');
 db.runSync('DELETE FROM problem_report_queue WHERE id=? AND user_id=?',row.id,user);if(row.local_uri){try{new File(row.local_uri).delete();}catch{}}
 }}while(loadState().userId===user&&db.getFirstSync('SELECT id FROM problem_report_queue WHERE user_id=?',user));})().finally(()=>{flight=null;});return flight;
}
export async function sendProblemReport(type:ProblemType,description:string,attachment:ProblemAttachment|null):Promise<'sent'|'queued'>{
 const user=loadState().userId;if(!user)throw new Error('Connecte-toi pour envoyer un signalement.');
 const text=description.trim();if(!problemTypes.includes(type)||!text||text.length>500)throw new Error('Décris le problème en 500 caractères maximum.');
 const id=uuid();let localUri:string|null=null,screenshot:string|null=null;
 if(attachment){const source=new File(attachment.uri);if(source.size>5*1024*1024)throw new Error('La capture doit faire moins de 5 Mo.');const dir=new Directory(Paths.document,'problem-reports');dir.create({idempotent:true,intermediates:true});const file=new File(dir,`${id}.${attachment.extension}`);source.copy(file);localUri=file.uri;screenshot=`${user}/${id}.${attachment.extension}`;}
 const report:ProblemReport={id,user_id:user,type,description:text,screenshot_path:screenshot,app_version:config.expo.version,platform:Platform.OS,created_at:new Date().toISOString(),status:'open'};
 db.runSync('INSERT INTO problem_report_queue(id,user_id,payload,local_uri,mime) VALUES(?,?,?,?,?)',id,user,JSON.stringify(report),localUri,attachment?.mime??null);
 try{const network=await NetInfo.fetch();if(!network.isConnected||network.isInternetReachable===false)return 'queued';await flushProblemReports();}catch{return 'queued';}
 return db.getFirstSync('SELECT id FROM problem_report_queue WHERE id=?',id)?'queued':'sent';
}
export function observeProblemReportSync(){const sync=()=>void flushProblemReports().catch(()=>{});sync();const off=NetInfo.addEventListener(s=>{if(s.isConnected&&s.isInternetReachable!==false)sync();});const foreground=AppState.addEventListener('change',s=>{if(s==='active')sync();});const timer=setInterval(sync,30000);return()=>{off();foreground.remove();clearInterval(timer);};}
export async function adminProblemReports(){const {data,error}=await client().from('app_problem_reports').select('*').order('created_at',{ascending:false}).limit(100);if(error)throw error;return data as ProblemReport[];}
export async function resolveProblemReport(id:string,resolved:boolean){const {error}=await client().from('app_problem_reports').update({status:resolved?'resolved':'open'}).eq('id',id);if(error)throw error;}
export async function problemScreenshotUrl(path:string){const {data,error}=await client().storage.from(bucket).createSignedUrl(path,300);if(error)throw error;return data.signedUrl;}
