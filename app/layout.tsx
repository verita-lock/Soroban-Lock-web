import type { Metadata } from 'next'
import './globals.css'
import { WalletProvider } from '@/lib/WalletContext'
import { ToastProvider } from '@/lib/toast'
import ToastContainer from '@/components/ToastContainer'
import ErrorBoundary from '@/components/ErrorBoundary'
import { validateEnv } from '@/lib/env'

validateEnv()

export const metadata: Metadata = {
  title: 'Soroban Guard — Smart Contract Security Scanner',
  description:
    'Automated vulnerability detection for Soroban smart contracts. Scan your Rust/Soroban code for security issues before deployment.',
  keywords: ['soroban', 'smart contract', 'security', 'scanner', 'stellar', 'rust'],
  openGraph: {
    title: 'Soroban Guard',
    description: 'Automated vulnerability detection for Soroban smart contracts.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('sg_theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
        >
          Skip to main content
        </a>
        <ErrorBoundary>
          <WalletProvider>
            <ToastProvider>
              <main id="main-content" tabIndex={-1}>
                {children}
              </main>
              <ToastContainer />
            </ToastProvider>
          </WalletProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
