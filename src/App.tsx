import { useMemo, useState } from 'react';
import UploadPanel from './components/UploadPanel';
import FilterBar from './components/FilterBar';
import QueryBox from './components/QueryBox';
import Overview from './pages/Overview';
import AccountView from './pages/AccountView';
import InvestorView from './pages/InvestorView';
import { parseExcelFile } from './lib/parseExcel';
import { clearDataset, loadDataset, saveDataset } from './lib/storage';
import { listAccounts, resolveDateRange } from './lib/metrics';
import type { QueryContext } from './lib/query';
import { DATE_RANGE_PRESETS, type DateRangePreset, type ParsedDataset } from './lib/types';

type Tab = 'account' | 'overview' | 'investor';

export default function App() {
  const [dataset, setDataset] = useState<ParsedDataset | null>(() => loadDataset());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('account');
  const [preset, setPreset] = useState<DateRangePreset>('last12');
  const [manuallySelectedAccount, setManuallySelectedAccount] = useState<string | null>(null);

  const accounts = useMemo(() => (dataset ? listAccounts(dataset.rows) : []), [dataset]);

  const selectedAccount = useMemo(() => {
    if (accounts.length === 0) return null;
    if (manuallySelectedAccount && accounts.some((a) => a.name === manuallySelectedAccount)) {
      return manuallySelectedAccount;
    }
    const horizon = accounts.find((a) => a.name.toLowerCase() === 'horizon');
    return (horizon ?? accounts[0]).name;
  }, [accounts, manuallySelectedAccount]);

  const queryContext: QueryContext = useMemo(() => {
    const rows = dataset?.rows ?? [];
    const scopeAccount = tab === 'account' ? selectedAccount : null;
    const scopeRows = scopeAccount ? rows.filter((r) => r.account === scopeAccount) : rows;
    const presetLabel = (DATE_RANGE_PRESETS.find((p) => p.value === preset)?.label ?? 'current range').toLowerCase();
    return {
      allRows: rows,
      accounts,
      defaultAccount: scopeAccount,
      defaultRange: resolveDateRange(preset, scopeRows),
      defaultRangeLabel: presetLabel,
    };
  }, [dataset, tab, selectedAccount, preset, accounts]);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseExcelFile(file);
      setDataset(parsed);
      saveDataset(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse this file.');
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    clearDataset();
    setDataset(null);
    setManuallySelectedAccount(null);
  }

  if (!dataset) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 520, width: '100%' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Agave Health — Growth Dashboard</h1>
          <p style={{ fontSize: 14, color: '#52514e', marginBottom: 20 }}>
            Upload your appointments export to see clinic growth, sessions, and new-patient trends.
          </p>
          <UploadPanel onFile={handleFile} busy={busy} error={error} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px 24px 48px' }}>
      <header
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Agave Health — Growth Dashboard</h1>
          <p style={{ fontSize: 12.5, color: '#898781', marginTop: 2 }}>
            {dataset.rowCount.toLocaleString()} appointments loaded from {dataset.fileName}
            {dataset.skippedCount > 0 ? ` (${dataset.skippedCount} rows skipped — missing patient/date)` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {tab === 'investor' && (
            <button
              onClick={() => window.print()}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: '#fff',
                background: '#eb6834',
                border: 'none',
                borderRadius: 8,
                padding: '7px 12px',
                cursor: 'pointer',
              }}
            >
              Download as PDF
            </button>
          )}
          <label
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: '#2a78d6',
              cursor: busy ? 'default' : 'pointer',
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid rgba(42,120,214,0.35)',
            }}
          >
            {busy ? 'Uploading…' : 'Replace data'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={handleReset}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: '#898781',
              background: 'transparent',
              border: '1px solid rgba(11,11,11,0.15)',
              borderRadius: 8,
              padding: '7px 12px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </header>

      {error && (
        <p style={{ fontSize: 13, color: '#d03b3b', marginBottom: 16, fontWeight: 600 }}>{error}</p>
      )}

      <div className="no-print" style={{ marginBottom: 18 }}>
        <QueryBox context={queryContext} />
      </div>

      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <nav style={{ display: 'flex', gap: 4, background: '#f0efec', borderRadius: 10, padding: 3 }}>
          {(['account', 'investor', 'overview'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                background: tab === t ? '#fcfcfb' : 'transparent',
                color: tab === t ? '#0b0b0b' : '#52514e',
                boxShadow: tab === t ? '0 1px 2px rgba(11,11,11,0.10)' : 'none',
              }}
            >
              {t === 'overview' ? 'Clinic overview' : t === 'investor' ? 'Investor View' : (selectedAccount ?? 'Account')}
            </button>
          ))}
        </nav>

        <FilterBar
          preset={preset}
          onPresetChange={setPreset}
          accounts={tab === 'account' ? accounts : undefined}
          selectedAccount={tab === 'account' ? (selectedAccount ?? undefined) : undefined}
          onAccountChange={tab === 'account' ? setManuallySelectedAccount : undefined}
        />
      </div>

      {tab === 'overview' && <Overview rows={dataset.rows} preset={preset} />}
      {tab === 'account' &&
        (selectedAccount ? (
          <AccountView rows={dataset.rows} account={selectedAccount} preset={preset} />
        ) : (
          <p style={{ color: '#898781', fontSize: 14 }}>
            No accounts (insurance payers) found in this dataset yet.
          </p>
        ))}
      {tab === 'investor' &&
        (selectedAccount ? (
          <InvestorView rows={dataset.rows} account={selectedAccount} />
        ) : (
          <p style={{ color: '#898781', fontSize: 14 }}>
            No accounts (insurance payers) found in this dataset yet.
          </p>
        ))}
    </div>
  );
}
