import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { campaignManager, CampaignState } from '@/lib/campaignManager';

export interface Account {
  id: string;
  name: string;
  provider: 'activecampaign' | 'benchmark' | 'omnisend' | 'buttondown' | 'brevo' | 'systemio' | 'plunk' | 'mailersend' | 'sendpulse' | 'ahasend' | 'emailit' | 'getresponse' | 'loops' | 'zohomail' | 'acs'; 
  apiKey: string;
  apiUrl?: string; 
  ahaSendAccountId?: string; 
  defaultFrom?: string;
  defaultEvent?: string;
  status?: "unknown" | "checking" | "connected" | "failed";
  lastCheckResponse?: any;
  credentials?: {
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    subscriptionId?: string;
    resourceGroup?: string;
    emailServiceName?: string;
    domainName?: string;
    senderAddress?: string;
    smtpUsername?: string;
  };
}

type AccountData = Omit<Account, 'id' | 'status' | 'lastCheckResponse'>;

interface AccountContextType {
  accounts: Account[];
  activeAccount: Account | null;
  setActiveAccount: (account: Account | null) => void;
  fetchAccounts: () => Promise<void>;
  addAccount: (accountData: AccountData) => Promise<void>;
  updateAccount: (id: string, data: AccountData) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  checkAccountStatus: (account: Account) => Promise<Account>;
  campaigns: Map<string, CampaignState>; 
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccountState] = useState<Account | null>(null);
  const [campaigns, setCampaigns] = useState<Map<string, CampaignState>>(new Map());

  useEffect(() => {
    const unsubscribe = campaignManager.subscribe(setCampaigns);
    return () => unsubscribe();
  }, []);

  const setActiveAccount = (account: Account | null) => {
    setActiveAccountState(account);
    if (account) {
        localStorage.setItem('fusion_active_account_id', account.id);
    } else {
        localStorage.removeItem('fusion_active_account_id');
    }
  }

  const checkAccountStatus = useCallback(async (account: Account): Promise<Account> => {
    try {
        let endpoint = '';
        let body: any = {};

        if (account.provider === 'benchmark') {
            endpoint = '/api/benchmark/check-status';
            body = { apiKey: account.apiKey };
        } else if (account.provider === 'omnisend') {
            endpoint = '/api/omnisend/check-status';
            body = { apiKey: account.apiKey };
        } else if (account.provider === 'buttondown') {
            endpoint = '/api/buttondown/check-status';
            body = { apiKey: account.apiKey };
        } else if (account.provider === 'brevo') {
            endpoint = '/api/brevo/check-status';
            body = { apiKey: account.apiKey };
        } else if (account.provider === 'systemio') {
            endpoint = '/api/systemio/check-status';
            body = { apiKey: account.apiKey };
        } else if (account.provider === 'plunk') {
            endpoint = '/api/plunk/check-status'; 
            body = { secretKey: account.apiKey }; 
        } else if (account.provider === 'mailersend') {
            endpoint = '/api/mailersend/check-status';
            body = { apiKey: account.apiKey }; 
        } else if (account.provider === 'sendpulse') { 
            endpoint = '/api/sendpulse/check-status';
            body = { clientId: account.apiKey, secretId: account.apiUrl }; 
        } else if (account.provider === 'ahasend') { 
            endpoint = '/api/ahasend/check-status';
            body = { apiKey: account.apiKey }; 
        } else if (account.provider === 'emailit') {
            endpoint = '/api/emailit/check-status';
            body = { apiKey: account.apiKey }; 
        } else if (account.provider === 'getresponse') {
            endpoint = '/api/getresponse/check-status';
            body = { apiKey: account.apiKey }; 
        } else if (account.provider === 'loops') {
            endpoint = '/api/loops/check-status';
            body = { apiKey: account.apiKey }; 
        } else if (account.provider === 'zohomail') {
            endpoint = '/api/zohomail/check-status';
            body = { 
                apiKey: account.apiKey, 
                apiUrl: account.apiUrl, 
                defaultEvent: account.defaultEvent 
            }; 
        } else if (account.provider === 'acs') {
            endpoint = '/api/acs/check-status';
            body = {}; 
        } else {
            endpoint = '/api/activecampaign/check-status';
            body = { apiKey: account.apiKey, apiUrl: account.apiUrl };
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        
        // Pass the Entra ID Secret as a Bearer token so the backend can find the account
        if (account.provider === 'acs' && account.credentials) {
            headers['Authorization'] = `Bearer ${account.credentials.clientSecret || account.apiKey}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        const status: Account['status'] = response.ok && result.success !== false ? 'connected' : 'failed';
        return { ...account, status: status, lastCheckResponse: result.response || result };

    } catch (error) {
        return { ...account, status: 'failed', lastCheckResponse: { error: 'Network error' } };
    }
  }, []);
  
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts");
      const data: any[] = await response.json();
      
      const validAccounts: Account[] = data.map(acc => ({
          ...acc,
          provider: acc.provider || 'emailit',
          status: 'unknown'
      }));
      
      const accountsWithStatus = await Promise.all(validAccounts.map(acc => checkAccountStatus(acc)));
      setAccounts(accountsWithStatus);

      const savedId = localStorage.getItem('fusion_active_account_id');

      if (activeAccount) {
         const found = accountsWithStatus.find(a => a.id === activeAccount.id);
         if (found) setActiveAccountState(found);
      } else if (savedId) {
         const found = accountsWithStatus.find(a => a.id === savedId);
         if (found) {
             setActiveAccountState(found);
         } else if (accountsWithStatus.length > 0) {
             setActiveAccountState(accountsWithStatus[0]);
         }
      } else if (accountsWithStatus.length > 0) {
         setActiveAccountState(accountsWithStatus[0]);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  }, [activeAccount, checkAccountStatus]);

  useEffect(() => { fetchAccounts(); }, []);

  const addAccount = async (accountData: AccountData) => {
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountData),
    });
    await fetchAccounts();
  };

  const updateAccount = async (id: string, data: AccountData) => {
    await fetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await fetchAccounts();
  };
  
  const deleteAccount = async (id: string) => {
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if(activeAccount?.id === id) setActiveAccount(null); 
    await fetchAccounts();
  };
  
  const manualCheckAccountStatus = async (account: Account) => {
    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, status: 'checking' } : a));
    const updatedAccount = await checkAccountStatus(account);
    setAccounts(prev => prev.map(a => a.id === account.id ? updatedAccount : a));
    if (activeAccount?.id === account.id) setActiveAccountState(updatedAccount);
    return updatedAccount;
  }
  
  return (
    <AccountContext.Provider value={{ 
        accounts, 
        activeAccount, 
        setActiveAccount, 
        fetchAccounts, 
        addAccount, 
        updateAccount, 
        deleteAccount, 
        checkAccountStatus: manualCheckAccountStatus,
        campaigns 
    }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (context === undefined) throw new Error('useAccount must be used within an AccountProvider');
  return context;
};