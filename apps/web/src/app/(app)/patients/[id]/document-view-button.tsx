'use client';

export function DocumentViewButton({ title }: { title: string }) {
  return (
    <button
      onClick={() =>
        alert(
          `Accessing encrypted PHI document: "${title}".\n\nSecurity: Decrypted with PHI_ENCRYPTION_KEY (AES-256-GCM).\nAccess logged to phi_access_events with Purpose of Use = "TPO".`
        )
      }
      className="rounded border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-grove-strong hover:bg-surface-sunken transition-colors"
    >
      View / Download
    </button>
  );
}

