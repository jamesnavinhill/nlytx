import { DitherAlgorithm } from './analytics';

export type ThemeMode = 'dark' | 'light';

export interface ThemeConfig {
  mode: ThemeMode;
  accentColor: string; // e.g. '#e27238' or '#d97706' or '#38bdf8'
  graphPrimaryColor: string; // primary line/dither color
  graphSecondaryColor: string; // secondary series color
  ditherDensity: number; // 0.5 to 2.0
  ditherAlgorithm: DitherAlgorithm;
  isCompact: boolean;
}

export const DEFAULT_THEME: ThemeConfig = {
  mode: 'dark',
  accentColor: '#e06c3a', // warm amber-terracotta
  graphPrimaryColor: '#e06c3a',
  graphSecondaryColor: '#71717a',
  ditherDensity: 1.0,
  ditherAlgorithm: 'bayer',
  isCompact: true,
};
