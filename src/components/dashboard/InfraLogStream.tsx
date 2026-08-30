import React, { useState } from 'react';
import { InfrastructureLogEntry } from '../../types/infrastructure';
import { Terminal, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface InfraLogStreamProps {
  logs?: InfrastructureLogEntry[];
}

export const InfraLogStream: React.FC<InfraLogStreamProps> = ({ logs = [] }) => {
  const [levelFilter, setLevelFilter] = useState<'all' | 'INFO' | 'WARN' | 'ERROR'>('all');
  const [sourceFilter] = useState<string>('all');

  const safeLogs = logs || [];

  const filteredLogs = safeLogs.filter((log) => {
    const logLvl = (log.level || 'INFO').toUpperCase();
    if (levelFilter !== 'all' && logLvl !== levelFilter) return false;
    if (sourceFilter !== 'all' && log.source !== sourceFilter) return false;
    return true;
  });

  const getLevelBadge = (level: string) => {
    const lvl = (level || 'INFO').toUpperCase();
    switch (lvl) {
      case 'ERROR':
      case 'CRITICAL':
        return (
          <span className="px-1 py-0.2 bg-rose-500/20 text-rose-500 font-bold border border-rose-500/40 rounded-[1px] flex items-center gap-0.5 shrink-0">
            <AlertCircle className="w-2.5 h-2.5" /> ERR
          </span>
        );
      case 'WARN':
        return (
          <span className="px-1 py-0.2 bg-amber-500/20 text-amber-500 font-bold border border-amber-500/40 rounded-[1px] flex items-center gap-0.5 shrink-0">
            <AlertTriangle className="w-2.5 h-2.5" /> WRN
          </span>
        );
      default:
        return (
          <span className="px-1 py-0.2 bg-secondary text-muted-foreground border border-border rounded-[1px] flex items-center gap-0.5 shrink-0">
            <Info className="w-2.5 h-2.5" /> INF
          </span>
        );
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'aws-ec2':
        return 'text-[#FF9900]';
      case 'cloudflare-tunnel':
        return 'text-[#F38020]';
      case 'cloudflare-worker':
        return 'text-[#F38020]';
      case 'oracle-oci':
        return 'text-[#C74634]';
      default:
        return 'text-primary';
    }
  };

  return (
    <div className="border border-border bg-card p-3 space-y-2 font-mono w-full min-w-0 overflow-hidden">
      {/* Header with level filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 min-w-0">
        <div className="flex items-center space-x-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-bold text-foreground truncate">LIVE INFRASTRUCTURE EVENT STREAM</span>
          <span className="text-[10px] text-muted-foreground font-normal shrink-0">
            ({filteredLogs.length} EVENTS)
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] shrink-0">
          {/* Level Filter */}
          <div className="flex items-center border border-border bg-secondary/40 p-0.5 rounded-[2px]">
            {(['all', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-1.5 py-0.5 rounded-[1px] uppercase transition-colors cursor-pointer ${
                  levelFilter === lvl
                    ? 'bg-foreground text-background font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log list terminal window */}
      <div className="bg-background border border-border/80 rounded-[2px] p-2 space-y-1 max-h-64 overflow-y-auto overflow-x-hidden font-mono text-[11px] select-text w-full min-w-0">
        {filteredLogs.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">No events found matching current filter</div>
        ) : (
          filteredLogs.map((log) => {
            const instanceLabel = (log as any).instanceOrService || (log.metadata && log.metadata.resource) || log.source;
            return (
              <div
                key={log.id}
                className="flex items-baseline space-x-2 py-0.5 hover:bg-secondary/40 px-1 rounded-[1px] leading-relaxed min-w-0 overflow-hidden"
              >
                <span className="text-muted-foreground text-[10px] shrink-0">{log.timestamp}</span>
                <div className="shrink-0 text-[9px]">{getLevelBadge(log.level)}</div>
                <span className={`text-[10px] font-bold shrink-0 ${getSourceColor(log.source)}`}>
                  [{log.source}]
                </span>
                {instanceLabel && (
                  <span className="text-muted-foreground text-[10px] shrink-0 truncate max-w-[120px]">{instanceLabel}:</span>
                )}
                <span className="text-foreground text-[11px] break-all min-w-0 flex-1">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
