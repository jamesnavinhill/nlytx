import React from 'react';
import { GeoDistributionItem } from '../../types/analytics';
import { useTheme } from '../../context/ThemeContext';
import { formatCompactNumber } from '../../lib/utils';

export const DitherGeoMatrix: React.FC<{ items: GeoDistributionItem[] }> = ({ items }) => {
  const { theme } = useTheme();
  const maxVisitors = Math.max(...items.map((i) => i.visitors), 1);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 font-mono">
      {items.map((item) => {
        const intensity = Math.min(1, item.visitors / maxVisitors);
        const dotsCount = 16;
        const filledDots = Math.round(intensity * dotsCount);

        return (
          <div
            key={item.countryCode}
            className="border border-border/80 bg-secondary/30 p-2 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-foreground">{item.countryCode}</span>
              <span className="text-muted-foreground text-[10px]">{item.percentage}%</span>
            </div>

            {/* Dither Point Matrix */}
            <div className="grid grid-cols-4 gap-1 my-2 py-1">
              {Array.from({ length: dotsCount }).map((_, dIdx) => (
                <div
                  key={dIdx}
                  className="w-1.5 h-1.5 rounded-[1px]"
                  style={{
                    backgroundColor:
                      dIdx < filledDots
                        ? theme.graphPrimaryColor
                        : theme.mode === 'dark'
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.06)',
                  }}
                />
              ))}
            </div>

            <div className="text-[10px] text-muted-foreground truncate">
              {item.countryName}: <strong className="text-foreground">{formatCompactNumber(item.visitors)}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
};
