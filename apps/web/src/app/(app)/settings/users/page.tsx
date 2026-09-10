import { desc, eq, schema, sql } from '@grove/db';
import { Card, Code, Empty, PageHeader, StatusPill } from '@/components/ui';
import { date, relative } from '@/lib/format';
import { pageContext } from '@/lib/session';

export const metadata = { title: 'Users & Access Control' };

export default async function UsersSettingsPage() {
  const { run } = await pageContext();

  const userList = await run('/settings/users', async (ctx) => {
    return ctx.tx
      .select({
        u: schema.users,
        roles: sql<string[]>`array(
          select r.name from user_roles ur
          inner join roles r on r.id = ur.role_id
          where ur.user_id = users.id
        )`,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt));
  });

  return (
    <>
      <PageHeader
        title="Users & Access Management"
        subtitle="Role-Based Access Control (RBAC), minimum-necessary practice scoping, and enforced multi-factor authentication (MFA)."
      />

      <Card title={`Practice Staff & Operators (${userList.length})`}>
        {userList.length === 0 ? (
          <Empty title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-sunken/40 text-xs font-medium text-ink-3">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role(s)</th>
                  <th className="px-3 py-2">MFA Status</th>
                  <th className="px-3 py-2">Account Status</th>
                  <th className="px-3 py-2">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {userList.map(({ u, roles }) => (
                  <tr key={u.id} className="hover:bg-surface-sunken/40">
                    <td className="px-3 py-2.5 font-medium text-ink">
                      {u.lastName}, {u.firstName}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-2">{u.email}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {roles.map((r) => (
                            <span
                              key={r}
                              className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-2"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-4">No role assigned</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {u.mfaEnrolledAt ? (
                        <span className="inline-flex items-center gap-1 font-medium text-ok">
                          <span>✓</span> Enrolled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-warn">
                          <span>!</span> Pending Enrolment
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={u.status} />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-3">
                      {relative(u.lastLoginAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
