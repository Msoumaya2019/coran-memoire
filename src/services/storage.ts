import * as SQLite from 'expo-sqlite';
import { AppState, defaultState, migrateReaderState } from '../core/program';

const db = SQLite.openDatabaseSync('coran-memoire.db');
db.execSync('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, updated_at TEXT NOT NULL)');
db.execSync('CREATE TABLE IF NOT EXISTS pending_sync (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)');

if(!db.getAllSync<{name:string}>('PRAGMA table_info(pending_sync)').some(column=>column.name==='base'))db.execSync('ALTER TABLE pending_sync ADD COLUMN base TEXT');

db.execSync('CREATE TABLE IF NOT EXISTS account_state (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)');

export function loadState(): AppState {
  const row = db.getFirstSync<{data:string}>('SELECT data FROM app_state WHERE id=1');
  if(!row)return defaultState();
  try {
    const value=JSON.parse(row.data) as AppState;
    return value.schema===1&&Array.isArray(value.sessions)&&Array.isArray(value.revisions)?migrateReaderState(value):defaultState();
  } catch {return defaultState();}
}
export function saveState(state:AppState):void {
  state=migrateReaderState(state);
  db.runSync('INSERT INTO app_state (id,data,updated_at) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at',JSON.stringify(state),state.updatedAt);
  if(state.userId)db.runSync('INSERT INTO account_state (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at',state.userId,JSON.stringify(state),state.updatedAt);
}
export function loadAccountState(userId:string):AppState|null{
  const row=db.getFirstSync<{data:string}>('SELECT data FROM account_state WHERE user_id=?',userId);
  if(!row)return null;
  try{const value=JSON.parse(row.data) as AppState;return value.schema===1&&value.userId===userId?migrateReaderState(value):null;}catch{return null;}
}

export type SyncOperation={type:'state_snapshot';syncStatus:'pending';id:string;userId:string;payload:AppState;base?:AppState;createdAt:string};
/** Snapshot operations are idempotent upserts; each version stays until acknowledged. */
export function enqueueState(state:AppState,base?:AppState):void{
 if(!state.userId)return;
 const id=`${state.userId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
 db.runSync('INSERT OR IGNORE INTO pending_sync (id,user_id,payload,created_at,base) VALUES (?,?,?,?,?)',id,state.userId,JSON.stringify(state),new Date().toISOString(),base?JSON.stringify(base):null);
}
export function pendingOperations(userId:string):SyncOperation[]{
 const rows=db.getAllSync<{id:string;user_id:string;payload:string;base:string|null;created_at:string}>('SELECT * FROM pending_sync WHERE user_id=? ORDER BY created_at,rowid',userId);
 const base=rows[0]?.base?JSON.parse(rows[0].base):undefined;
 return rows.map(r=>({type:'state_snapshot',syncStatus:'pending',id:r.id,userId:r.user_id,payload:JSON.parse(r.payload),base,createdAt:r.created_at}));
}
export function acknowledgeOperation(id:string):void{db.runSync('DELETE FROM pending_sync WHERE id=?',id);}

export function saveMutation(state:AppState):void{db.withTransactionSync(()=>{const base=loadState();saveState(state);enqueueState(state,base);});}
