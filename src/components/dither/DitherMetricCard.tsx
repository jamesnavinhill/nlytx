import React, { useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { DitherRenderer } from '../../lib/dither-engine';

interface DitherMetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  change?: number; // percentage
  sparklineData?: number[];
  icon?: React.ReactNode;
}

export const DitherMetricCard: React.FC<DitherMetricCardProps> = ({
  label,
  value,
  subValue,
  change,
  sparklineData,
  icon,
}) => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!sparklineData || sparklineData.length === 0 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 80;
    const height = 28;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData, 1);
    const norm = sparklineData.map((d) => (d - min) / (max - min || 1));

    DitherRenderer.renderTimeSeries(ctx, {
      width,
      height,
      dataPoints: norm,
      colorHex: theme.graphPrimaryColor,
      algorithm: 'bayer',
      density: 0.8,
      gridStep: 3,
      isDark: theme.mode === 'dark',
    });
  }, [sparklineData, theme]);

  return (
    <div className="border border-border bg-card p-3 flex flex-col justify-between select-none relative overflow-hidden">
      <div className="flex items-center justify-between text-muted-foreground text-[11px] font-mono mb-1">
        <span className="uppercase tracking-wider">{label}</span>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <div className="text-xl font-bold font-mono text-foreground tracking-tight">{value}</div>
        {sparklineData && (
          <div className="w-[80px] h-[28px]">
            <canvas ref={canvasRef} className="w-full h-full block" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono mt-2 pt-1.5 border-t border-border/60 text-muted-foreground">
        <span>{subValue || 'CURRENT'}</span>
        {change !== undefined && (
          <span
            className={
              change >= 0 ? 'text-primary font-semibold' : 'text-destructive font-semibold'
            }
          >
            {change >= 0 ? `+${change}%` : `${change}%`}
          </span>
        )}
      </div>
    </div>
  );
};
