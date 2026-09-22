import raw from '../data/toumoun.json';
import { quarters, Range, verseId } from './quran';

export type ToumounRecord = {
  number: number;
  hizb: number;
  rub: number;
  startSurah: number | null;
  startAyah: number | null;
  endSurah: number | null;
  endAyah: number | null;
  source: string | null;
  verificationStatus: string;
};

export const toumounRecords = raw as ToumounRecord[];

/** A pace is offered only when all 480 verse-aligned Hafs boundaries are sourced. */
export function verifiedToumounRanges(records: ToumounRecord[] = toumounRecords): Range[] | null {
  if (records.length !== 480) return null;
  const ranges: Range[] = [];
  for (let index = 0; index < records.length; index++) {
    const item = records[index];
    if (item.number !== index + 1 || item.hizb !== Math.floor(index / 8) + 1 ||
      item.rub !== Math.floor(index / 2) + 1 || item.verificationStatus !== 'verified_hafs' ||
      !item.source || item.startSurah === null || item.startAyah === null ||
      item.endSurah === null || item.endAyah === null) return null;
    const start = verseId(item.startSurah, item.startAyah);
    const end = verseId(item.endSurah, item.endAyah);
    const quarter = quarters[Math.floor(index / 2)];
    if (start === null || end === null || start > end || start < quarter.start || end > quarter.end) return null;
    if (index % 2 === 0 && start !== quarter.start) return null;
    if (index % 2 === 1 && (end !== quarter.end || start !== ranges[index - 1].end + 1)) return null;
    ranges.push({ start, end });
  }
  return ranges;
}

export const verifiedToumouns = verifiedToumounRanges();
