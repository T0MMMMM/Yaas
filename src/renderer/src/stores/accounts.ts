import { create } from 'zustand'
import type { Account } from '@shared/model'

interface AccountsState {
  /** null until loaded. */
  accounts: Account[] | null
  init: () => () => void
  importDefault: () => Promise<Account>
}

export const useAccounts = create<AccountsState>((set) => ({
  accounts: null,
  init: () => {
    void window.yaas.invoke('accounts.list').then((accounts) => set({ accounts }))
    return window.yaas.on('accounts.changed', (accounts) => set({ accounts }))
  },
  importDefault: () => window.yaas.invoke('accounts.importDefault'),
}))
