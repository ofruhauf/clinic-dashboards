import { useState } from 'react';
import UploadPanel from './components/UploadPanel';
import FilterBar from './components/FilterBar';
import HorizonView from './pages/HorizonView';
import InvestorView from './pages/InvestorView';
import { looksLikeHorizonFile, parseHorizonFile } from './lib/parseHorizonFile';
import { downloadSnapshot, isSnapshotFile, parseSnapshotFile } from './lib/snapshot';
import { clearDataset, loadDataset, saveDataset } from './lib/storage';
import { DATE_RANGE_PRESETS, type DateRangePreset, type HorizonDataset } from './lib/types';

type Tab = 'horizon' | 'investor';

export default function App() {
  const [dataset, setDataset] = useState<HorizonDataset | null>(() => loadDataset());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('horizon');
  const [preset, setPreset] = useState<DateRangePreset>('last12');

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);

    let next: HorizonDataset | null = null;
    const failures: string[] = [];
    for (const file of files) {
      try {
        let parsed: { users: HorizonDataset['users']; months: string[]; skippedCount: number };
        if (isSnapshotFile(file)) {
          parsed = await parseSnapshotFile(file);
        } else if (await looksLikeHorizonFile(file)) {
          parsed = await parseHorizonFile(file);
        } else {
          throw new Error('Not a recognized file — expected the Horizon tracking workbook or a snapshot (.json).');
        }
        // Each valid upload REPLACES the whole dataset — this workbook is a
        // fresh full export every time, not something to merge row-by-row.
        next = {
          users: parsed.users,
          months: parsed.months,
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          rowCount: parsed.users.length,
          skippedCount: parsed.skippedCount,
        };
      } catch (e) {
        failures.push(`${file.name}: ${e instanceof Error ? e.message : 'could not parse'}`);
      }
    }

    if (next) {
      setDataset(next);
      saveDataset(next);
    }
    if (failures.length > 0) {
      setError(failures.join('  ·  '));
    }
    setBusy(false);
  }

  function handleReset() {
    clearDataset();
    setDataset(null);
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
            Upload the Horizon tracking workbook (the "Users Tracking" tab is read automatically) to see
            registration, session, and revenue trends. A snapshot file (.json) shared by a colleague works too —
            drop it in to load the same dashboard without re-uploading the workbook.
          </p>
          <UploadPanel onFiles={handleFiles} busy={busy} error={error} />
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
            {dataset.rowCount.toLocaleString()} users loaded from {dataset.fileName}
            {dataset.skippedCount > 0 ? ` · ${dataset.skippedCount} row${dataset.skippedCount === 1 ? '' : 's'} skipped` : ''}
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
          <button
            onClick={() => downloadSnapshot(dataset)}
            title="Downloads a .json file with everything currently loaded — send it to a colleague and have them drop it into their own Upload files panel to see the same dashboard."
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: '#52514e',
              background: 'transparent',
              border: '1px solid rgba(11,11,11,0.15)',
              borderRadius: 8,
              padding: '7px 12px',
              cursor: 'pointer',
            }}
          >
            Share with someone
          </button>
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
            {busy ? 'Uploading…' : 'Upload files'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              multiple
              style={{ display: 'none' }}
              disabled={busy}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) handleFiles(files);
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
          {(['horizon', 'investor'] as Tab[]).map((t) => (
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
              {t === 'investor' ? 'Investor View' : 'Horizon'}
            </button>
          ))}
        </nav>

        {tab === 'horizon' && (
          <FilterBar
            preset={preset}
            onPresetChange={setPreset}
          />
        )}
      </div>

      {tab === 'horizon' && <HorizonView dataset={dataset} preset={preset} />}
      {tab === 'investor' && <InvestorView dataset={dataset} />}

      {!DATE_RANGE_PRESETS.length && null /* keep import used if list ever becomes conditional */}
    </div>
  );
}
