const pageWidth=1920;
const pageHeight=3106;
const frame=4;

/** Fit the printed page inside the measured reader viewport without stretching it. */
export function fitMushafPage(availableWidth:number,availableHeight:number,sourceWidth=pageWidth,sourceHeight=pageHeight){
  if(availableWidth<=frame||availableHeight<=frame||sourceWidth<=0||sourceHeight<=0)return {width:0,height:0};
  const scale=Math.min((availableWidth-frame)/sourceWidth,(availableHeight-frame)/sourceHeight);
  return {width:sourceWidth*scale+frame,height:sourceHeight*scale+frame};
}
