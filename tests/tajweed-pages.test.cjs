const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const manifest=require('../src/data/tajweedImageHashes.json');

test('les 604 pages Tajweed livrées correspondent aux images vérifiées',()=>{
  assert.equal(manifest.sha256.length,604);
  for(let page=1;page<=604;page++){
    const file=path.join(__dirname,'..','assets','tajweed',`page${String(page).padStart(3,'0')}.jpg`);
    const bytes=fs.readFileSync(file);
    assert(bytes.length>10000,`Page ${page} trop courte`);
    assert.equal(bytes[0],0xff);
    assert.equal(bytes[1],0xd8);
    assert.equal(bytes.at(-2),0xff);
    assert.equal(bytes.at(-1),0xd9);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256[page-1],`Page ${page} modifiée`);
  }
});
