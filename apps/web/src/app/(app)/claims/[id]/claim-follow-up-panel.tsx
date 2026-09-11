'use client';

import { useState, useTransition } from 'react';
import { Card, selectCls, inputCls } from '@/components/ui';
import { relative } from '@/lib/format';
import { createClaimFollowUpAction, updateClaimFollowUpAction } from './follow-up-actions';

interface FollowUpTask {
  id: string;
  queueName: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  priority: string;
  status: string;
  dueAt: string | Date | null;
  suggestedAction: string | null;
  resolutionNote: string | null;
  createdAt: string | Date;
}

interface OrgUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface WorkQueue {
  key: string;
  name: string;
}

export function ClaimFollowUpPanel({ claimId, task, users, queues }: { claimId: string; task: FollowUpTask | null; users: OrgUser[]; queues: WorkQueue[] }) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState(task?.resolutionNote ?? '');
  const [newQueueKey, setNewQueueKey] = useState(queues[0]?.key ?? '');

  if (!task) {
    return (
      <Card title="Follow-up">
        <div className="p-3.5 space-y-2.5 text-xs">
          <p className="text-ink-3">No follow-up task on this claim yet.</p>
          {queues.length > 0 && (
            <>
              <select value={newQueueKey} onChange={(e) => setNewQueueKey(e.target.value)} className={selectCls}>
                {queues.map((q) => (
                  <option key={q.key} value={q.key}>{q.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={isPending || !newQueueKey}
                onClick={() => startTransition(() => createClaimFollowUpAction(claimId, { queueKey: newQueueKey }))}
                className="w-full h-8 rounded-md bg-grove text-white text-xs font-medium hover:bg-grove-strong transition-colors disabled:opacity-50"
              >
                Create Follow-up Task
              </button>
            </>
          )}
        </div>
      </Card>
    );
  }

  const update = (updates: Parameters<typeof updateClaimFollowUpAction>[2]) =>
    startTransition(() => updateClaimFollowUpAction(claimId, task.id, updates));

  return (
    <Card title="Follow-up">
      <div className="p-3.5 space-y-3 text-xs">
        {task.queueName && (
          <div>
            <span className="text-[10px] uppercase text-ink-4 block">Queue</span>
            <span className="font-medium text-ink">{task.queueName}</span>
          </div>
        )}

        <div>
          <span className="text-[10px] uppercase text-ink-4 block mb-0.5">Assigned To</span>
          <select
            defaultValue={task.assignedTo ?? ''}
            disabled={isPending}
            onChange={(e) => update({ assignedTo: e.target.value || null })}
            className={selectCls}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] uppercase text-ink-4 block mb-0.5">Priority</span>
            <select defaultValue={task.priority} disabled={isPending} onChange={(e) => update({ priority: e.target.value as any })} className={selectCls}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <span className="text-[10px] uppercase text-ink-4 block mb-0.5">Status</span>
            <select defaultValue={task.status} disabled={isPending} onChange={(e) => update({ status: e.target.value as any })} className={selectCls}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="waiting">Waiting</option>
              <option value="snoozed">Snoozed</option>
              <option value="resolved">Resolved</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase text-ink-4 block mb-0.5">Due Date</span>
          <input
            type="date"
            defaultValue={task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ''}
            disabled={isPending}
            onChange={(e) => update({ dueAt: e.target.value || null })}
            className={inputCls}
          />
        </div>

        {task.suggestedAction && (
          <div className="rounded bg-grove-soft/40 px-2 py-1.5 text-grove-strong">
            <span className="font-medium">Automation suggests:</span> {task.suggestedAction.replace(/_/g, ' ')}
          </div>
        )}

        <div>
          <span className="text-[10px] uppercase text-ink-4 block mb-0.5">Notes</span>
          <textarea
            value={note}
            disabled={isPending}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if (note !== (task.resolutionNote ?? '')) update({ resolutionNote: note }); }}
            rows={3}
            className="w-full rounded-md border border-line-strong bg-surface-raised px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-4 focus:border-grove resize-none"
            placeholder="Add a follow-up note…"
          />
        </div>

        <div className="text-ink-4 text-[11px]">
          Created {relative(task.createdAt)}{task.assigneeName ? ` · Assigned to ${task.assigneeName}` : ''}
        </div>
      </div>
    </Card>
  );
}
