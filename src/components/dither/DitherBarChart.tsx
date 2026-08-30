import React, { useRef, useEffect } from 'react';
import { DitherRenderer } from '../../lib/dither-engine';
import { useTheme } from '../../context/ThemeContext';
import { formatCompactNumber } from '../../lib/utils';

interface BarItem {
  label: string;
  value: number;
  subLabel?: string;
}

interface DitherBarChartProps {
  items: BarItem[];
  maxValue?: number;
  heightPerBar?: number;
}

export const DitherBarChart: React.FC<DitherBarChartProps> = ({
  items,
  maxValue,
  heightPerBar = 24,
}) => {
  const { theme } = useTheme();
  const max = maxValue || Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col space-y-2 w-full font-mono">
      {items.map((item, idx) => {
        const ratio = Math.min(1, item.value / max);
        return (
          <div key={idx} className="flex flex-col space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground truncate max-w-[65%]">{item.label}</span>
              <div className="flex items-center space-x-2 text-muted-foreground">
                {item.subLabel && <span className="text-[10px]">{item.subLabel}</span>}
                <span className="text-foreground font-semibold">{formatCompactNumber(item.value)}</span>
              </div>
            </div>
            <DitherBarCanvas
              ratio={ratio}
              colorHex={theme.graphPrimaryColor}
              algorithm={theme.ditherAlgorithm}
              height={10}
              isDark={theme.mode === 'dark'}
            />
          </div>
        );
      })}
    </div>
  );
};

const DitherBarCanvas: React.FC<{
  ratio: number;
  colorHex: string;
  algorithm: any;
  height: number;
  isDark: boolean;
}> = ({ ratio, colorHex, algorithm, height, isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 200;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    DitherRenderer.renderBarDither(ctx, width, height, ratio, colorHex, algorithm, isDark);
  }, [ratio, colorHex, algorithm, height, isDark]);

  return (
    <div ref={containerRef} className="w-full bg-secondary border border-border/50 h-[10px] relative">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
