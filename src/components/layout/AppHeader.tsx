import React, { useState } from 'react';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { SettingsDialog } from '../settings/SettingsDialog';
import { LoginDialog } from '../auth/LoginDialog';
import { TimeRange } from '../../types/analytics';
import {
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sun,
  Moon,
  SlidersHorizontal,
  LogIn,
  LogOut,
} from 'lucide-react';

export const AppHeader: React.FC = () => {
  const {
    activeCategory,
    timeRange,
    setTimeRange,
    refreshData: refreshAnalytics,
    isSyncing: isSyncingAnalytics,
    isSidebarCollapsed,
    toggleSidebar,
  } = useAnalytics();

  const {
    refreshData: refreshInfra,
    isSyncing: isSyncingInfra,
  } = useInfrastructure();

  const { theme, toggleMode } = useTheme();
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const isSyncing = isSyncingAnalytics || isSyncingInfra;
  const handleRefresh = async () => {
    if (activeCategory === 'analytics') {
      await refreshAnalytics();
    } else {
      await refreshInfra();
    }
  };

  const timeRanges: { id: TimeRange; label: string }[] = [
    { id: '24h', label: '24H' },
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
  ];

  return (
    <header className="h-11 border-b border-border bg-card px-2 sm:px-3 flex items-center justify-between select-none z-40 relative">
      {/* Left: Sidebar Toggle */}
      <div className="flex items-center">
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleSidebar}
          tooltip={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hover:bg-secondary text-muted-foreground hover:text-foreground h-8 w-8"
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Right: Functional Controls (Time Range, Refresh, Theme Toggle, Settings) */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Time range selector */}
        <div className="flex items-center border border-border bg-secondary/60 rounded-[2px] p-0.5 space-x-0.5 font-mono text-[10px]">
          {timeRanges.map((tr) => (
            <button
              key={tr.id}
              onClick={() => setTimeRange(tr.id)}
              className={`px-2 py-0.5 rounded-[1px] transition-colors cursor-pointer ${
                timeRange === tr.id
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>

        {/* Sync / Refresh */}
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          disabled={isSyncing}
          tooltip="Sync active stream"
          className="hover:bg-secondary text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
        </Button>

        {/* Theme Mode Toggle */}
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleMode}
          tooltip={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="hover:bg-secondary text-muted-foreground hover:text-foreground h-8 w-8"
        >
          {theme.mode === 'dark' ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Auth / Account */}
        {user ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => logout()}
            tooltip={`Log out ${user.email}`}
            className="hover:bg-secondary text-muted-foreground hover:text-foreground h-8 max-w-40 gap-1 px-2"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono text-[10px] truncate">{user.email}</span>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLoginOpen(true)}
            tooltip="Log in to persist accounts"
            className="hover:bg-secondary text-muted-foreground hover:text-foreground h-8 w-8"
          >
            <LogIn className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Settings Matrix */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSettingsOpen(true)}
          tooltip="Settings & Credentials Matrix"
          className="hover:bg-secondary text-muted-foreground hover:text-foreground h-8 w-8"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </header>
  );
};
