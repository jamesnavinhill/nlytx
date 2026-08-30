import React, { useState } from 'react';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { ProviderType } from '../../types/analytics';
import { InfraProviderType } from '../../types/infrastructure';
import {
  Globe,
  Triangle,
  Cloud,
  BarChart3,
  Server,
  ShieldCheck,
  Database,
  ChevronDown,
  ChevronRight,
  Activity,
  Layers,
  HardDrive,
  Cpu,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CollapsibleSidebar: React.FC = () => {
  const {
    activeCategory,
    setActiveCategory,
    selectedProvider: analyticsProvider,
    setSelectedProvider: setAnalyticsProvider,
    accounts: analyticsAccounts = [],
    selectedAccountId: analyticsAccountId,
    setSelectedAccountId: setAnalyticsAccountId,
    isSidebarCollapsed,
    toggleSidebar,
  } = useAnalytics();

  const {
    selectedProvider: infraProvider,
    setSelectedProvider: setInfraProvider,
    accounts: infraAccounts = [],
    selectedAccountId: infraAccountId,
    setSelectedAccountId: setInfraAccountId,
  } = useInfrastructure();

  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [infraOpen, setInfraOpen] = useState(true);

  const safeAnalyticsAccounts = analyticsAccounts || [];
  const safeInfraAccounts = infraAccounts || [];

  // Analytics Providers definition
  const analyticsProviders: { id: ProviderType; label: string; icon: React.ReactNode }[] = [
    { id: 'unified', label: 'Unified Mesh', icon: <Globe className="h-4 w-4" /> },
    { id: 'vercel', label: 'Vercel', icon: <Triangle className="h-4 w-4" /> },
    { id: 'cloudflare', label: 'Cloudflare', icon: <Cloud className="h-4 w-4" /> },
    { id: 'google', label: 'Google Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  // Infrastructure Providers definition
  const infraProviders: { id: InfraProviderType; label: string; icon: React.ReactNode }[] = [
    { id: 'unified-infra', label: 'All Systems Fleet', icon: <Layers className="h-4 w-4" /> },
    { id: 'aws', label: 'AWS EC2 Compute', icon: <Server className="h-4 w-4" /> },
    { id: 'cloudflare-infra', label: 'Cloudflare Zero Trust', icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'oracle', label: 'Oracle OCI Cloud', icon: <Database className="h-4 w-4" /> },
  ];

  return (
    <>
      {/* Mobile Backdrop when expanded on small screens */}
      {!isSidebarCollapsed && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-background/60 backdrop-blur-xs z-20 md:hidden"
        />
      )}

      <motion.aside
        initial={false}
        animate={{
          width: isSidebarCollapsed ? 48 : 230,
        }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className={`border-r border-[#2A2A28] bg-card flex flex-col justify-between select-none overflow-hidden shrink-0 z-30 ${
          !isSidebarCollapsed ? 'fixed md:relative top-12 bottom-0 md:top-auto md:bottom-auto' : 'relative'
        }`}
      >
        <div className="p-2 space-y-3 overflow-y-auto">
          {/* ========================================================================= */}
          {/* SECTION 1: ANALYTICS                                                      */}
          {/* ========================================================================= */}
          <div className="space-y-1">
            {!isSidebarCollapsed ? (
              <button
                onClick={() => setAnalyticsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <div className="flex items-center space-x-1">
                  <Activity className="w-3 h-3 text-primary" />
                  <span>ANALYTICS</span>
                </div>
                {analyticsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            ) : (
              <div className="w-full h-4 flex items-center justify-center">
                <span className="w-4 h-[1px] bg-border block" />
              </div>
            )}

            {/* Analytics Provider List */}
            <div className="space-y-0.5">
              {(isSidebarCollapsed || analyticsOpen) &&
                analyticsProviders.map((p) => {
                  const isSelected = activeCategory === 'analytics' && analyticsProvider === p.id;
                  const providerAccounts = safeAnalyticsAccounts.filter(
                    (a) => p.id === 'unified' || a.provider === p.id
                  );

                  return (
                    <div key={p.id} className="space-y-0.5">
                      <button
                        onClick={() => {
                          setActiveCategory('analytics');
                          setAnalyticsProvider(p.id);
                          if (providerAccounts.length > 0) {
                            setAnalyticsAccountId(providerAccounts[0].id);
                          }
                        }}
                        className={`w-full flex items-center h-8 px-2 rounded-[2px] transition-colors cursor-pointer text-xs font-mono min-h-[36px] ${
                          isSelected
                            ? 'bg-secondary text-primary font-bold border border-primary/40'
                            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent'
                        }`}
                        title={p.label}
                      >
                        <span className="shrink-0">{p.icon}</span>
                        {!isSidebarCollapsed && (
                          <span className="ml-2 truncate text-left flex-1">{p.label}</span>
                        )}
                        {!isSidebarCollapsed && providerAccounts.length > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {providerAccounts.length}
                          </span>
                        )}
                      </button>

                      {/* Sub-account list */}
                      {!isSidebarCollapsed && isSelected && providerAccounts.length > 0 && (
                        <div className="pl-4 space-y-0.5 pt-0.5 border-l border-border/80 ml-3">
                          {providerAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              onClick={() => {
                                setActiveCategory('analytics');
                                setAnalyticsAccountId(acc.id);
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono rounded-[2px] cursor-pointer truncate min-h-[30px] ${
                                activeCategory === 'analytics' && analyticsAccountId === acc.id
                              ? 'bg-secondary text-foreground font-semibold border-l-2 border-primary'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <span className="truncate">{acc.name}</span>
                              {acc.isLiveConnected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 ml-1" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="h-[1px] bg-border mx-1" />

          {/* ========================================================================= */}
          {/* SECTION 2: INFRASTRUCTURE                                                 */}
          {/* ========================================================================= */}
          <div className="space-y-1">
            {!isSidebarCollapsed ? (
              <button
                onClick={() => setInfraOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <div className="flex items-center space-x-1">
                  <Server className="w-3 h-3 text-primary" />
                  <span>INFRASTRUCTURE</span>
                </div>
                {infraOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            ) : (
              <div className="w-full h-4 flex items-center justify-center">
                <span className="w-4 h-[1px] bg-border block" />
              </div>
            )}

            {/* Infra Provider List */}
            <div className="space-y-0.5">
              {(isSidebarCollapsed || infraOpen) &&
                infraProviders.map((p) => {
                  const isSelected = activeCategory === 'infrastructure' && infraProvider === p.id;
                  const providerAccounts = safeInfraAccounts.filter(
                    (a) => p.id === 'unified-infra' || a.provider === p.id
                  );

                  return (
                    <div key={p.id} className="space-y-0.5">
                      <button
                        onClick={() => {
                          setActiveCategory('infrastructure');
                          setInfraProvider(p.id);
                          if (providerAccounts.length > 0) {
                            setInfraAccountId(providerAccounts[0].id);
                          }
                        }}
                        className={`w-full flex items-center h-8 px-2 rounded-[2px] transition-colors cursor-pointer text-xs font-mono min-h-[36px] ${
                          isSelected
                            ? 'bg-secondary text-primary font-bold border border-primary/40'
                            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent'
                        }`}
                        title={p.label}
                      >
                        <span className="shrink-0">{p.icon}</span>
                        {!isSidebarCollapsed && (
                          <span className="ml-2 truncate text-left flex-1">{p.label}</span>
                        )}
                        {!isSidebarCollapsed && providerAccounts.length > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {providerAccounts.length}
                          </span>
                        )}
                      </button>

                      {/* Sub-account list */}
                      {!isSidebarCollapsed && isSelected && providerAccounts.length > 0 && (
                        <div className="pl-4 space-y-0.5 pt-0.5 border-l border-border/80 ml-3">
                          {providerAccounts.map((acc) => (
                            <button
                              key={acc.id}
                              onClick={() => {
                                setActiveCategory('infrastructure');
                                setInfraAccountId(acc.id);
                              }}
                              className={`w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono rounded-[2px] cursor-pointer truncate min-h-[30px] ${
                                activeCategory === 'infrastructure' && infraAccountId === acc.id
                                  ? 'bg-secondary text-foreground font-semibold border-l-2 border-primary'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <span className="truncate">{acc.name}</span>
                              {acc.isLiveConnected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 ml-1" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Bottom status badge */}
        <div className="p-2 border-t border-[#2A2A28] font-mono text-[10px] text-muted-foreground flex items-center justify-between bg-card">
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center space-x-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-foreground font-semibold uppercase">{activeCategory} STREAM</span>
              </div>
              <span className="text-[9px] text-muted-foreground">PORT:3000</span>
            </>
          ) : (
            <div className="mx-auto">
              <span className="h-2 w-2 rounded-full bg-primary block" />
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
};
