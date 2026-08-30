import { useState } from 'react';
import SimpleBarChart from './charts/SimpleBarChart';
import { answerQuery, EXAMPLE_QUERIES, type QueryAnswer, type QueryContext } from '../lib/query';

interface QueryBoxProps {
  context: QueryContext;
}

export default function QueryBox({ context }: QueryBoxProps) {
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState<QueryAnswer | null>(null);

  function run(question: string) {
    if (!question.trim()) return;
    setAnswer(answerQuery(question, context));
  }

  return (
    <div
      style={{
        background: '#fcfcfb',
        border: '1px solid rgba(11,11,11,0.10)',
        borderRadius: 12,
        padding: '16px 20px',
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ask about your data — e.g. "what is last 3 months MoM growth?"'
          style={{
            flex: 1,
            fontSize: 13.5,
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid rgba(11,11,11,0.15)',
            background: '#fcfcfb',
            color: '#0b0b0b',
          }}
        />
        <button
          type="submit"
          style={{
            fontSize: 13,
            fontWeight: 600,
            padding: '9px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#2a78d6',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Ask
        </button>
      </form>

      {!answer && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => {
                setInput(q);
                run(q);
              }}
              style={{
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 999,
                border: '1px solid rgba(11,11,11,0.12)',
                background: '#f0efec',
                color: '#52514e',
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {answer && (
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(11,11,11,0.08)', paddingTop: 14 }}>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: '#898781', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {answer.scopeLabel}
          </p>
          <p style={{ fontSize: 24, fontWeight: 700, color: '#0b0b0b', marginTop: 4 }}>{answer.headline}</p>
          {answer.detail && (
            <p style={{ fontSize: 12.5, color: '#52514e', marginTop: 4 }}>{answer.detail}</p>
          )}
          {answer.chart && (
            <div style={{ height: 160, marginTop: 12 }}>
              <SimpleBarChart
                data={answer.chart.points}
                xKey="label"
                yKey="value"
                color={answer.chart.color}
                valueFormatter={answer.chart.formatValue}
                tickFormatter={answer.chart.tickFormatter}
              />
            </div>
          )}
          <button
            onClick={() => {
              setAnswer(null);
              setInput('');
            }}
            style={{
              fontSize: 12,
              color: '#2a78d6',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginTop: 10,
              padding: 0,
            }}
          >
            Ask another question
          </button>
        </div>
      )}
    </div>
  );
}
