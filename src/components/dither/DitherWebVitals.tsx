import React from 'react';
import { WebVitalsMetrics } from '../../types/analytics';
import { useTheme } from '../../context/ThemeContext';

export const DitherWebVitals: React.FC<{ vitals: WebVitalsMetrics }> = ({ vitals }) => {
  const { theme } = useTheme();

  const metrics = [
    { key: 'LCP', label: 'Largest Contentful Paint', val: `${vitals.lcp.value}${vitals.lcp.unit}`, rating: vitals.lcp.rating },
    { key: 'CLS', label: 'Cumulative Layout Shift', val: `${vitals.cls.value}`, rating: vitals.cls.rating },
    { key: 'INP', label: 'Interaction to Next Paint', val: `${vitals.inp.value}${vitals.inp.unit}`, rating: vitals.inp.rating },
    { key: 'FID', label: 'First Input Delay', val: `${vitals.fid.value}${vitals.fid.unit}`, rating: vitals.fid.rating },
    { key: 'TTFB', label: 'Time to First Byte', val: `${vitals.ttfb.value}${vitals.ttfb.unit}`, rating: vitals.ttfb.rating },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 font-mono">
      {metrics.map((m) => (
        <div key={m.key} className="border border-border/80 bg-secondary/30 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-foreground">{m.key}</span>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor:
                  m.rating === 'good'
                    ? theme.accentColor
                    : m.rating === 'needs-improvement'
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            />
          </div>
          <div className="text-base font-bold text-foreground my-1">{m.val}</div>
          <div className="text-[9px] text-muted-foreground truncate uppercase">{m.label}</div>
        </div>
      ))}
    </div>
  );
};
