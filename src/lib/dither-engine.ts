import { DitherAlgorithm } from '../types/analytics';
import { hexToRgb } from './utils';

// Standard 4x4 Bayer Matrix
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Standard 8x8 Bayer Matrix for ultra-fine gradient dithering
const BAYER_8X8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

export interface DitherRenderOptions {
  width: number;
  height: number;
  dataPoints: number[]; // normalized 0..1 values
  secondaryDataPoints?: number[];
  colorHex: string;
  secondaryColorHex?: string;
  backgroundColorHex?: string;
  algorithm: DitherAlgorithm;
  density?: number;
  dotSize?: number;
  gridStep?: number;
  isDark?: boolean;
}

export class DitherRenderer {
  public static renderTimeSeries(
    ctx: CanvasRenderingContext2D,
    options: DitherRenderOptions
  ) {
    const {
      width,
      height,
      dataPoints,
      secondaryDataPoints,
      colorHex,
      secondaryColorHex = '#71717a',
      algorithm = 'bayer',
      density = 1.0,
      gridStep = 4,
      isDark = true,
    } = options;

    if (dataPoints.length === 0 || width <= 0 || height <= 0) return;

    ctx.clearRect(0, 0, width, height);

    const primaryRgb = hexToRgb(colorHex);
    const secondaryRgb = hexToRgb(secondaryColorHex);
    const padTop = 16;
    const padBottom = 24;
    const plotHeight = height - padTop - padBottom;
    const plotWidth = width;

    // Precalculate pixel curve heights across width
    const curveHeights: number[] = new Array(Math.ceil(plotWidth)).fill(0);
    const secCurveHeights: number[] = secondaryDataPoints ? new Array(Math.ceil(plotWidth)).fill(0) : [];

    const pointCount = dataPoints.length;

    for (let x = 0; x < plotWidth; x++) {
      const t = (x / (plotWidth - 1)) * (pointCount - 1);
      const i0 = Math.floor(t);
      const i1 = Math.min(i0 + 1, pointCount - 1);
      const frac = t - i0;

      // Smooth hermite/cosine interpolation
      const smoothFrac = (1 - Math.cos(frac * Math.PI)) / 2;
      const v = (dataPoints[i0] * (1 - smoothFrac) + dataPoints[i1] * smoothFrac);
      curveHeights[x] = padTop + (1 - v) * plotHeight;

      if (secondaryDataPoints && secondaryDataPoints.length === pointCount) {
        const sv = (secondaryDataPoints[i0] * (1 - smoothFrac) + secondaryDataPoints[i1] * smoothFrac);
        secCurveHeights[x] = padTop + (1 - sv) * plotHeight;
      }
    }

    // Step-based dither matrix rendering
    const step = Math.max(2, Math.round(gridStep / density));
    const dotRadius = Math.max(1, (step / 2) * 0.9);

    for (let x = 0; x < plotWidth; x += step) {
      const topY = curveHeights[x] ?? (height - padBottom);

      for (let y = Math.floor(topY); y < height - padBottom; y += step) {
        // Compute depth from curve top down to floor
        const depth = (y - topY) / (height - padBottom - topY + 0.001);
        // Exponential falloff for graceful gradient
        const intensity = Math.min(1, Math.pow(depth, 0.65) * 1.1);

        let shouldDraw = false;
        let alpha = 1;

        if (algorithm === 'bayer') {
          const matrixX = Math.floor(x / step) % 4;
          const matrixY = Math.floor(y / step) % 4;
          const threshold = BAYER_4X4[matrixY][matrixX] / 16;
          shouldDraw = intensity >= threshold * 0.95;
          alpha = 0.4 + 0.6 * intensity;
        } else if (algorithm === 'dot-matrix') {
          const matrixX = Math.floor(x / step) % 8;
          const matrixY = Math.floor(y / step) % 8;
          const threshold = BAYER_8X8[matrixY][matrixX] / 64;
          shouldDraw = intensity >= threshold;
          alpha = 0.3 + 0.7 * intensity;
        } else if (algorithm === 'grain') {
          const pseudoRandom = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
          shouldDraw = intensity > pseudoRandom * 0.85;
          alpha = 0.5 + 0.5 * intensity;
        } else if (algorithm === 'atkinson' || algorithm === 'floyd-steinberg') {
          // Error diffusion pattern simulation on grid
          const mod = (Math.floor(x / step) * 3 + Math.floor(y / step) * 5) % 7;
          shouldDraw = intensity > (mod / 7);
          alpha = 0.35 + 0.65 * intensity;
        }

        if (shouldDraw) {
          ctx.fillStyle = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, ${alpha * (isDark ? 0.75 : 0.85)})`;
          ctx.fillRect(x, y, dotRadius, dotRadius);
        }
      }
    }

    // Secondary series (if present) rendered as subtle dithered outline or contrast points
    if (secondaryDataPoints && secCurveHeights.length > 0) {
      ctx.strokeStyle = `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.5)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      for (let x = 0; x < plotWidth; x += 2) {
        const y = secCurveHeights[x];
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Primary Ridge Line with sharp vector crispness
    ctx.strokeStyle = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.95)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < plotWidth; x++) {
      const y = curveHeights[x];
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Subtle Baseline Line
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - padBottom);
    ctx.lineTo(plotWidth, height - padBottom);
    ctx.stroke();
  }

  public static renderBarDither(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    valueNormalized: number,
    colorHex: string,
    algorithm: DitherAlgorithm = 'bayer',
    isDark = true
  ) {
    ctx.clearRect(0, 0, width, height);
    const rgb = hexToRgb(colorHex);
    const barWidth = Math.max(1, width * Math.min(1, Math.max(0, valueNormalized)));
    const step = 3;

    for (let x = 0; x < barWidth; x += step) {
      const xRatio = x / width;
      const intensity = 0.4 + 0.6 * (1 - xRatio * 0.3);

      for (let y = 0; y < height; y += step) {
        const mx = Math.floor(x / step) % 4;
        const my = Math.floor(y / step) % 4;
        const threshold = BAYER_4X4[my][mx] / 16;

        if (intensity >= threshold * 0.75) {
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? 0.85 : 0.9})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  }
}
