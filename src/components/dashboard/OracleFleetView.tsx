import React, { useState } from 'react';
import { OracleInstance } from '../../types/infrastructure';
import { useInfrastructure } from '../../context/InfrastructureContext';
import {
  Database,
  RotateCcw,
  Power,
  HardDrive,
  Cpu,
  Search,
} from 'lucide-react';

interface OracleFleetViewProps {
  instances?: OracleInstance[];
}

export const OracleFleetView: React.FC<OracleFleetViewProps> = ({ instances = [] }) => {
  const { executeInstanceAction } = useInfrastructure();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const safeInstances = instances || [];

  const filteredInstances = safeInstances.filter(
    (i) =>
      (i.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.ocid || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.shape || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = async (ocid: string, action: string) => {
    setActionInProgress(ocid);
    try {
      await executeInstanceAction(ocid, action, 'oracle');
    } finally {
      setTimeout(() => setActionInProgress(null), 800);
    }
  };

  return (
    <div className="space-y-3 font-sans w-full min-w-0">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card p-2.5 min-w-0">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-6 h-6 bg-[#C74634]/20 border border-[#C74634]/40 flex items-center justify-center rounded-[2px] shrink-0">
            <Database className="w-3.5 h-3.5 text-[#C74634]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-mono font-bold text-foreground truncate">ORACLE CLOUD INFRASTRUCTURE (OCI) FLEET</div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              {safeInstances.filter((i) => i.lifecycleState === 'RUNNING').length} OF {safeInstances.length} INSTANCES RUNNING
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 min-w-0">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
            <input
              type="text"
              placeholder="FILTER OCI FLEET..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-secondary text-foreground text-[11px] font-mono pl-7 pr-2 py-1 rounded-[2px] border border-border focus:outline-none focus:border-primary w-40 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* Grid of OCI Instances */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 w-full min-w-0">
        {filteredInstances.map((inst) => {
          const isRunning = inst.lifecycleState === 'RUNNING';
          const ocpus = inst.ocpuCount || (inst as any).ocpus || 1;

          return (
            <div
              key={inst.ocid}
              className="border border-border bg-card p-3 space-y-2.5 rounded-[2px] hover:border-border/80 transition-all min-w-0 overflow-hidden"
            >
              <div className="flex items-start justify-between gap-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-bold text-foreground truncate">
                    {inst.displayName}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground truncate">
                    {inst.ocid}
                  </div>
                </div>

                <span
                  className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-[1px] shrink-0 ${
                    isRunning
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1 ${
                      isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  />
                  {inst.lifecycleState}
                </span>
              </div>

              {/* Specs: Shape & OCPUs / Memory */}
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono bg-secondary/50 p-1.5 rounded-[2px] border border-border/60 min-w-0">
                <div className="min-w-0">
                  <span className="text-muted-foreground block text-[9px]">OCI SHAPE</span>
                  <span className="text-foreground font-semibold truncate block">{inst.shape}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground block text-[9px]">OCPUS / MEMORY</span>
                  <span className="text-foreground font-semibold truncate block">
                    {ocpus} OCPU · {inst.memoryGb} GB
                  </span>
                </div>
              </div>

              {/* Telemetry Utilizations */}
              {isRunning && (
                <div className="space-y-1.5 pt-1 min-w-0">
                  <div className="space-y-1 min-w-0">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Cpu className="w-2.5 h-2.5" /> CPU UTILIZATION
                      </span>
                      <span className="text-foreground font-bold">{Math.round(inst.cpuUtilization)}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-[1px] overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          inst.cpuUtilization > 80
                            ? 'bg-rose-500'
                            : inst.cpuUtilization > 50
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, inst.cpuUtilization))}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <HardDrive className="w-2.5 h-2.5" /> MEMORY UTILIZATION
                      </span>
                      <span className="text-foreground font-bold">{Math.round(inst.memoryUtilization)}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-[1px] overflow-hidden">
                      <div
                        className="h-full bg-primary/80 transition-all"
                        style={{ width: `${Math.min(100, Math.max(2, inst.memoryUtilization))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* IP and Quick Action Bar */}
              <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10px] font-mono min-w-0">
                <div className="text-muted-foreground truncate flex-1 mr-2 min-w-0">
                  IP: <strong className="text-foreground font-mono">{inst.publicIp || inst.privateIp}</strong>
                </div>

                <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleAction(inst.ocid, 'reboot')}
                    disabled={actionInProgress === inst.ocid || !isRunning}
                    title="Soft Reset OCI Instance"
                    className="p-1 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-[2px] transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    <RotateCcw
                      className={`w-3 h-3 ${actionInProgress === inst.ocid ? 'animate-spin text-primary' : ''}`}
                    />
                  </button>
                  <button
                    onClick={() => handleAction(inst.ocid, isRunning ? 'stop' : 'start')}
                    disabled={actionInProgress === inst.ocid}
                    title={isRunning ? 'Stop Instance' : 'Start Instance'}
                    className="p-1 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-[2px] transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    <Power className={`w-3 h-3 ${isRunning ? 'hover:text-rose-500' : 'hover:text-emerald-500'}`} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
