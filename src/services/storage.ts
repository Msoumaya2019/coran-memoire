import * as SQLite from 'expo-sqlite';
import { AppState, defaultState } from '../core/program';

const db = SQLite.openDatabaseSync('coran-memoire.db');
db.execSync('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, updated_at TEXT NOT NULL)');
db.execSync('CREATE TABLE IF NOT EXISTS account_state (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');

export function loadState(): AppState {
  const row = db.getFirstSync<{data:string}>('SELECT data FROM app_state WHERE id=1');
  if(!row)return defaultState();
  try {
    const value=JSON.parse(row.data) as AppState;
    return value.schema===1&&Array.isArray(value.sessions)&&Array.isArray(value.revisions)?value:defaultState();
  } catch {return defaultState();}
}
export function saveState(state:AppState):void {
  db.runSync('INSERT INTO app_state (id,data,updated_at) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',JSON.stringify(state),state.updatedAt);
  if(state.userId)db.runSync('INSERT INTO account_state (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',state.userId,JSON.stringify(state),state.updatedAt);
}
export function loadAccountState(userId:string):AppState|null{
  const row=db.getFirstSync<{data:string}>('SELECT data FROM account_state WHERE user_id=?',userId);
  if(!row)return null;
  try{const value=JSON.parse(row.data) as AppState;return value.schema===1&&value.userId===userId?value:null;}catch{return null;}
}
