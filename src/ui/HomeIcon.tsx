import React from 'react';
import Svg,{Path,Circle,Rect,Text as SvgText,G} from 'react-native-svg';
export type HomeIconKind='book'|'learn'|'review'|'translate'|'reminders'|'resume';
export const iconBackgrounds={book:'#F0E8FA',learn:'#FCEBF2',review:'#E8F5EF',translate:'#FFF5E7',reminders:'#F8EAF8',resume:'#5F548E'};
export function HomeIcon({kind,size=36}:{kind:HomeIconKind;size?:number}){
 const purple=kind==='resume'?'#C7B2E4':'#795B9A',gold='#D8B578',cream='#FFF4DD';
 const book=<G><Path d="M9 19v27q12-2 23 5 11-7 23-5V19" fill={gold} stroke={purple} strokeWidth="2"/><Path d="M12 14q12-2 20 8 8-10 20-8v29q-12-1-20 8-8-9-20-8z" fill={purple} stroke="#E5D8F5" strokeWidth="2.5"/><Path d="M32 22v28M17 23q6 0 10 4m-10 4q6 0 10 4m-10 4q6 0 10 4m10-16q4-4 10-4m-10 12q4-4 10-4m-10 12q4-4 10-4" fill="none" stroke="#DDD0EF" strokeWidth="2" strokeLinecap="round"/><Path d="M29 51v9l3-3 3 3v-9" fill={gold}/></G>;
 return <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
 {kind==='book'&&book}
 {kind==='resume'&&<><G transform="translate(1 10) scale(.86)">{book}</G><Path d="M36 18q6-12 19-11m-7-5 8 5-7 6" fill="none" stroke={gold} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></>}
 {kind==='learn'&&<><Path d="M17 30v16q15 14 30 0V30" fill={purple}/><Path d="M4 24 32 10l28 14-28 14z" fill={purple} stroke="#BBA5D3" strokeWidth="2"/><Path d="m32 24 19 7v20" fill="none" stroke={gold} strokeWidth="3"/><Circle cx="51" cy="49" r="3" fill={gold}/><Rect x="48" y="51" width="6" height="9" rx="2" fill={gold}/></>}
 {kind==='review'&&<G stroke="#448E86" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"><Path d="M12 25a21 21 0 0 1 39-5l2 5m0-13v13H41M52 39a21 21 0 0 1-39 5l-2-5m0 13V39h12"/></G>}
 {kind==='translate'&&<><Rect x="29" y="24" width="29" height="33" rx="7" fill={gold}/><Path d="m34 55-6 6v-10" fill={gold}/><Rect x="6" y="7" width="31" height="36" rx="7" fill={purple}/><Path d="m28 40 7 9v-13" fill={purple}/><SvgText x="21" y="33" textAnchor="middle" fontSize="27" fontWeight="700" fill={cream}>A</SvgText><SvgText x="44" y="49" textAnchor="middle" fontSize="27" fill="#55416F">ع</SvgText></>}
 {kind==='reminders'&&<><Path d="M34 3a10 10 0 1 0 12 12A11 11 0 0 1 34 3" fill={gold}/><Path d="M13 42q-2-10 14-20 16 10 14 20zM15 43h24v16H15zM5 48q5-9 9 0v11H5zM47 29h8v30h-8zM47 27q-4-6 4-12 8 6 4 12z" fill={purple}/><Path d="M23 59v-9a4 4 0 0 1 8 0v9" fill={cream}/><Path d="m9 22 2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill={gold}/><Circle cx="27" cy="21" r="2" fill={purple}/></>}
 </Svg>;
}
