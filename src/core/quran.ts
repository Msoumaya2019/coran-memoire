import versesRaw from '../data/verses.json';
import metaRaw from '../data/meta.json';
import pagesRaw from '../data/pages.json';

export type Range = { start: number; end: number };
export type Verse = { surah: number; ayah: number; text: string };
export type Division = Range & { number: number };
export type Surah = { number: number; name: string; meaning: string; arabic: string; start: number; end: number; count: number };
export const verses = versesRaw as Verse[];
export const surahs = metaRaw.surahs as Surah[];
export const juzs = metaRaw.juzs as Division[];
export const quarters = metaRaw.quarters as Division[];
export const pages = pagesRaw as { page: number; first: number[]; last: number[] }[];
export const hizbs: Division[] = Array.from({ length: 60 }, (_, i) => ({ number: i + 1, start: quarters[i * 4].start, end: quarters[i * 4 + 3].end }));
export const halves: Division[] = Array.from({ length: 120 }, (_, i) => ({ number: i + 1, start: quarters[i * 2].start, end: quarters[i * 2 + 1].end }));

export function verseId(surah: number, ayah: number): number | null {
  const s = surahs[surah - 1];
  return s && ayah >= 1 && ayah <= s.count ? s.start + ayah - 1 : null;
}
export function verseAt(id: number): Verse { return verses[id - 1]; }
export function surahAt(id: number): Surah { return surahs[verseAt(id).surah - 1]; }
export function pageOf(id: number): number {
  const v = verseAt(id);
  let left = 0, right = pages.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    const p = pages[mid];
    const first = verseId(p.first[0], p.first[1])!;
    const last = verseId(p.last[0], p.last[1])!;
    if (id < first) right = mid - 1;
    else if (id > last) left = mid + 1;
    else return p.page;
  }
  throw new Error(`Page introuvable pour ${v.surah}:${v.ayah}`);
}
export function pageRange(page: number): Range {
  const p = pages[page - 1];
  if (!p) throw new Error('Page invalide');
  return { start: verseId(p.first[0], p.first[1])!, end: verseId(p.last[0], p.last[1])! };
}
export function intersect(a: Range, b: Range): Range | null {
  const start = Math.max(a.start, b.start), end = Math.min(a.end, b.end);
  return start <= end ? { start, end } : null;
}
export function normalizeRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter(r => r.start >= 1 && r.end <= verses.length && r.start <= r.end).sort((a,b) => a.start-b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}
export function expand(ranges: Range[]): number[] {
  const ids: number[] = [];
  for (const r of normalizeRanges(ranges)) for(let id=r.start; id<=r.end; id++) ids.push(id);
  return ids;
}
export const weights = verses.map(v => (v.text.match(/[\u0621-\u064A]/g) || []).length || 1);
export function volume(ids: number[]): number { return ids.reduce((sum,id)=>sum+weights[id-1],0); }
export const totalVolume = weights.reduce((a,b)=>a+b,0);
export function reference(range: Range): string {
  const a=verseAt(range.start), b=verseAt(range.end);
  return a.surah===b.surah ? `${surahAt(range.start).name} ${a.ayah}–${b.ayah}` : `${surahAt(range.start).name} ${a.ayah} → ${surahAt(range.end).name} ${b.ayah}`;
}
