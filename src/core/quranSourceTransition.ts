/** Serializes source changes and commits only after resources are ready. */
export class QuranSourceTransition {
 private busy=false;
 private disposed=false;
 async change<T extends string>(source:T,page:number,prepare:(source:T,page:number)=>Promise<void>,commit:(source:T,page:number)=>void){
  if(this.busy||this.disposed)return false;
  if(!Number.isInteger(page)||page<1||page>604)throw new Error('Page du Coran invalide.');
  this.busy=true;
  try{await prepare(source,page);if(this.disposed)return false;commit(source,page);return true;}finally{this.busy=false;}
 }
 dispose(){this.disposed=true;}
}
