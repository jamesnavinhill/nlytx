import { UnifiedAnalyticsData } from '../../src/types/analytics';
import { UnifiedInfraData } from '../../src/types/infrastructure';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  syncedAt: string;
}

class TelemetryCacheService {
  private analyticsCache: Map<string, CacheEntry<UnifiedAnalyticsData>> = new Map();
  private infraCache: Map<string, CacheEntry<UnifiedInfraData>> = new Map();
  private readonly defaultTtlMs: number = 60 * 1000; // 60 seconds TTL

  private buildKey(provider: string, accountId: string, timeRange: string): string {
    return `${provider}::${accountId}::${timeRange}`;
  }

  // Analytics methods
  public get(provider: string, accountId: string, timeRange: string): UnifiedAnalyticsData | null {
    const key = this.buildKey(provider, accountId, timeRange);
    const entry = this.analyticsCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.analyticsCache.delete(key);
      return null;
    }

    return entry.data;
  }

  public set(provider: string, accountId: string, timeRange: string, data: UnifiedAnalyticsData, ttlMs = this.defaultTtlMs): void {
    const key = this.buildKey(provider, accountId, timeRange);
    this.analyticsCache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      syncedAt: new Date().toISOString(),
    });
  }

  // Infrastructure methods
  public getInfra(provider: string, accountId: string, timeRange: string): UnifiedInfraData | null {
    const key = this.buildKey(provider, accountId, timeRange);
    const entry = this.infraCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.infraCache.delete(key);
      return null;
    }

    return entry.data;
  }

  public setInfra(provider: string, accountId: string, timeRange: string, data: UnifiedInfraData, ttlMs = this.defaultTtlMs): void {
    const key = this.buildKey(provider, accountId, timeRange);
    this.infraCache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      syncedAt: new Date().toISOString(),
    });
  }

  public invalidate(provider?: string, accountId?: string): void {
    if (!provider && !accountId) {
      this.analyticsCache.clear();
      this.infraCache.clear();
      return;
    }

    for (const key of this.analyticsCache.keys()) {
      if (accountId && key.includes(`::${accountId}::`)) {
        this.analyticsCache.delete(key);
      } else if (provider && key.startsWith(`${provider}::`)) {
        this.analyticsCache.delete(key);
      }
    }

    for (const key of this.infraCache.keys()) {
      if (accountId && key.includes(`::${accountId}::`)) {
        this.infraCache.delete(key);
      } else if (provider && key.startsWith(`${provider}::`)) {
        this.infraCache.delete(key);
      }
    }
  }
}

export const analyticsCache = new TelemetryCacheService();

