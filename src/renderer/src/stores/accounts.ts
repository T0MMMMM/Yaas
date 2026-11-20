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
    void window.bigBrowser.invoke('accounts.list').then((accounts) => set({ accounts }))
    return window.bigBrowser.on('accounts.changed', (accounts) => set({ accounts }))
  },
  importDefault: () => window.bigBrowser.invoke('accounts.importDefault'),
}))
