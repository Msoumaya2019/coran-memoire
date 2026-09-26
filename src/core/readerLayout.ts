const pageWidth=1920;
const pageHeight=3106;
const frame=4;

/** Fit the printed page inside the measured reader viewport without stretching it. */
export function fitMushafPage(availableWidth:number,availableHeight:number){
  if(availableWidth<=frame||availableHeight<=frame)return {width:0,height:0};
  const scale=Math.min((availableWidth-frame)/pageWidth,(availableHeight-frame)/pageHeight);
  return {width:pageWidth*scale+frame,height:pageHeight*scale+frame};
}
