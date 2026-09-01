import { useCallback, useRef, useState } from 'react';

interface UploadPanelProps {
  onFiles: (files: File[]) => void;
  busy: boolean;
  error: string | null;
  compact?: boolean;
}

export default function UploadPanel({ onFiles, busy, error, compact }: UploadPanelProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const list = Array.from(files ?? []);
      if (list.length > 0) onFiles(list);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      style={{
        border: `2px dashed ${dragging ? '#2a78d6' : '#c3c2b7'}`,
        borderRadius: 12,
        background: dragging ? '#eef4fc' : '#fcfcfb',
        padding: compact ? '20px 24px' : '56px 32px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <p style={{ fontSize: compact ? 15 : 18, fontWeight: 600, color: '#0b0b0b' }}>
        {busy ? 'Parsing claims…' : 'Drop your weekly claims reports here, or click to choose files'}
      </p>
      <p style={{ fontSize: 13, color: '#898781', marginTop: 6 }}>
        .csv or .xlsx claims exports, a registered-users export, or a .json snapshot shared by a colleague — select
        or drop as many files at once as you like
      </p>
      {error && (
        <p style={{ fontSize: 13, color: '#d03b3b', marginTop: 12, fontWeight: 600 }}>{error}</p>
      )}
    </div>
  );
}
