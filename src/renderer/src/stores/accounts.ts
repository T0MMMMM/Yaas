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
    void window.acab.invoke('accounts.list').then((accounts) => set({ accounts }))
    return window.acab.on('accounts.changed', (accounts) => set({ accounts }))
  },
  importDefault: () => window.acab.invoke('accounts.importDefault'),
}))
