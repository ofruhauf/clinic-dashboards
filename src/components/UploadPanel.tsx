import { useCallback, useRef, useState } from 'react';

interface UploadPanelProps {
  onFile: (file: File) => void;
  busy: boolean;
  error: string | null;
  compact?: boolean;
}

export default function UploadPanel({ onFile, busy, error, compact }: UploadPanelProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile]
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
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p style={{ fontSize: compact ? 15 : 18, fontWeight: 600, color: '#0b0b0b' }}>
        {busy ? 'Parsing spreadsheet…' : 'Drop your data export here, or click to choose a file'}
      </p>
      <p style={{ fontSize: 13, color: '#898781', marginTop: 6 }}>
        .xlsx or .csv with columns like user, title, therapist, insurance, scheduledFor, showUp, reported
      </p>
      {error && (
        <p style={{ fontSize: 13, color: '#d03b3b', marginTop: 12, fontWeight: 600 }}>{error}</p>
      )}
    </div>
  );
}
