import {Platform} from 'react-native';
import {File,Paths} from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {capturedPagesHtml} from '../core/annotationExport';
export async function shareAnnotationText(text:string){
 if(Platform.OS==='web'){const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='coran-mes-annotations.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
 const file=new File(Paths.cache,`coran-notes-${Date.now()}.txt`);file.write(text);
 if(!await Sharing.isAvailableAsync())throw Error('Le partage de fichiers est indisponible sur cet appareil.');
 await Sharing.shareAsync(file.uri,{mimeType:'text/plain',UTI:'public.plain-text',dialogTitle:'Exporter mes annotations'});
}
export async function shareCapturedPages(uris:string[],format:'png'|'pdf'){
 if(Platform.OS==='web')throw Error('L’export des pages en image ou PDF est disponible dans l’application iOS ou Android.');
 if(!await Sharing.isAvailableAsync())throw Error('Le partage de fichiers est indisponible sur cet appareil.');
 if(format==='png'){if(uris.length!==1)throw Error('Une seule page peut être exportée en PNG.');await Sharing.shareAsync(uris[0],{mimeType:'image/png',UTI:'public.png',dialogTitle:'Page du Coran annotée'});return;}
 const images=[];for(const uri of uris)images.push('data:image/png;base64,'+await new File(uri).base64());
 const pdf=await Print.printToFileAsync({html:capturedPagesHtml(images),width:595,height:842,margins:{top:0,left:0,right:0,bottom:0}});
 await Sharing.shareAsync(pdf.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf',dialogTitle:'Pages du Coran annotées'});
}
