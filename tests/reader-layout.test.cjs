const test=require('node:test');
const assert=require('node:assert/strict');
const {fitMushafPage}=require('./build/core/readerLayout.js');

test('la page du Moushaf reste dans la zone mesurée et garde son ratio',()=>{
  for(const [width,height] of [[320,550],[375,720],[430,850],[480,700],[800,1000]]){
    const page=fitMushafPage(width,height);
    assert(page.width<=width&&page.height<=height);
    assert(Math.abs((page.width-4)/(page.height-4)-1920/3106)<1e-10);
  }
});

test('revenir aux mêmes dimensions après plusieurs changements de page ne produit aucune dérive',()=>{
  const viewport=[385,695];
  const expected=fitMushafPage(...viewport);
  for(const page of [1,2,3,2,1,603,604,603]){
    assert.deepEqual(fitMushafPage(...viewport),expected,`page ${page}`);
  }
});
