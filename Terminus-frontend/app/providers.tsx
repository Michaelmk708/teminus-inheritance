'use client';

import type { ReactNode } from 'react';
import AppWalletProvider from './providers/AppWalletProvider';

export function Providers({ children }: { children: ReactNode }) {
  return <AppWalletProvider>{children}</AppWalletProvider>;
}