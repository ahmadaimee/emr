'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { resolveTask, snoozeTask } from './actions';
import { Button, Code, Severity, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';

interface TaskRowProps {
  task: {
    id: string;
    title: string;
    subjectType: string;
    subjectId: string;
    status: string;
    priority: string;
    suggestedAction: string | null;
    suggestedActionPayload: any;
    dueAt: Date | string | null;
    createdAt: Date | string;
    patientName?: string | null;
    detail?: any;
  };
}

export function TaskRow({ task }: TaskRowProps) {
  const [pending, startTransition] = useTransition();

  const handleResolve = () => {
    startTransition(async () => {
      await resolveTask(task.id, 'one_click_fix');
    });
  };

  const handleSnooze = () => {
    startTransition(async () => {
      await snoozeTask(task.id, 3);
    });
  };

  const subjectLink =
    task.subjectType === 'claim'
      ? `/claims/${task.subjectId}`
      : task.subjectType === 'patient'
      ? `/patients/${task.subjectId}`
      : task.subjectType === 'remittance'
      ? `/remittances/${task.subjectId}`
      : '#';

  const priorityColor =
    task.priority === 'urgent'
      ? 'text-danger font-semibold'
      : task.priority === 'high'
      ? 'text-warn font-semibold'
      : 'text-ink-3';

  return (
    <tr className="hover:bg-surface-sunken/40">
      <td className="px-3 py-3 align-top">
        <span className={`text-xs uppercase ${priorityColor}`}>{task.priority}</span>
      </td>
      <td className="px-3 py-3">
        <div className="font-medium text-ink">
          <Link href={subjectLink} className="hover:underline">
            {task.title}
          </Link>
        </div>
        {task.patientName ? (
          <div className="mt-0.5 text-xs text-ink-3">Patient: {task.patientName}</div>
        ) : null}
        {task.suggestedAction ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-grove-strong bg-grove-soft/40 px-2 py-1 rounded">
            <span className="font-medium">Suggested fix:</span>
            <span>{task.suggestedAction}</span>
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top">
        <Link href={subjectLink} className="text-xs text-ink-2 hover:underline">
          <Code>{task.subjectType}</Code>
        </Link>
      </td>
      <td className="px-3 py-3 align-top">
        <StatusPill status={task.status} />
      </td>
      <td className="px-3 py-3 align-top text-xs text-ink-3">
        {task.dueAt ? (
          <span className={new Date(task.dueAt) < new Date() ? 'text-danger font-medium' : ''}>
            {relative(task.dueAt)}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-3 align-top text-right">
        <div className="flex items-center justify-end gap-1.5">
          {task.suggestedAction ? (
            <Button
              variant="primary"
              disabled={pending}
              onClick={handleResolve}
              className="h-7 px-2 text-xs"
            >
              Apply fix
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={handleResolve}
              className="h-7 px-2 text-xs"
            >
              Resolve
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={pending}
            onClick={handleSnooze}
            className="h-7 px-2 text-xs"
            title="Snooze 3 days"
          >
            Snooze
          </Button>
        </div>
      </td>
    </tr>
  );
}
