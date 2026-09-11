'use client';

import { useState } from 'react';
import { getDocumentDownloadUrlAction } from '../actions';

export function DocumentViewButton({ documentId, title }: { documentId: string; title: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await getDocumentDownloadUrlAction(documentId);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`View or download ${title}`}
        className="rounded border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-grove-strong hover:bg-surface-sunken transition-colors disabled:opacity-60"
      >
        {loading ? 'Loading…' : 'View / Download'}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </span>
  );
}
