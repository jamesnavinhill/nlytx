import crypto from 'crypto';
import { ProviderAccount, ProviderType, ProviderCredentialsPayload } from '../../src/types/analytics';
import { InfraAccount, InfraProviderType, InfraCredentialsPayload } from '../../src/types/infrastructure';

interface EncryptedData {
  iv: string;
  authTag: string;
  ciphertext: string;
}

interface StoredCredential {
  account: ProviderAccount;
  encryptedApiKey?: EncryptedData;
  encryptedApiSecret?: EncryptedData;
}

interface StoredInfraCredential {
  account: InfraAccount;
  encryptedApiKey?: EncryptedData;
  encryptedApiSecret?: EncryptedData;
  encryptedPrivateKey?: EncryptedData;
}

class CredentialVault {
  private store: Map<string, StoredCredential> = new Map();
  private infraStore: Map<string, StoredInfraCredential> = new Map();
  private readonly masterKey: Buffer;

  constructor() {
    const secret = process.env.VAULT_ENCRYPTION_KEY || process.env.GEMINI_API_KEY || 'unified-analytics-master-salt-2026';
    this.masterKey = crypto.createHash('sha256').update(secret).digest();
    this.seedDefaultAccounts();
    this.seedDefaultInfraAccounts();
  }

  private encrypt(plainText: string): EncryptedData {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return {
      iv: iv.toString('hex'),
      authTag,
      ciphertext: encrypted,
    };
  }

  private decrypt(data?: EncryptedData): string | undefined {
    if (!data || !data.ciphertext) return undefined;
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        Buffer.from(data.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
      let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      console.error('Failed to decrypt credential from vault:', e);
      return undefined;
    }
  }

  private seedDefaultAccounts() {
    const vercelEnvKey = process.env.VERCEL_BEARER_TOKEN?.trim();
    const cfEnvKey = process.env.CLOUDFLARE_API_TOKEN?.trim();
    const gaPropertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID?.trim() || 'properties/314159265';
    const gaApiKey = process.env.GOOGLE_ANALYTICS_API_KEY?.trim();

    // One Cloudflare account per managed zone
    const cfZones = [
      { id: 'acc-cf-apex', name: 'navinhill.com', zoneId: process.env.CLOUDFLARE_ZONE_ID?.trim() || '' },
      { id: 'acc-cf-jami', name: 'jami.studio', zoneId: process.env.CLOUDFLARE_ZONE_ID_JAMI?.trim() || '' },
      { id: 'acc-cf-gardens', name: 'mygardens.app', zoneId: process.env.CLOUDFLARE_ZONE_ID_GARDENS?.trim() || '' },
    ].filter((z) => z.zoneId && !z.zoneId.startsWith('zone_'));

    const defaultAccounts: { account: ProviderAccount; apiKey?: string; apiSecret?: string }[] = [
      {
        account: {
          id: 'acc-unified-all',
          provider: 'unified',
          name: 'Unified Mesh',
          targetResource: 'all-connected-nodes',
          hasKey: false,
          isLiveConnected: false,
          createdAt: new Date().toISOString(),
        },
      },
      {
        account: {
          id: 'acc-ga4-main',
          provider: 'google',
          name: 'Main Property GA4',
          targetResource: gaPropertyId,
          hasKey: !!gaApiKey,
          isLiveConnected: !!gaApiKey,
          createdAt: new Date().toISOString(),
        },
        apiKey: gaApiKey,
      },
      ...cfZones.map((z) => ({
        account: {
          id: z.id,
          provider: 'cloudflare' as const,
          name: z.name,
          targetResource: z.zoneId,
          hasKey: !!cfEnvKey,
          isLiveConnected: !!cfEnvKey,
          createdAt: new Date().toISOString(),
        },
        apiKey: cfEnvKey,
      })),
    ];

    for (const item of defaultAccounts) {
      this.store.set(item.account.id, {
        account: item.account,
        encryptedApiKey: item.apiKey ? this.encrypt(item.apiKey) : undefined,
        encryptedApiSecret: item.apiSecret ? this.encrypt(item.apiSecret) : undefined,
      });
    }
  }

