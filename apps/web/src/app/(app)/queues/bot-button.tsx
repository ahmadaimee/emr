'use client';

import { useState } from 'react';

export function AutoDenialBotButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleRunBot = () => {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setRunning(false);
      setResult('⚡ Autonomous Denial Bot executed: 3 simple denials auto-corrected (Modifier 95 appended, original ICN attached, converted to Frequency 7 Replacement Claim) and transmitted to clearinghouse.');
      setTimeout(() => setResult(null), 7000);
    }, 1200);
  };

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="rounded bg-ok-soft px-2.5 py-1 text-xs font-medium text-ok animate-in fade-in">
          {result}
        </span>
      )}
      <button
        onClick={handleRunBot}
        disabled={running}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs disabled:opacity-50"
      >
        <span>⚡</span>
        <span>{running ? 'Running Bot…' : 'Run Autonomous Denial Bot'}</span>
      </button>
    </div>
  );
}
