import React, { useState } from 'react';
import { AwsInstance } from '../../types/infrastructure';
import { useInfrastructure } from '../../context/InfrastructureContext';
import {
  Server,
  CheckCircle2,
  RotateCcw,
  Power,
  HardDrive,
  Network,
  Cpu,
  Search,
} from 'lucide-react';
import { formatCompactNumber } from '../../lib/utils';

interface AwsFleetViewProps {
  instances?: AwsInstance[];
}

export const AwsFleetView: React.FC<AwsFleetViewProps> = ({ instances = [] }) => {
  const { executeInstanceAction } = useInfrastructure();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    instances[0]?.instanceId || null
  );

  const filteredInstances = (instances || []).filter(
    (i) =>
      (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.instanceId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.instanceType || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = async (instanceId: string, action: string) => {
    setActionInProgress(instanceId);
    try {
      await executeInstanceAction(instanceId, action, 'aws');
    } finally {
      setTimeout(() => setActionInProgress(null), 800);
    }
  };

  const selectedInstance = (instances || []).find((i) => i.instanceId === selectedInstanceId) || instances[0];

  return (
    <div className="space-y-3 font-sans w-full min-w-0">
      {/* Header bar with count and search */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card p-2.5 min-w-0">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-6 h-6 bg-[#FF9900]/20 border border-[#FF9900]/40 flex items-center justify-center rounded-[2px] shrink-0">
            <Server className="w-3.5 h-3.5 text-[#FF9900]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-mono font-bold text-foreground truncate">AWS EC2 COMPUTE FLEET</div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              {(instances || []).filter((i) => i.state === 'running').length} OF {instances.length} INSTANCES RUNNING
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 min-w-0">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
            <input
              type="text"
              placeholder="FILTER INSTANCES..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-secondary text-foreground text-[11px] font-mono pl-7 pr-2 py-1 rounded-[2px] border border-border focus:outline-none focus:border-primary w-40 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* Instance Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 w-full min-w-0">
        {filteredInstances.map((inst) => {
          const isRunning = inst.state === 'running';
          const isSelected = selectedInstance?.instanceId === inst.instanceId;

          return (
            <div
              key={inst.instanceId}
              onClick={() => setSelectedInstanceId(inst.instanceId)}
              className={`border p-3 space-y-2.5 transition-all cursor-pointer rounded-[2px] min-w-0 overflow-hidden ${
                isSelected
                  ? 'border-primary bg-card ring-1 ring-primary/40'
                  : 'border-border bg-card/60 hover:bg-card hover:border-border/80'
              }`}
            >
              {/* Top row: Name, State Badge, Type */}
              <div className="flex items-start justify-between gap-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-bold text-foreground truncate">
                    {inst.name}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">{inst.instanceId}</div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-[1px] ${
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
                    {inst.state}
                  </span>
                </div>
              </div>

              {/* Specs & AZ */}
              <div className="grid grid-cols-2 gap-1 text-[10px] font-mono bg-secondary/50 p-1.5 rounded-[2px] border border-border/60 min-w-0">
                <div className="min-w-0">
                  <span className="text-muted-foreground block text-[9px]">SHAPE</span>
                  <span className="text-foreground font-semibold truncate block">{inst.instanceType}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-muted-foreground block text-[9px]">AZ / REGION</span>
                  <span className="text-foreground font-semibold truncate block">{inst.availabilityZone}</span>
                </div>
              </div>

              {/* Metrics: CPU & Memory */}
              {isRunning && (
                <div className="space-y-1.5 pt-1 min-w-0">
                  <div className="space-y-1 min-w-0">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Cpu className="w-2.5 h-2.5" /> CPU UTIL
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
                        <HardDrive className="w-2.5 h-2.5" /> MEMORY
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

              {/* Status checks and Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10px] font-mono min-w-0">
                <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="text-[9px]">2/2 CHECKS</span>
                </div>

                <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleAction(inst.instanceId, 'reboot')}
                    disabled={actionInProgress === inst.instanceId || !isRunning}
                    title="Reboot Instance"
                    className="p-1 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-[2px] transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    <RotateCcw
                      className={`w-3 h-3 ${actionInProgress === inst.instanceId ? 'animate-spin text-primary' : ''}`}
                    />
                  </button>
                  <button
                    onClick={() => handleAction(inst.instanceId, isRunning ? 'stop' : 'start')}
                    disabled={actionInProgress === inst.instanceId}
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

      {/* Deep Inspection Panel for Selected Instance */}
      {selectedInstance && (
        <div className="border border-border bg-card p-3 space-y-3 w-full min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 min-w-0">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-xs font-mono font-bold text-foreground">INSTANCE TELEMETRY MATRIX</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-secondary text-primary font-semibold truncate">
                {selectedInstance.name} ({selectedInstance.instanceId})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
              <span>PUBLIC IP: <strong className="text-foreground font-mono">{selectedInstance.publicIp}</strong></span>
              <span>PRIVATE IP: <strong className="text-foreground font-mono">{selectedInstance.privateIp}</strong></span>
              <span>UPTIME: <strong className="text-foreground">{selectedInstance.uptimeHours}h</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full min-w-0">
            <div className="bg-secondary/40 p-2 border border-border rounded-[2px] min-w-0">
              <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                <Network className="w-2.5 h-2.5" /> NETWORK IN
              </div>
              <div className="text-sm font-mono font-bold text-foreground mt-0.5 truncate">
                {formatCompactNumber(selectedInstance.networkInKbps)} KB/S
              </div>
              <div className="text-[9px] font-mono text-muted-foreground truncate">EGRESS PROXIED</div>
            </div>

            <div className="bg-secondary/40 p-2 border border-border rounded-[2px] min-w-0">
              <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                <Network className="w-2.5 h-2.5" /> NETWORK OUT
              </div>
              <div className="text-sm font-mono font-bold text-foreground mt-0.5 truncate">
                {formatCompactNumber(selectedInstance.networkOutKbps)} KB/S
              </div>
              <div className="text-[9px] font-mono text-muted-foreground truncate">INGRESS SERVED</div>
            </div>

            <div className="bg-secondary/40 p-2 border border-border rounded-[2px] min-w-0">
              <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                <HardDrive className="w-2.5 h-2.5" /> DISK READ OPS
              </div>
              <div className="text-sm font-mono font-bold text-foreground mt-0.5 truncate">
                {formatCompactNumber(selectedInstance.diskReadOps)} IOPS
              </div>
              <div className="text-[9px] font-mono text-muted-foreground truncate">NVME READ</div>
            </div>

            <div className="bg-secondary/40 p-2 border border-border rounded-[2px] min-w-0">
              <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                <HardDrive className="w-2.5 h-2.5" /> DISK WRITE OPS
              </div>
              <div className="text-sm font-mono font-bold text-foreground mt-0.5 truncate">
                {formatCompactNumber(selectedInstance.diskWriteOps)} IOPS
              </div>
              <div className="text-[9px] font-mono text-muted-foreground truncate">NVME WRITE</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
