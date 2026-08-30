import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ProviderAccount,
  ProviderType,
  TimeRange,
  UnifiedAnalyticsData,
  ProviderCredentialsPayload,
} from '../types/analytics';
import { useAuth } from './AuthContext';

export type AppCategory = 'analytics' | 'infrastructure';

interface AnalyticsContextType {
  accounts: ProviderAccount[];
  selectedAccountId: string;
  selectedProvider: ProviderType;
  timeRange: TimeRange;
  data: UnifiedAnalyticsData | null;
  isLoading: boolean;
  isSyncing: boolean;
  isSidebarCollapsed: boolean;
  activeCategory: AppCategory;
  setActiveCategory: (cat: AppCategory) => void;
  setSelectedAccountId: (id: string) => void;
  setSelectedProvider: (provider: ProviderType) => void;
  setTimeRange: (range: TimeRange) => void;
  toggleSidebar: () => void;
  refreshData: () => Promise<void>;
  saveAccount: (payload: ProviderCredentialsPayload) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
  testConnection: (payload: { provider: ProviderType; targetResource: string; apiKey?: string }) => Promise<{ success: boolean; isLive: boolean; message: string }>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc-unified-all');
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('unified');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [data, setData] = useState<UnifiedAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<AppCategory>('analytics');


  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.accounts) {
          setAccounts(json.accounts);
          // If current selected account doesn't exist, pick the first
          if (!json.accounts.some((a: ProviderAccount) => a.id === selectedAccountId) && json.accounts.length > 0) {
            setSelectedAccountId(json.accounts[0].id);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch accounts:', e);
    }
  }, [selectedAccountId]);

  const fetchData = useCallback(async (showSyncSpinner = false) => {
    if (showSyncSpinner) setIsSyncing(true);
    else if (!data) setIsLoading(true);

    try {
      const query = new URLSearchParams({
        accountId: selectedAccountId,
        provider: selectedProvider,
        timeRange,
      });

      const res = await fetch(`/api/analytics/data?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      }
    } catch (e) {
      console.error('Analytics load failure:', e);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [selectedAccountId, selectedProvider, timeRange, data]);

  // Initial load
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Load telemetry when target or timeframe changes
  useEffect(() => {
    fetchData();
  }, [selectedAccountId, selectedProvider, timeRange]);

  // Auth state changes swap the entire dataset (demo ↔ live) — refetch both,
  // otherwise a signed-out session keeps showing the pre-logout account list.
  useEffect(() => {
    fetchAccounts();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          provider: selectedProvider,
          timeRange,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      }
    } catch (e) {
      console.error('Explicit sync failure:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const refreshData = async () => {
    await triggerSync();
  };

  const saveAccount = async (payload: ProviderCredentialsPayload): Promise<boolean> => {
    try {
      const res = await fetch('/api/accounts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success && json.account) {
        await fetchAccounts();
        setSelectedAccountId(json.account.id);
        setSelectedProvider(json.account.provider);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save account:', err);
      return false;
    }
  };

  const deleteAccount = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await fetchAccounts();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete account:', err);
      return false;
    }
  };

  const testConnection = async (payload: { provider: ProviderType; targetResource: string; apiKey?: string }) => {
    try {
      const res = await fetch('/api/accounts/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (e) {
      return { success: false, isLive: false, message: 'Connection test failed' };
    }
  };

  return (
    <AnalyticsContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectedProvider,
        timeRange,
        data,
        isLoading,
        isSyncing,
        isSidebarCollapsed,
        activeCategory,
        setActiveCategory,
        setSelectedAccountId,
        setSelectedProvider,
        setTimeRange,
        toggleSidebar,
        refreshData,
        saveAccount,
        deleteAccount,
        testConnection,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
};

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}
