import {AppState} from './program';
export const initialAccountAccess=(state:AppState):'show'|'done'=>state.userId?'done':'show';
