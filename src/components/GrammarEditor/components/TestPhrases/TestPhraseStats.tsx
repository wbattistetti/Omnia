// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

interface TestPhraseStatsProps {
  stats: {
    total: number;
    matched: number;
    noMatch: number;
    ambiguous: number;
  };
}

export function TestPhraseStats({ stats }: TestPhraseStatsProps) {
  return (
    <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
      <span>All ({stats.total})</span>
      {stats.matched > 0 && (
        <span style={{ color: '#10b981' }}>
          All Winner (local) #{stats.matched}
        </span>
      )}
      {stats.ambiguous > 0 && (
        <span style={{ color: '#f59e0b' }}>
          Ambiguous #{stats.ambiguous}
        </span>
      )}
      {stats.noMatch > 0 && (
        <span style={{ color: '#ef4444' }}>
          No Match (local) #{stats.noMatch}
        </span>
      )}
    </div>
  );
}
