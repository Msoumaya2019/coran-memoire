"""Import Coran 1441 coordinate tables only; pages download on demand.
Place the official images_1440.zip at work-dist/quran-zips/coran_1441.zip.
"""
from pathlib import Path
import zipfile,sqlite3,json,hashlib
root=Path(__file__).resolve().parents[1]
archive=root/'work-dist/quran-zips/coran_1441.zip'
with zipfile.ZipFile(archive) as z:
 out=root/'src/data/quran-tests';out.mkdir(parents=True,exist_ok=True)
 dbfile=root/'work-dist/quran-zips/1441-coordinates.db';dbfile.write_bytes(z.read('databases/ayahinfo_1440.db'))
 with sqlite3.connect(dbfile) as db:
  bounds={};markers={}
  for _,page,surah,ayah,line,left,right in db.execute('select * from ayah_highlights'):
   y=(2320-232)/14*line;bounds.setdefault(str(page),[]).append([surah,ayah,line,left*1440,right*1440,y,y+232])
  for _,page,surah,ayah,line,code,x,y in db.execute('select * from ayah_markers'):
   markers.setdefault(str(page),[]).append([surah,ayah,line,x,y])
  for suffix,data in [('bounds',bounds),('dimensions',{str(p):[1440,2320] for p in range(1,605)}),('markers',markers),('headers',db.execute('select * from sura_headers').fetchall())]:
   (out/f'coran_1441-{suffix}.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
 print('604 pages, 9060 lines, SHA256',hashlib.sha256(archive.read_bytes()).hexdigest())
