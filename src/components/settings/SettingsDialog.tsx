import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { useTheme } from '../../context/ThemeContext';
import { useAnalytics } from '../../context/AnalyticsContext';
import { useInfrastructure } from '../../context/InfrastructureContext';
import { ProviderType, DitherAlgorithm } from '../../types/analytics';
import { InfraProviderType } from '../../types/infrastructure';
import {
  Sun,
  Moon,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Shield,
  Palette,
  Server,
  Activity,
  RotateCcw,
} from 'lucide-react';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onOpenChange }) => {
  const {
    theme,
    toggleMode,
    setAccentColor,
    setGraphPrimaryColor,
    setGraphSecondaryColor,
    setDitherDensity,
    setDitherAlgorithm,
    resetTheme,
  } = useTheme();

  const {
    accounts: analyticsAccounts,
    saveAccount: saveAnalyticsAccount,
    deleteAccount: deleteAnalyticsAccount,
    testConnection: testAnalyticsConnection,
  } = useAnalytics();

  const {
    accounts: infraAccounts,
    saveAccount: saveInfraAccount,
    deleteAccount: deleteInfraAccount,
    testConnection: testInfraConnection,
  } = useInfrastructure();

  const [activeTab, setActiveTab] = useState<'appearance' | 'accounts' | 'dither'>('appearance');
  const [accountCategory, setAccountCategory] = useState<'analytics' | 'infrastructure'>('analytics');

  // New account form state
  const [newAnalyticsProvider, setNewAnalyticsProvider] = useState<ProviderType>('vercel');
  const [newInfraProvider, setNewInfraProvider] = useState<InfraProviderType>('aws');
  const [newName, setNewName] = useState('');
  const [newResource, setNewResource] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiSecret, setNewApiSecret] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ isLive: boolean; message: string } | null>(null);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (accountCategory === 'analytics') {
      await saveAnalyticsAccount({
        provider: newAnalyticsProvider,
        name: newName,
        targetResource: newResource,
        apiKey: newApiKey,
      });
    } else {
      await saveInfraAccount({
        provider: newInfraProvider,
        name: newName,
        region: newResource || 'us-east-1',
        apiKey: newApiKey,
        apiSecret: newApiSecret,
      });
    }

    setNewName('');
    setNewResource('');
    setNewApiKey('');
    setNewApiSecret('');
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    if (accountCategory === 'analytics') {
      const res = await testAnalyticsConnection({
        provider: newAnalyticsProvider,
        targetResource: newResource,
        apiKey: newApiKey,
      });
      setTestResult({ isLive: res.isLive, message: res.message });
    } else {
      const res = await testInfraConnection({
        provider: newInfraProvider,
        region: newResource || 'us-east-1',
        apiKey: newApiKey,
        apiSecret: newApiSecret,
      });
      setTestResult({ isLive: res.isLive, message: res.message });
    }
    setIsTesting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg font-sans">
        <DialogHeader className="pr-8">
          <div className="flex items-center justify-between">
            <DialogTitle>CONTROL MATRIX</DialogTitle>
            {/* Top Navigation Tabs with adequate right padding away from the Close X */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setActiveTab('appearance')}
                className={`px-2 py-1 text-xs font-mono rounded-[2px] flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                  activeTab === 'appearance'
                    ? 'bg-secondary text-primary border-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-secondary/50'
                }`}
              >
                <Palette className="h-3.5 w-3.5" />
                <span>COLORS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dither')}
                className={`px-2 py-1 text-xs font-mono rounded-[2px] flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                  activeTab === 'dither'
                    ? 'bg-secondary text-primary border-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-secondary/50'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>DITHER</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('accounts')}
                className={`px-2 py-1 text-xs font-mono rounded-[2px] flex items-center space-x-1.5 transition-colors cursor-pointer border ${
                  activeTab === 'accounts'
                    ? 'bg-secondary text-primary border-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-secondary/50'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>KEYS</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Tab 1: Appearance & Full Color Picker (Accent, Primary Graph, Secondary Graph) */}
        {activeTab === 'appearance' && (
          <div className="space-y-4 py-2 font-mono text-xs">
            {/* Mode Switcher */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-semibold">THEME MODE</span>
              <button
                type="button"
                onClick={toggleMode}
                className="px-2.5 py-1 border border-border bg-secondary/60 hover:bg-secondary text-foreground rounded-[2px] flex items-center space-x-1.5 cursor-pointer"
              >
                {theme.mode === 'dark' ? (
                  <>
                    <Moon className="h-3.5 w-3.5 text-primary" />
                    <span>DARK</span>
                  </>
                ) : (
                  <>
                    <Sun className="h-3.5 w-3.5 text-primary" />
                    <span>LIGHT</span>
                  </>
                )}
              </button>
            </div>

            <Separator />

            {/* Accent Color: Full Color Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold">ACCENT & HIGHLIGHT COLOR</span>
                <span className="text-foreground font-bold">{theme.accentColor}</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={theme.accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-[2px] border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={theme.accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 h-8 bg-secondary border border-border px-2 text-xs text-foreground rounded-[2px]"
                />
              </div>
            </div>

            {/* Graph Primary Color */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold">PRIMARY CHART COLOR</span>
                <span className="text-foreground font-bold">{theme.graphPrimaryColor}</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={theme.graphPrimaryColor}
                  onChange={(e) => setGraphPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded-[2px] border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={theme.graphPrimaryColor}
                  onChange={(e) => setGraphPrimaryColor(e.target.value)}
                  className="flex-1 h-8 bg-secondary border border-border px-2 text-xs text-foreground rounded-[2px]"
                />
              </div>
            </div>

            {/* Graph Secondary Color */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold">SECONDARY CHART COLOR (SERIES B / PREVIOUS)</span>
                <span className="text-foreground font-bold">{theme.graphSecondaryColor}</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={theme.graphSecondaryColor}
                  onChange={(e) => setGraphSecondaryColor(e.target.value)}
                  className="w-8 h-8 rounded-[2px] border border-border cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={theme.graphSecondaryColor}
                  onChange={(e) => setGraphSecondaryColor(e.target.value)}
                  className="flex-1 h-8 bg-secondary border border-border px-2 text-xs text-foreground rounded-[2px]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={resetTheme}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Theme Defaults</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Dither Engine Settings */}
        {activeTab === 'dither' && (
          <div className="space-y-4 py-2 font-mono text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">DITHER DENSITY</span>
                <span className="text-foreground font-bold">{theme.ditherDensity}x</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {([1, 2, 3, 4] as const).map((density) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() => setDitherDensity(density)}
                    className={`h-7 text-xs font-mono rounded-[2px] border cursor-pointer transition-colors ${
                      theme.ditherDensity === density
                        ? 'bg-secondary border-primary text-primary font-bold'
                        : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {density}X
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <span className="text-muted-foreground">DITHER MATRIX ALGORITHM</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(['bayer-4x4', 'bayer-8x8', 'floyd-steinberg', 'ordered-halftone'] as DitherAlgorithm[]).map(
                  (algo) => (
                    <button
                      key={algo}
                      type="button"
                      onClick={() => setDitherAlgorithm(algo)}
                      className={`h-7 px-2 text-[10px] uppercase font-mono rounded-[2px] border cursor-pointer transition-colors truncate ${
                        theme.ditherAlgorithm === algo
                          ? 'bg-secondary border-primary text-primary font-bold'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {algo.replace('-', ' ')}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Providers & API Key Management */}
        {activeTab === 'accounts' && (
          <div className="space-y-3 py-1 font-mono text-xs">
            {/* Category Toggle: Analytics vs Infrastructure */}
            <div className="grid grid-cols-2 gap-1 bg-secondary/50 p-0.5 rounded-[2px] border border-border text-[10px]">
              <button
                type="button"
                onClick={() => setAccountCategory('analytics')}
                className={`py-1 flex items-center justify-center space-x-1 rounded-[1px] cursor-pointer ${
                  accountCategory === 'analytics'
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>ANALYTICS</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountCategory('infrastructure')}
                className={`py-1 flex items-center justify-center space-x-1 rounded-[1px] cursor-pointer ${
                  accountCategory === 'infrastructure'
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Server className="w-3 h-3" />
                <span>INFRASTRUCTURE</span>
              </button>
            </div>

            {/* Existing Accounts List */}
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {(accountCategory === 'analytics' ? analyticsAccounts : infraAccounts).map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-1.5 border border-border bg-secondary/40 rounded-[2px]"
                >
                  <div className="flex flex-col truncate max-w-[70%]">
                    <span className="text-foreground font-semibold truncate text-[11px]">{acc.name}</span>
                    <span className="text-[9px] text-muted-foreground truncate">
                      {acc.provider.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {acc.isLiveConnected ? (
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    ) : (
                      <span className="text-[9px] text-muted-foreground">OFFLINE</span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        accountCategory === 'analytics'
                          ? deleteAnalyticsAccount(acc.id)
                          : deleteInfraAccount(acc.id)
                      }
                      className="h-6 w-6 flex items-center justify-center rounded-[2px] bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white cursor-pointer transition-colors"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Add Account / Credentials Form */}
            <form onSubmit={handleCreateAccount} className="space-y-2">
              {accountCategory === 'analytics' ? (
                <div className="grid grid-cols-3 gap-1">
                  {(['vercel', 'cloudflare', 'google'] as ProviderType[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewAnalyticsProvider(p)}
                      className={`py-1 text-center border rounded-[2px] cursor-pointer text-[10px] ${
                        newAnalyticsProvider === p
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border bg-secondary/30 text-muted-foreground'
                      }`}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {(['aws', 'cloudflare-infra', 'oracle'] as InfraProviderType[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewInfraProvider(p)}
                      className={`py-1 text-center border rounded-[2px] cursor-pointer text-[10px] ${
                        newInfraProvider === p
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border bg-secondary/30 text-muted-foreground'
                      }`}
                    >
                      {p === 'cloudflare-infra' ? 'CLOUDFLARE' : p.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Account display name"
                className="w-full h-7 bg-secondary border border-border px-2 text-xs text-foreground rounded-[2px]"
                required
              />

              <input
                type="text"
                value={newResource}
                onChange={(e) => setNewResource(e.target.value)}
                placeholder={
                  accountCategory === 'analytics'
                    ? newAnalyticsProvider === 'vercel'
                      ? 'Vercel Project ID / Slug'
                      : newAnalyticsProvider === 'cloudflare'
                      ? 'Cloudflare Zone ID'
                      : 'GA4 Property ID'
                    : newInfraProvider === 'aws'
                    ? 'AWS Region (e.g. us-east-1)'
                    : newInfraProvider === 'cloudflare-infra'
                    ? 'Account ID / Tunnel UUID'
                    : 'OCI Compartment OCID'
                }
                className="w-full h-7 bg-secondary border border-border px-2 text-xs text-foreground rounded-[2px]"
              />

              <input
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder={
                  accountCategory === 'infrastructure' && newInfraProvider === 'aws'
                    ? 'AWS Access Key ID'
                    : 'API Token / Key'
                }
                className="w-full h-7 bg-secondary border border-border px-2 text-xs text-foreground rounded-[2px]"
              />

              {accountCategory === 'infrastructure' && newInfraProvider === 'aws' && (
                <input
                  type="password"
                  value={newApiSecret}
                  onChange={(e) => setNewApiSecret(e.target.value)}
                  placeholder="AWS Secret Access Key"
                  className="w-full h-7 bg-secondary border border-border px-2 text-xs text-foreground rounded-[2px]"
                />
              )}

              {testResult && (
                <div
                  className={`p-1.5 text-[10px] border flex items-center space-x-1.5 ${
                    testResult.isLive
                      ? 'border-primary/50 text-primary bg-primary/5'
                      : 'border-border text-muted-foreground bg-secondary/50'
                  }`}
                >
                  {testResult.isLive ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="h-7 px-2.5 border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-mono rounded-[2px] flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isTesting ? 'animate-spin' : ''}`} />
                  <span>TEST</span>
                </button>
                <button
                  type="submit"
                  className="h-7 px-3 bg-primary text-primary-foreground text-xs font-mono font-bold rounded-[2px] flex items-center space-x-1 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-3 w-3" />
                  <span>SAVE</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
