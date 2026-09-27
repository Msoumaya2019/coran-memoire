import type {AppState} from './program';
import {pageOf,verseAt,verses} from './quran';

export type VerseBookmark={verseId:number;surah:number;ayah:number;page:number;createdAt:string;updatedAt:string;lastUsedAt?:string;deletedAt?:string};
export function saveBookmark(state:AppState,id:number,at=new Date().toISOString()):AppState{
  if(!Number.isInteger(id)||id<1||id>verses.length)throw new Error('Verset inexistant.');
  const verse=verseAt(id),old=state.bookmarks?.[id];
  return {...state,updatedAt:at,lastRead:{page:pageOf(id),verseId:id,readAt:at},bookmarks:{...state.bookmarks,[id]:{verseId:id,surah:verse.surah,ayah:verse.ayah,page:pageOf(id),createdAt:old?.createdAt??at,updatedAt:at}}};
}
export function deleteBookmark(state:AppState,id:number,at=new Date().toISOString()):AppState{
  const item=state.bookmarks?.[id];if(!item)return state;
  return {...state,updatedAt:at,bookmarks:{...state.bookmarks,[id]:{...item,deletedAt:at,updatedAt:at}}};
}
export function useBookmark(state:AppState,id:number,at=new Date().toISOString()):AppState{
  const item=state.bookmarks?.[id];if(!item||item.deletedAt)return state;
  return {...state,updatedAt:at,lastRead:{page:pageOf(id),verseId:id,readAt:at},bookmarks:{...state.bookmarks,[id]:{...item,lastUsedAt:at,updatedAt:at}}};
}
export function visibleBookmarks(state:AppState):VerseBookmark[]{return Object.values(state.bookmarks??{}).filter(b=>!b.deletedAt).sort((a,b)=>(b.lastUsedAt??b.updatedAt).localeCompare(a.lastUsedAt??a.updatedAt));}
// Keep deletion markers so another device cannot restore an older saved verse.
export function mergeBookmarks(a:AppState['bookmarks'],b:AppState['bookmarks']):AppState['bookmarks']{
  if(!a)return b;if(!b)return a;const merged={...a};
  for(const [id,item] of Object.entries(b))if(!merged[id]||item.updatedAt>merged[id].updatedAt)merged[id]=item;
  return merged;
}
