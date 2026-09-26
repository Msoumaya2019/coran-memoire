"""Import unchanged Quran app pages and their own ayah coordinates.

Usage: python scripts/prepare-mushaf-tajweed.py path/to/images_1280.zip
Source: https://files.quran.app/hafs/tajweed/zips/images_1280.zip
Requires Pillow for reading PNG dimensions, never for modifying the images.
"""
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
import sys, sqlite3, tempfile, json, hashlib, io

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
archive_hash = hashlib.sha256(source.read_bytes()).hexdigest()
if archive_hash != '3b4e87837ea961102c77a670a913e68e24a2b7bd9fd1ef0aa320ee17c569c40a':
    raise ValueError('Source archive changed: review the new edition before importing it.')
z = ZipFile(source)
out = root / 'assets/mushaf-tajweed'
out.mkdir(exist_ok=True)
meta = json.loads((root / 'src/data/meta.json').read_text(encoding='utf-8'))['surahs']
ranges = json.loads((root / 'src/data/pages.json').read_text(encoding='utf-8'))
bounds, dimensions, hashes, assets = {}, {}, {}, {}
with tempfile.TemporaryDirectory() as temp:
    db_path = Path(temp) / 'ayahinfo_1280.db'
    db_path.write_bytes(z.read('databases/ayahinfo_1280.db'))
    db = sqlite3.connect(db_path)
    for page in range(1, 605):
        name = f'page{page:03}.png'
        data = z.read('width_1280/' + name)
        image = Image.open(io.BytesIO(data))
        dimensions[str(page)] = list(image.size)
        hashes[name] = hashlib.sha256(data).hexdigest()
        rows = db.execute('select sura_number,ayah_number,line_number,min(min_x),max(max_x),min(min_y),max(max_y) from glyphs where page_number=? and sura_number>0 and ayah_number>0 group by sura_number,ayah_number,line_number order by line_number,sura_number,ayah_number', (page,)).fetchall()
        ids = {meta[r[0]-1]['start'] + r[1]-1 for r in rows}
        first, last = ranges[page-1]['first'], ranges[page-1]['last']
        expected = set(range(meta[first[0]-1]['start'] + first[1]-1, meta[last[0]-1]['start'] + last[1]))
        assert ids == expected, (page, ids ^ expected)
        assert all(0 <= r[3] < r[4] <= image.width and 0 <= r[5] < r[6] <= image.height for r in rows), page
        bounds[str(page)] = rows
        assets[name] = data
    db.close()
for name, data in assets.items():
    (out / name).write_bytes(data)
(root / 'src/data/mushafTajweedImages.ts').write_text('export const mushafTajweedImages:Record<number,number>={\n' + ''.join(f" {p}:require('../../assets/mushaf-tajweed/page{p:03}.png'),\n" for p in range(1,605)) + '};\n', encoding='utf-8')
for name, data in [('bounds', bounds), ('dimensions', dimensions), ('hashes', hashes)]:
    (root / f'src/data/mushaf-tajweed-{name}.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
print('604 pages unchanged; all Hafs page boundaries checked.')
print('Archive SHA256:', archive_hash)
print('Dimensions:', set(tuple(v) for v in dimensions.values()))
