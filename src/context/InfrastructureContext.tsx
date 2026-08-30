import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  InfraAccount,
  InfraProviderType,
  UnifiedInfraData,
  InfraCredentialsPayload,
} from '../types/infrastructure';
import { TimeRange } from '../types/analytics';

interface InfrastructureContextType {
  accounts: InfraAccount[];
  selectedAccountId: string;
  selectedProvider: InfraProviderType;
  timeRange: TimeRange;
  data: UnifiedInfraData | null;
  isLoading: boolean;
  isSyncing: boolean;
  setSelectedAccountId: (id: string) => void;
  setSelectedProvider: (provider: InfraProviderType) => void;
  setTimeRange: (range: TimeRange) => void;
  refreshData: () => Promise<void>;
  saveAccount: (payload: InfraCredentialsPayload) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
  executeInstanceAction: (instanceId: string, action: string, provider: InfraProviderType) => Promise<boolean>;
}

const InfrastructureContext = createContext<InfrastructureContextType | undefined>(undefined);

export const InfrastructureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<InfraAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('infra-mesh-all');
  const [selectedProvider, setSelectedProvider] = useState<InfraProviderType>('unified-infra');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [data, setData] = useState<UnifiedInfraData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/infrastructure/accounts');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.accounts) {
          setAccounts(json.accounts);
          if (!json.accounts.some((a: InfraAccount) => a.id === selectedAccountId) && json.accounts.length > 0) {
            setSelectedAccountId(json.accounts[0].id);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch infra accounts:', e);
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

      const res = await fetch(`/api/infrastructure/data?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      }
    } catch (e) {
      console.error('Infra data load failure:', e);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [selectedAccountId, selectedProvider, timeRange, data]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchData();
  }, [selectedAccountId, selectedProvider, timeRange]);

  const refreshData = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/infrastructure/sync', {
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
      console.error('Infra explicit sync failure:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveAccount = async (payload: InfraCredentialsPayload): Promise<boolean> => {
    try {
      const res = await fetch('/api/infrastructure/accounts/save', {
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
    } catch (e) {
      console.error('Failed to save infra account:', e);
      return false;
    }
  };

  const deleteAccount = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/infrastructure/accounts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        await fetchAccounts();
        if (selectedAccountId === id) {
          setSelectedAccountId('infra-mesh-all');
          setSelectedProvider('unified-infra');
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete infra account:', e);
      return false;
    }
  };

  const executeInstanceAction = async (instanceId: string, action: string, provider: InfraProviderType): Promise<boolean> => {
    try {
      const res = await fetch('/api/infrastructure/instance-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, action, provider }),
      });
      const json = await res.json();
      if (json.success) {
        await refreshData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Instance action failed:', e);
      return false;
    }
  };

  return (
    <InfrastructureContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectedProvider,
        timeRange,
        data,
        isLoading,
        isSyncing,
        setSelectedAccountId,
        setSelectedProvider,
        setTimeRange,
        refreshData,
        saveAccount,
        deleteAccount,
        executeInstanceAction,
      }}
    >
      {children}
    </InfrastructureContext.Provider>
  );
};

export const useInfrastructure = () => {
  const context = useContext(InfrastructureContext);
  if (!context) {
    throw new Error('useInfrastructure must be used within an InfrastructureProvider');
  }
  return context;
};