  private seedDefaultInfraAccounts() {
    const awsKey = process.env.AWS_ACCESS_KEY_ID?.trim();
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const awsRegion = process.env.AWS_REGION?.trim() || 'us-east-1';

    const cfToken = process.env.CLOUDFLARE_ZERO_TRUST_TOKEN?.trim() || process.env.CLOUDFLARE_API_TOKEN?.trim();
    const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || 'cf_acc_enterprise_mesh';

    const ociTenancy = process.env.OCI_TENANCY_OCID?.trim();
    const ociKey = process.env.OCI_PRIVATE_KEY?.trim();

    const defaultInfra: { account: InfraAccount; apiKey?: string; apiSecret?: string; privateKey?: string }[] = [
      {
        account: {
          id: 'infra-mesh-all',
          provider: 'unified-infra',
          name: 'All Systems Fleet',
          region: 'multi-region (Global)',
          targetResource: 'all-infrastructure-mesh',
          hasKey: false,
          isLiveConnected: false,
          createdAt: new Date().toISOString(),
        },
      },
      {
        account: {
          id: 'infra-aws-prod',
          provider: 'aws',
          name: 'AWS Production Fleet',
          region: awsRegion,
          targetResource: 'ec2-asg-cluster',
          hasKey: !!(awsKey && awsSecret),
          isLiveConnected: !!(awsKey && awsSecret),
          createdAt: new Date().toISOString(),
        },
        apiKey: awsKey,
        apiSecret: awsSecret,
      },
      {
        account: {
          id: 'infra-cf-zerotrust',
          provider: 'cloudflare-infra',
          name: 'Cloudflare Zero Trust & Workers',
          region: 'Global Edge',
          targetResource: cfAccount,
          hasKey: !!cfToken,
          isLiveConnected: !!cfToken,
          createdAt: new Date().toISOString(),
        },
        apiKey: cfToken,
      },
      {
        account: {
          id: 'infra-oracle-prod',
          provider: 'oracle',
          name: 'Oracle OCI Cloud Compute',
          region: 'us-ashburn-1',
          targetResource: 'oci-compute-compartment',
          hasKey: !!(ociTenancy && ociKey),
          isLiveConnected: !!(ociTenancy && ociKey),
          createdAt: new Date().toISOString(),
        },
        apiKey: ociTenancy,
        privateKey: ociKey,
      },
    ];

    for (const item of defaultInfra) {
      this.infraStore.set(item.account.id, {
        account: item.account,
        encryptedApiKey: item.apiKey ? this.encrypt(item.apiKey) : undefined,
        encryptedApiSecret: item.apiSecret ? this.encrypt(item.apiSecret) : undefined,
        encryptedPrivateKey: item.privateKey ? this.encrypt(item.privateKey) : undefined,
      });
    }
  }

  // Analytics Accounts
  public getAccounts(providerFilter?: ProviderType): ProviderAccount[] {
    const list: ProviderAccount[] = [];
    for (const item of this.store.values()) {
      if (!providerFilter || providerFilter === 'unified' || item.account.provider === providerFilter) {
        list.push({ ...item.account });
      }
    }
    return list;
  }

  public getAccount(id: string): { account: ProviderAccount; apiKey?: string; apiSecret?: string } | undefined {
    const item = this.store.get(id);
    if (!item) return undefined;
    return {
      account: { ...item.account },
      apiKey: this.decrypt(item.encryptedApiKey),
      apiSecret: this.decrypt(item.encryptedApiSecret),
    };
  }

  public saveCredential(payload: ProviderCredentialsPayload): ProviderAccount {
    const id = payload.accountId || `acc-${payload.provider}-${Date.now().toString(36)}`;
    const rawKey = payload.apiKey?.trim();
    const isLive = !!(rawKey && rawKey.length > 0);

    const account: ProviderAccount = {
      id,
      provider: payload.provider,
      name: payload.name.trim() || `${payload.provider.toUpperCase()} Account`,
      targetResource: payload.targetResource.trim() || 'default-resource',
      hasKey: isLive,
      isLiveConnected: isLive,
      createdAt: new Date().toISOString(),
    };

    this.store.set(id, {
      account,
      encryptedApiKey: rawKey ? this.encrypt(rawKey) : undefined,
      encryptedApiSecret: payload.apiSecret ? this.encrypt(payload.apiSecret) : undefined,
    });

    return account;
  }

  public deleteAccount(id: string): boolean {
    return this.store.delete(id);
  }

  // Infrastructure Accounts
  public getInfraAccounts(providerFilter?: InfraProviderType): InfraAccount[] {
    const list: InfraAccount[] = [];
    for (const item of this.infraStore.values()) {
      if (!providerFilter || providerFilter === 'unified-infra' || item.account.provider === providerFilter) {
        list.push({ ...item.account });
      }
    }
    return list;
  }

  public getInfraAccount(id: string): {
    account: InfraAccount;
    apiKey?: string;
    apiSecret?: string;
    privateKey?: string;
  } | undefined {
    const item = this.infraStore.get(id);
    if (!item) return undefined;
    return {
      account: { ...item.account },
      apiKey: this.decrypt(item.encryptedApiKey),
      apiSecret: this.decrypt(item.encryptedApiSecret),
      privateKey: this.decrypt(item.encryptedPrivateKey),
    };
  }

  public saveInfraCredential(payload: InfraCredentialsPayload): InfraAccount {
    const id = payload.accountId || `infra-${payload.provider}-${Date.now().toString(36)}`;
    const rawKey = payload.apiKey?.trim();
    const isLive = !!(rawKey && rawKey.length > 0);

    const account: InfraAccount = {
      id,
      provider: payload.provider,
      name: payload.name.trim() || `${payload.provider.toUpperCase()} Infra Account`,
      region: payload.region?.trim() || 'us-east-1',
      targetResource: payload.targetResource.trim() || 'default-infra-resource',
      hasKey: isLive,
      isLiveConnected: isLive,
      createdAt: new Date().toISOString(),
    };

    this.infraStore.set(id, {
      account,
      encryptedApiKey: rawKey ? this.encrypt(rawKey) : undefined,
      encryptedApiSecret: payload.apiSecret ? this.encrypt(payload.apiSecret) : undefined,
      encryptedPrivateKey: payload.privateKey ? this.encrypt(payload.privateKey) : undefined,
    });

    return account;
  }

  public deleteInfraAccount(id: string): boolean {
    return this.infraStore.delete(id);
  }
}

export const vault = new CredentialVault();


