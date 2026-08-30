import React, { useState } from 'react';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { SettingsDialog } from '../settings/SettingsDialog';
import { LoginDialog } from '../auth/LoginDialog';
import { TimeRange } from '../../types/analytics';
import {
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sun,
  Moon,
  Settings,
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

  const initials = user ? user.email.slice(0, 2).toUpperCase() : '';

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

      {/* Right: Functional Controls (Time Range, Refresh, Theme Toggle, Profile) */}
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

        {/* Profile avatar menu: login/logout + settings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-8 w-8 rounded-full flex items-center justify-center border border-border bg-secondary/60 hover:bg-secondary transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Account menu"
            >
              {user ? (
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="font-mono text-[9px] bg-primary text-primary-foreground rounded-full">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <LogIn className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 font-mono text-xs">
            {user ? (
              <>
                <DropdownMenuLabel className="text-[10px] truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Log Out
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                  Browsing as guest
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
                  <Settings className="h-3.5 w-3.5 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLoginOpen(true)} className="cursor-pointer">
                  <LogIn className="h-3.5 w-3.5 mr-2" />
                  Log In
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </header>
  );
};
