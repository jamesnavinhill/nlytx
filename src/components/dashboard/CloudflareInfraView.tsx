import React, { useState } from 'react';
import { CloudflareGatewayTunnel, CloudflareWorkerService } from '../../types/infrastructure';
import {
  ShieldCheck,
  Zap,
  Search,
} from 'lucide-react';
import { formatBytes, formatCompactNumber } from '../../lib/utils';

interface CloudflareInfraViewProps {
  tunnels?: CloudflareGatewayTunnel[];
  workers?: CloudflareWorkerService[];
}

export const CloudflareInfraView: React.FC<CloudflareInfraViewProps> = ({
  tunnels = [],
  workers = [],
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'tunnels' | 'workers'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const safeTunnels = tunnels || [];
  const safeWorkers = workers || [];

  const filteredTunnels = safeTunnels.filter(
    (t) =>
      (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWorkers = safeWorkers.filter(
    (w) =>
      (w.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.routes || []).some((r) => r.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-3 font-sans w-full min-w-0">
      {/* Control / Tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card p-2.5 min-w-0">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-6 h-6 bg-[#F38020]/20 border border-[#F38020]/40 flex items-center justify-center rounded-[2px] shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F38020]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-mono font-bold text-foreground truncate">CLOUDFLARE ZERO TRUST & WORKERS</div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              {safeTunnels.filter((t) => t.status === 'healthy').length} TUNNELS HEALTHY · {safeWorkers.length} ACTIVE WORKERS
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-1.5 min-w-0">
          {/* Sub-tab switcher */}
          <div className="flex items-center border border-border bg-secondary/60 rounded-[2px] p-0.5 space-x-0.5 font-mono text-[10px]">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2 py-0.5 rounded-[1px] transition-colors cursor-pointer ${
                activeTab === 'all' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setActiveTab('tunnels')}
              className={`px-2 py-0.5 rounded-[1px] transition-colors cursor-pointer ${
                activeTab === 'tunnels' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              TUNNELS ({safeTunnels.length})
            </button>
            <button
              onClick={() => setActiveTab('workers')}
              className={`px-2 py-0.5 rounded-[1px] transition-colors cursor-pointer ${
                activeTab === 'workers' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              WORKERS ({safeWorkers.length})
            </button>
          </div>

          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
            <input
              type="text"
              placeholder="FILTER CLOUDFLARE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-secondary text-foreground text-[11px] font-mono pl-7 pr-2 py-1 rounded-[2px] border border-border focus:outline-none focus:border-primary w-40 sm:w-44"
            />
          </div>
        </div>
      </div>

      {/* SECTION 1: ZERO TRUST GATEWAY TUNNELS */}
      {(activeTab === 'all' || activeTab === 'tunnels') && (
        <div className="space-y-2 w-full min-w-0">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-foreground">
            <span className="flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" /> GATEWAY CLOUDFLARED TUNNELS
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">ENCRYPTED QUIC MESH</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 w-full min-w-0">
            {filteredTunnels.map((tunnel) => {
              const isHealthy = tunnel.status === 'healthy';

              return (
                <div
                  key={tunnel.id}
                  className="border border-border bg-card p-3 space-y-2.5 rounded-[2px] hover:border-border/80 transition-all min-w-0 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-bold text-foreground truncate">
                        {tunnel.name}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">{tunnel.id}</div>
                    </div>

                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-[1px] shrink-0 ${
                        isHealthy
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full mr-1 bg-emerald-500 animate-pulse shrink-0" />
                      {tunnel.status}
                    </span>
                  </div>

                  {/* Connectors */}
                  <div className="space-y-1 min-w-0">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase">
                      ACTIVE CONNECTORS ({(tunnel.connectors || []).length})
                    </div>
                    <div className="space-y-1 min-w-0">
                      {(tunnel.connectors || []).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-2 text-[10px] font-mono bg-secondary/50 px-1.5 py-1 rounded-[1px] border border-border/50 min-w-0 overflow-hidden"
                        >
                          <div className="flex items-center space-x-1.5 min-w-0 truncate flex-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-foreground truncate min-w-0">{c.id}</span>
                            <span className="text-muted-foreground text-[9px] shrink-0">v{c.version}</span>
                          </div>
                          <span className="px-1 py-0.2 bg-card text-[9px] font-bold text-primary border border-border shrink-0">
                            POP: {c.colo}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ingress Rules Map */}
                  <div className="space-y-1 min-w-0">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase">INGRESS ROUTING</div>
                    <div className="space-y-0.5 min-w-0">
                      {(tunnel.ingressRules || []).map((rule, idx) => (
                        <div
                          key={idx}
                          className="text-[10px] font-mono text-muted-foreground flex items-center justify-between gap-2 min-w-0 overflow-hidden"
                        >
                          <span className="text-foreground truncate min-w-0 flex-1">{rule.hostname}</span>
                          <span className="text-primary text-[9px] truncate shrink-0 max-w-[50%]">{rule.service}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Transferred & Latency */}
                  <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border/60 text-[10px] font-mono">
                    <div className="min-w-0">
                      <span className="text-muted-foreground block text-[9px]">TRANSFERRED</span>
                      <span className="text-foreground font-bold truncate block">{formatBytes(tunnel.bytesTransferred)}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground block text-[9px]">EDGE LATENCY</span>
                      <span className="text-primary font-bold truncate block">{tunnel.latencyMs} ms</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: SERVERLESS EDGE WORKERS */}
      {(activeTab === 'all' || activeTab === 'workers') && (
        <div className="space-y-2 pt-2 w-full min-w-0">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-foreground">
            <span className="flex items-center gap-1.5 truncate">
              <Zap className="w-3.5 h-3.5 text-primary shrink-0" /> SERVERLESS EDGE WORKERS
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">GLOBAL V8 ISOLATES</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 w-full min-w-0">
            {filteredWorkers.map((worker) => (
              <div
                key={worker.id}
                className="border border-border bg-card p-3 space-y-2 rounded-[2px] hover:border-border/80 transition-all flex flex-col justify-between min-w-0 overflow-hidden"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-start justify-between gap-1 min-w-0">
                    <div className="font-mono text-xs font-bold text-foreground truncate min-w-0 flex-1">
                      {worker.name}
                    </div>
                    <span className="px-1.5 py-0.2 bg-primary/10 text-primary text-[9px] font-mono font-bold uppercase border border-primary/30 rounded-[1px] shrink-0">
                      {worker.status}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-muted-foreground truncate min-w-0">
                    <span className="truncate block min-w-0">
                      {(worker.routes && worker.routes[0]) || 'No route binding'}
                    </span>
                  </div>

                  {/* Throughput & CPU */}
                  <div className="grid grid-cols-2 gap-1 bg-secondary/50 p-1.5 rounded-[1px] border border-border/60 font-mono text-[10px]">
                    <div className="min-w-0">
                      <span className="text-muted-foreground block text-[9px]">RPS</span>
                      <span className="text-foreground font-bold truncate block">{formatCompactNumber(worker.requestsPerSec)}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted-foreground block text-[9px]">p50 CPU</span>
                      <span className="text-primary font-bold truncate block">{worker.p50CpuMs} ms</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-1 font-mono text-[9px] text-muted-foreground">
                  <div className="truncate">
                    ERR RATE: <strong className="text-foreground">{worker.errorRate}%</strong>
                  </div>
                  <div className="truncate">
                    SUBREQ: <strong className="text-foreground">{worker.subrequestCount}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
