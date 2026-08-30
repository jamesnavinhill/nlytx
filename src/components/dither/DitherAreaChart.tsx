import React, { useRef, useEffect, useState, useMemo } from 'react';
import { DitherRenderer } from '../../lib/dither-engine';
import { useTheme } from '../../context/ThemeContext';
import { formatCompactNumber } from '../../lib/utils';

interface DitherAreaChartProps {
  series?: any[];
  data?: any[];
  metricKey?: string;
  secondaryMetricKey?: string;
  valueLabel?: string;
  unit?: string;
  height?: number;
}

export const DitherAreaChart: React.FC<DitherAreaChartProps> = ({
  series,
  data,
  metricKey = 'visitors',
  secondaryMetricKey,
  valueLabel,
  unit = '',
  height = 240,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  // Safely resolve raw items array
  const points = useMemo(() => {
    return (series || data || []) as any[];
  }, [series, data]);

  // Resize observer for container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const values = useMemo(() => {
    if (points.length === 0) return [0];
    return points.map((p) => {
      if (typeof p === 'number') return p;
      if (metricKey && p[metricKey] !== undefined) return Number(p[metricKey]) || 0;
      if (p.value !== undefined) return Number(p.value) || 0;
      return 0;
    });
  }, [points, metricKey]);

  const secValues = useMemo(() => {
    if (!secondaryMetricKey || points.length === 0) return undefined;
    return points.map((p) => {
      if (p[secondaryMetricKey] !== undefined) return Number(p[secondaryMetricKey]) || 0;
      return 0;
    });
  }, [points, secondaryMetricKey]);

  const maxVal = useMemo(() => Math.max(...values, 1), [values]);
  const minVal = useMemo(() => Math.min(...values, 0), [values]);

  const normalizedValues = useMemo(() => {
    const range = maxVal - minVal || 1;
    return values.map((v) => (v - minVal) / range);
  }, [values, minVal, maxVal]);

  const normalizedSecValues = useMemo(() => {
    if (!secValues) return undefined;
    const secMax = Math.max(...secValues, 1);
    return secValues.map((v) => v / secMax);
  }, [secValues]);

  // Render on canvas whenever dimensions, data, or theme changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerWidth <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    DitherRenderer.renderTimeSeries(ctx, {
      width: containerWidth,
      height,
      dataPoints: normalizedValues,
      secondaryDataPoints: normalizedSecValues,
      colorHex: theme.graphPrimaryColor,
      secondaryColorHex: theme.graphSecondaryColor,
      algorithm: theme.ditherAlgorithm,
      density: theme.ditherDensity,
      isDark: theme.mode === 'dark',
    });
  }, [containerWidth, height, normalizedValues, normalizedSecValues, theme]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    const index = Math.min(Math.floor(ratio * points.length), points.length - 1);
    setHoverX(x);
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoverX(null);
  };

  const activePoint = hoverIndex !== null && points.length > 0 ? points[hoverIndex] : null;
  const displayLabel = valueLabel || metricKey || 'VALUE';

  const formatPointVal = (val: any) => {
    if (typeof val === 'number') {
      return `${formatCompactNumber(val)}${unit}`;
    }
    return `${val || 0}${unit}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full border border-border bg-card p-3 select-none overflow-hidden min-w-0"
      style={{ height: `${height + 32}px` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center justify-between pb-2 border-b border-border text-[11px] font-mono text-muted-foreground min-w-0">
        <span className="text-foreground font-semibold uppercase tracking-wider truncate">{displayLabel}</span>
        <span className="shrink-0 ml-2">
          PEAK: <strong className="text-foreground">{formatCompactNumber(maxVal)}{unit}</strong>
        </span>
      </div>

      <div className="relative w-full h-full min-w-0 overflow-hidden" style={{ height: `${height}px` }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />

        {/* Interactive Crosshair & Tooltip */}
        {hoverX !== null && activePoint && (
          <>
            <div
              className="absolute top-0 bottom-6 w-[1px] bg-primary/70 pointer-events-none"
              style={{ left: `${hoverX}px` }}
            />
            <div
              className="absolute pointer-events-none bg-popover border border-border px-2 py-1 text-[11px] font-mono shadow-md z-20 rounded-[2px]"
              style={{
                left: `${Math.min(hoverX + 8, Math.max(0, containerWidth - 140))}px`,
                top: '12px',
              }}
            >
              <div className="text-muted-foreground">
                {activePoint.formattedTime || activePoint.timestamp || ''}
              </div>
              <div className="text-foreground font-bold">
                {displayLabel}: {formatPointVal(activePoint[metricKey] !== undefined ? activePoint[metricKey] : activePoint.value)}
              </div>
              {secondaryMetricKey && activePoint[secondaryMetricKey] !== undefined && (
                <div className="text-muted-foreground text-[10px]">
                  {secondaryMetricKey}: {formatPointVal(activePoint[secondaryMetricKey])}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
