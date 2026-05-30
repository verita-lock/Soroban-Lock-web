'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import ScanInput from '@/components/ScanInput'
import ErrorBoundary from '@/components/ErrorBoundary'
import WalletConnect from '@/components/WalletConnect'
import NetworkBadge from '@/components/NetworkBadge'
import NetworkHealthBanner from '@/components/NetworkHealthBanner'
import ThemeToggle from '@/components/ThemeToggle'
import { scanContract } from '@/lib/api'
import { checkNetworkHealth } from '@/lib/stellar'
import { getScanHistory } from '@/lib/history'
import { encodeFindings } from '@/lib/share'
import { useWallet } from '@/lib/WalletContext'
import type { ContractScanRecord } from '@/types/stellar'
import { NETWORKS } from '@/types/stellar'

export default function HomePage() {
  const router = useRouter()
  const { publicKey: walletKey, network: walletNetwork } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [networkHealthy, setNetworkHealthy] = useState(true)
  const [statusMessage, setStatusMessage] = useState('')
  const [scanHistory, setScanHistory] = useState<ContractScanRecord[]>([])

  useEffect(() => {
    if (!walletKey) return
    setScanHistory(getScanHistory(walletKey))
    checkNetworkHealth(walletNetwork).then(healthy => {
      setNetworkHealthy(healthy)
    })
  }, [walletKey, walletNetwork])

  async function handleScan(source: string) {
    setLoading(true)
    setError(null)
    setStatusMessage('Scanning your contract…')
    try {
      const data = await scanContract(source)
      setStatusMessage(`Scan complete. ${data.findings.length} finding${data.findings.length !== 1 ? 's' : ''} detected.`)
      // Store results in sessionStorage so the results page can read them
      sessionStorage.setItem('sg_findings', JSON.stringify(data.findings))
      const encoded = encodeFindings(data.findings)
      router.push(`/results?r=${encoded}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error'
      setError(msg)
      setStatusMessage('')
    } finally {
      setLoading(false)
    }
  }

  async function handleHistoryClick(contractId: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await scanContract(contractId)
      sessionStorage.setItem('sg_findings', JSON.stringify(data.findings))
      router.push('/results')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Aria-live region for screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      {/* Network health banner */}
      {walletKey && !networkHealthy && (
        <NetworkHealthBanner
          network={walletNetwork.name}
          onDismiss={() => setNetworkHealthy(true)}
        />
      )}

      {/* Nav */}
      <header className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Veritas-Vaults-Network"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 ring-1 ring-[var(--border)] transition hover:text-white"
            >
              <GithubIcon />
              Veritas Vaults Network
            </a>
            <ThemeToggle />
            <WalletConnect />
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 pb-12 pt-20 text-center sm:px-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            Soroban Smart Contract Security
          </div>
          {walletKey && (
            <div className="mb-3 flex flex-col items-center gap-3">
              <NetworkBadge network={walletNetwork} />
              {walletNetwork.name === 'futurenet' && (
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm text-violet-300">
                  <p className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>You are connected to Futurenet. This network is experimental and contract data may be incomplete.</span>
                  </p>
                </div>
              )}
            </div>
          )}          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Find vulnerabilities{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              before attackers do
            </span>
          </h1>
          <p className="mb-10 text-lg text-slate-400">
            Soroban Guard statically analyzes your Rust/Soroban contracts for
            common security pitfalls — integer overflows, unchecked auth, reentrancy
            risks, and more.
          </p>

          {/* Scan card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 text-left shadow-2xl">
            <ErrorBoundary>
              <ScanInput onScan={handleScan} loading={loading} />
            </ErrorBoundary>

            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Recent scans */}
          {walletKey && scanHistory.length > 0 && (
            <div className="mt-8 rounded-2xl border border-[#2a2d3a] bg-[#1a1d27] p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Your recent scans</h3>
              <div className="space-y-2">
                {scanHistory.slice(0, 5).map((record, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleHistoryClick(record.contractId)}
                    disabled={loading}
                    className="w-full rounded-lg border border-[#2a2d3a] bg-[#12151f] p-3 text-left transition hover:border-indigo-500/40 hover:bg-[#1a1d27] disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm text-slate-300">
                          {record.contractId.slice(0, 12)}...{record.contractId.slice(-8)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(record.scannedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <NetworkBadge network={NETWORKS[record.network]} />
                        <div className="flex gap-1">
                          {record.highCount > 0 && (
                            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                              {record.highCount}H
                            </span>
                          )}
                          {record.mediumCount > 0 && (
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                              {record.mediumCount}M
                            </span>
                          )}
                          {record.lowCount > 0 && (
                            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-400">
                              {record.lowCount}L
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="border-t border-[var(--border)] bg-[var(--bg-tertiary)] py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="mb-10 text-center text-2xl font-bold text-white">
              How it works
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <Step
                number="01"
                title="Submit your contract"
                description="Paste your Soroban contract source code or provide a public GitHub repository URL."
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />
              <Step
                number="02"
                title="Static analysis runs"
                description="Soroban Guard Core (Rust/Axum) parses your AST and runs a suite of security checks against known vulnerability patterns."
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
              <Step
                number="03"
                title="Review findings"
                description="Get a prioritized list of findings with severity ratings, affected functions, line numbers, and remediation guidance."
                icon={
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                }
              />
            </div>
          </div>
        </section>

        {/* Sister repos */}
        <section className="py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h2 className="mb-8 text-center text-xl font-semibold text-slate-300">
              Part of the Veritas Vaults Network ecosystem
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <RepoCard
                name="soroban-guard-web"
                description="This dashboard — the frontend for scanning and reviewing findings."
                href="https://github.com/Veritas-Vaults-Network/soroban-guard-web"
                active
              />
              <RepoCard
                name="soroban-guard-core"
                description="Rust/Axum REST API that performs the static analysis."
                href="https://github.com/Veritas-Vaults-Network/soroban-guard-core"
              />
              <RepoCard
                name="soroban-guard-contracts"
                description="Example Soroban contracts used for testing the scanner."
                href="https://github.com/Veritas-Vaults-Network/soroban-guard-contracts"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-8 text-center text-sm text-slate-600">
        <p>
          Built by{' '}
          <a
            href="https://github.com/Veritas-Vaults-Network"
            className="text-slate-500 hover:text-slate-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Veritas Vaults Network
          </a>{' '}
          · Open source · MIT License
        </p>
      </footer>
    </div>
  )
}

/* ── Sub-components ── */

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>
      <span className="font-bold text-white">Soroban Guard</span>
    </div>
  )
}

function GithubIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

function Step({
  number,
  title,
  description,
  icon,
}: {
  number: string
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
          {icon}
        </div>
        <span className="font-mono text-xs font-bold text-slate-600">{number}</span>
      </div>
      <h3 className="mb-2 font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  )
}

function RepoCard({
  name,
  description,
  href,
  active,
}: {
  name: string
  description: string
  href: string
  active?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-xl border p-5 transition hover:border-indigo-500/40 hover:bg-[var(--bg-secondary)] ${
        active
          ? 'border-indigo-500/40 bg-indigo-500/5'
          : 'border-[var(--border)] bg-[var(--bg-tertiary)]'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <GithubIcon />
        <span className="font-mono text-sm font-semibold text-slate-200 group-hover:text-white">
          {name}
        </span>
        {active && (
          <span className="ml-auto rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-400">
            you are here
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">{description}</p>
    </a>
  )
}
