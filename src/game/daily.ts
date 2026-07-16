import { genLevel } from './generator';
import type { Level } from './types';

const DAILY_SIZES = [5, 6, 6, 7, 5, 6, 7];

export function getDailyDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function getDailyLevel(d: Date = new Date()): Level {
  const seed = parseInt(getDailyDateKey(d), 10);
  const doy = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const size = DAILY_SIZES[doy % DAILY_SIZES.length];
  return genLevel(seed, size, 9);
}

export function getNextDailyInMs(now: Date = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}
