'use client';

import { useState, useTransition } from 'react';
import { addClaimNoteAction } from '../actions';

export interface ClaimNoteItem {
  id: string;
  category: string;
  author: string;
  authorRole?: string;
  content: string;
  createdAt: string | Date;
}

const NOTE_CATEGORIES = [
  { id: 'Claim Note', label: 'Claim Note' },
  { id: 'Summary Note', label: 'Summary Note (Clinical / Encounter)' },
  { id: 'Billing Follow-up', label: 'Billing / Payer Follow-up' },
  { id: 'Denial Follow-up', label: 'Denial / Appeal Documentation' },
  { id: 'Internal Memo', label: 'Internal Audit Memo' },
];

export function ClaimNotesCard({
  claimId,
  initialNotes = [],
}: {
  claimId: string;
  initialNotes: ClaimNoteItem[];
}) {
  const [notes, setNotes] = useState<ClaimNoteItem[]>(initialNotes);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [category, setCategory] = useState<string>('Claim Note');
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();

  const filteredNotes = activeCategory === 'all'
    ? notes
    : notes.filter((n) => n.category.toLowerCase().includes(activeCategory.toLowerCase()));

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const optimisticNote: ClaimNoteItem = {
      id: `cn-${Date.now()}`,
      category,
      author: 'Current User',
      authorRole: 'Operator',
      content: content.trim(),
      createdAt: new Date(),
    };

    setNotes((prev) => [optimisticNote, ...prev]);
    const noteText = content.trim();
    setContent('');
    setIsAdding(false);

    startTransition(async () => {
      try {
        await addClaimNoteAction(claimId, { category, content: noteText });
      } catch {}
    });
  };

  return (
    <div className="rounded-lg border border-line bg-surface-raised shadow-xs">
      {/* Header with Title & Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3 sm:px-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-ink">Claim Notes &amp; Summary Notes</h3>
          <span className="rounded-full bg-surface-sunken border border-line px-2 py-0.2 text-[10px] font-mono text-ink-3">
            {notes.length} note{notes.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-grove px-2.5 text-xs font-semibold text-white hover:bg-grove-strong transition-colors"
            >
              <span>+</span>
              <span>Add Note</span>
            </button>
          )}
        </div>
      </div>

      {/* Note Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-surface/50 px-4 py-2 text-xs">
        <span className="text-ink-4 mr-1 text-[11px]">Filter notes:</span>
        {[
          { id: 'all', label: `All (${notes.length})` },
          { id: 'claim', label: 'Claim Notes' },
          { id: 'summary', label: 'Summary Notes' },
          { id: 'follow-up', label: 'Billing / Follow-up' },
          { id: 'denial', label: 'Denials / Appeals' },
        ].map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setActiveCategory(pill.id)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              activeCategory === pill.id
                ? 'bg-grove text-white font-semibold shadow-xs'
                : 'bg-surface border border-line text-ink-3 hover:text-ink'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Inline New Note Composer */}
      {isAdding && (
        <form onSubmit={handleSaveNote} className="border-b border-line bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink">New Claim Documentation Note</span>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-ink-4 hover:text-ink text-xs"
            >
              Cancel ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase text-ink-3 mb-1">
                Note Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-8 w-full rounded-md border border-line-strong bg-surface-raised px-2 text-xs font-medium text-ink"
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase text-ink-3 mb-1">
              Note Text / Documentation
            </label>
            <textarea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Record follow-up with payer, conversation with provider, clinical summary, or appeal rationale..."
              autoFocus
              className="w-full rounded-md border border-line-strong bg-surface-raised p-2.5 text-xs text-ink placeholder:text-ink-4 focus:border-grove"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="h-7 px-3 rounded-md border border-line text-xs font-medium text-ink-2 hover:bg-surface-sunken"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !content.trim()}
              className="h-7 px-4 rounded-md bg-grove text-white text-xs font-semibold hover:bg-grove-strong disabled:opacity-50 transition-colors shadow-xs"
            >
              {isPending ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      )}

      {/* Notes List Timeline */}
      <div className="divide-y divide-line max-h-96 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-3">
            No notes found for this category. Click &quot;Add Note&quot; to create a new claim note.
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isSummary = note.category.toLowerCase().includes('summary');
            const isDenial = note.category.toLowerCase().includes('denial') || note.category.toLowerCase().includes('appeal');
            const dateStr =
              typeof note.createdAt === 'string'
                ? new Date(note.createdAt).toLocaleString()
                : note.createdAt.toLocaleString();

            return (
              <div key={note.id} className="p-3.5 sm:px-4 hover:bg-surface-sunken/40 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase ${
                        isSummary
                          ? 'bg-info-soft text-info'
                          : isDenial
                          ? 'bg-danger-soft text-danger'
                          : 'bg-grove-soft text-grove-strong'
                      }`}
                    >
                      {note.category}
                    </span>
                    <span className="font-semibold text-xs text-ink">
                      {note.author}
                    </span>
                    {note.authorRole ? (
                      <span className="text-[10px] text-ink-4">
                        · {note.authorRole}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] text-ink-4 font-mono">
                    {dateStr}
                  </span>
                </div>
                <p className="text-xs text-ink-2 leading-relaxed whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

