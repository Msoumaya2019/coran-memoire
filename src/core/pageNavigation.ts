export function pageAfterSwipe(page:number,dx:number,dy:number,totalPages=604):number {
  if(Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.5)return page;
  return Math.max(1,Math.min(totalPages,page+(dx<0?-1:1)));
}
