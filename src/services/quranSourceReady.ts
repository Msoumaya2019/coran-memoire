import {Asset} from 'expo-asset';
import {File} from 'expo-file-system';
import {ReaderPreferences} from '../core/program';
import {isZipSource} from '../core/quranSources';
import {ensureQuranDownloaded,quranLineUri} from './quranDownload';
import {loadTestPage} from '../coranTest/loadPage';
import {mushafImages} from '../data/mushafImages';
import {mushafTajweedImages} from '../data/mushafTajweedImages';
export async function ensureQuranSourcePage(source:ReaderPreferences['mushaf'],page:number){
 if(!Number.isInteger(page)||page<1||page>604)throw new Error('Page du Coran invalide.');
 if(source==='coranTest'){await loadTestPage(page);return;}
 if(isZipSource(source)){await ensureQuranDownloaded();for(let line=0;line<15;line++)if(!new File(quranLineUri(page,line)).exists)throw new Error('Les images de cette page sont manquantes.');return;}
 if(source==='tajweed')return;
 const asset=(source==='tajweedPages'?mushafTajweedImages:mushafImages)[page];
 if(!asset)throw new Error('Page du Coran indisponible.');
 await Asset.fromModule(asset).downloadAsync();
}
