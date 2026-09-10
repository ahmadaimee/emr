'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-grove px-3 text-xs font-medium text-white hover:bg-grove-strong transition-colors shadow-xs"
    >
      <span>🖨️</span>
      <span>Print HCFA-1500 / Export PDF</span>
    </button>
  );
}
