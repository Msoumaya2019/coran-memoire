"""Import original Quran.app page archives. Usage: python scripts/import-quran-zips.py.
Requires Pillow only for reading original PNG dimensions; never rasterizes/resamples.
Archives must be in work-dist/quran-zips/{tawjeed_test_2,medine_test}.zip.
"""
from pathlib import Path
import zipfile,sqlite3,json,io,re,hashlib
from PIL import Image
root=Path(__file__).resolve().parents[1]
out=root/'src/data/quran-tests';out.mkdir(parents=True,exist_ok=True)
for key in ('tawjeed_test_2','medine_test'):
 archive=root/'work-dist/quran-zips'/f'{key}.zip'
 with zipfile.ZipFile(archive) as z:
  database=next(n for n in z.namelist() if re.search(r'/ayahinfo_\d+\.db$',n))
  temp=root/'work-dist/quran-zips'/key/'coordinates.db';temp.parent.mkdir(parents=True,exist_ok=True);temp.write_bytes(z.read(database))
  with sqlite3.connect(temp) as db:
   grouped={};segments={}
   for glyph,page,line,surah,ayah,pos,x0,x1,y0,y1 in db.execute('select * from glyphs order by page_number,line_number,glyph_id'):
    k=(page,surah,ayah,line)
    if k not in grouped:grouped[k]=[surah,ayah,line,x0,x1,y0,y1]
    else:
     r=grouped[k];r[3]=min(r[3],x0);r[4]=max(r[4],x1);r[5]=min(r[5],y0);r[6]=max(r[6],y1)
    segments.setdefault(str(page),[]).append([glyph,surah,ayah,line,pos,x0,x1,y0,y1])
  bounds={};dimensions={};imports=[];assets=root/'assets/quran-tests'/key;assets.mkdir(parents=True,exist_ok=True)
  for (page,*_),r in grouped.items():bounds.setdefault(str(page),[]).append(r)
  for n in z.namelist():
   name=Path(n).name
   if not re.fullmatch(r'page\d{3}\.png',name):continue
   page=int(name[4:7]);data=z.read(n);dimensions[str(page)]=list(Image.open(io.BytesIO(data)).size);(assets/name).write_bytes(data)
   imports.append((page,f"{page}:require('../../../assets/quran-tests/{key}/{name}')"))
  assert len(imports)==604 and len(bounds)==604
  for suffix,value in [('bounds',bounds),('dimensions',dimensions),('words',segments)]:
   (out/f'{key}-{suffix}.json').write_text(json.dumps(value,separators=(',',':')),encoding='utf-8')
  (out/f'{key}-images.ts').write_text('export const images:Record<number,number>={'+','.join(v for _,v in sorted(imports))+'};\n',encoding='utf-8')
  print(key,len(imports),'pages',hashlib.sha256(archive.read_bytes()).hexdigest())
