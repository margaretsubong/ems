# EMS Marga — Implementation Plan and Progress

This document records the work completed in this conversation and the verification still outstanding. It does not authorize additional features or backend integration.

## 1. Project Scope

- Continue the existing Next.js App Router, TypeScript, and Tailwind CSS application.
- Preserve the existing authentication design and follow the supplied Figma references for both portals.
- Implement Employee and Department Manager portals as frontend demonstrations with local mock data.
- Integrate Supabase and Brevo for authentication only.
- Support exactly two authorized application accounts, without public registration or an Admin role.

## 2. Authentication Screens

- [x] Preserve the existing authentication screen layouts.
- [x] Make `/` open `/activate-account` before Login.
- [x] Activate Account: validate the authorized employee-ID/email pair on the server and request an activation email.
- [x] Email verification: automatically verify the email link and redirect to the corresponding credentials form, without another confirmation button.
- [x] Prevent duplicate verification requests during React effect replay.
- [x] Set Up Account: require a verified activation flow before accepting username, password, and confirmation.
- [x] Activate the authentication profile only after Supabase successfully saves the password.
- [x] Login: validate credentials through Supabase and redirect to the appropriate role's dashboard.
- [x] Forgot Password: return generic responses and send recovery instructions through Brevo for eligible accounts.
- [x] Reset Password: require verified recovery proof, validate the new password, and return to Login after success.
- [x] Replace both portal logout links with real Supabase sign-out and local session-cookie cleanup.

Authentication routes: `/activate-account`, `/auth/confirm`, `/setup-account`, `/login`, `/forgot-password`, `/reset-password`.

## 3. Employee Portal

- [x] Shared sidebar, active navigation, top header, employee area, and responsive content layout.
- [x] `/employee/dashboard`: summary cards, task preview, attendance overview, announcements, and quick actions.
- [x] `/employee/attendance`: mock records, date/status/search filters, pagination, and CSV export.
- [x] `/employee/tasks`: task filters, details drawer, and temporary status/progress-note updates.
- [x] `/employee/announcements`: category/search/sort controls, expanded announcement dialogs, and local read state.
- [x] `/employee/leave`: request history, details, request form, date/balance/overlap validation, and local submission.
- [x] `/employee/profile`: personal information, temporary profile editing, and demonstration password-validation UI.

Each module has one main route. Details and mutations use dialogs or drawers. Portal records and changes remain local and reset on refresh.

## 4. Department Manager Portal

- [x] Shared Manager sidebar, role header, profile access, active navigation, and responsive layout.
- [x] `/manager/dashboard`: statistics, task preview, announcements, recent activity, pending approvals, and quick actions.
- [x] `/manager/employees`: Employees and Attendance tabs within the same module.
- [x] Employee directory: search, role/status filters, details dialog, pagination, and CSV export.
- [x] Department attendance: employee/date/status filters and attendance details.
- [x] `/manager/tasks`: assignment filters, task creation/editing, priority, deadline, status, progress, and notes.
- [x] Link employee details to tasks filtered by that employee.
- [x] `/manager/leave`: leave ledger, filters, request review, approval/rejection confirmation, and rejection feedback.
- [x] `/manager/announcements`: search, sorting, status filters, view/create/edit dialogs, categories, pinning, and draft/active/archived states.
- [x] `/manager/profile`: Manager and department information, temporary profile editing, and demonstration password-validation UI.

Task assignment, leave decisions, announcements, and portal profile edits remain frontend-only. None writes business records to Supabase.

## 5. Supabase Authentication

### Authorized Accounts

| Role | Employee ID | Email |
| --- | --- | --- |
| Department Manager (`department_manager`) | `MGR-001` | `margaretsubong92@gmail.com` |
| Employee (`employee`) | `EMP-4092` | `danicaacosta544@gmail.com` |

- [x] Inspect the project configured in the existing environment: `lotvipzkoiewofrrdomc`.
- [x] Inspect existing Auth users and public schema before provisioning; both initially contained no application records.
- [x] Provision exactly the two authorized accounts without passwords or pre-confirmed email ownership.
- [x] Add an idempotent provisioning script that preserves existing accounts and refuses unexpected users.
- [x] Prepare the authentication-only SQL migration.
- [x] User applies the migration through Supabase SQL Editor.
- [x] Verify both authentication profiles exist with their expected roles and pending status after migration.
- [x] Implement server-only privileged and SSR session clients using the existing environment variables.
- [x] Store identity, role, activation state, and username in `employee_profiles`.
- [x] Enable self-only SELECT through RLS; disallow application-user profile writes.
- [x] Restrict new Auth identities to the two authorized emails through a database trigger.
- [x] Implement persistent request throttling and atomic, single-use credential-flow consumption.
- [x] Bind credential proofs to user, session, purpose, and a 15-minute expiration.
- [x] Check active status and role in both Proxy and server layouts.
- [x] Redirect anonymous users to Login and cross-role users to their own dashboard.
- [x] Use HttpOnly session cookies, SameSite=Lax, production Secure flags, and Remember me behavior.
- [x] Mark protected responses private/no-store.
- [ ] Confirm Supabase's **Allow new users to sign up** setting has been disabled. It remained enabled at the last settings check.

Only `employee_profiles`, `auth_rate_limits`, and `auth_flows` were introduced by the authentication migration. No attendance, task, leave, or announcement tables were introduced.

## 6. Brevo and Email Verification

- [x] Use the existing server-side Brevo credentials and configured sender.
- [x] Verify the configured sender exists and is active.
- [x] Supply professional HTML/text fallback emails when optional template IDs are absent.
- [x] Generate Supabase invitation, activation-resumption, and recovery tokens for the appropriate account state.
- [x] Verify invitation-token generation for both provisioned accounts without printing or consuming those test tokens.
- [x] Deliver token hashes in URL fragments rather than request query strings.
- [x] Run password-recovery email work after the generic response using Next.js `after()`.
- [x] User reports receiving an activation email and opening its link.
- [x] Reproduce the verification failure caused by the local server's restricted network access.
- [x] Restart the local server with network access and confirm verification requests reach Supabase.
- [ ] Confirm successful email-link verification and completed account setup for each real recipient after the fix.
- [ ] Confirm live recovery-email delivery and password reset.

## 7. Validation Recorded

- [x] All six Employee routes returned HTTP 200 before authentication guards were added.
- [x] All six Manager routes returned HTTP 200 before authentication guards were added.
- [x] Authentication test suite: 17 tests pass, including policy, mocked server actions, role guards, automatic verification during effect replay, and the request-time boundary before Supabase session initialization.
- [x] TypeScript check passes.
- [x] ESLint completes with zero errors; four pre-existing unused-parameter warnings remain in `app/lib/mock-auth.ts`.
- [x] Production build passes with the current Next.js Cache Components configuration.
- [x] Add Suspense boundaries around request-time authentication checks to satisfy production prerendering requirements.
- [x] Fix the authenticated development-route `Date.now()` prerender error by awaiting `connection()` before creating the Supabase SSR client. Keep session-clock evaluation at request time without disabling Cache Components or weakening route protection.
- [x] Add responsive `sizes` hints to the authentication images to resolve the reported Next.js image warnings.
- [x] Verify all 12 portal routes and both credential-form routes reject anonymous access with the expected redirects.
- [x] Verify `/` redirects to `/activate-account` after the entry-screen change.
- [x] Verify a fabricated email token produces an invalid-link response rather than a service-unavailable response after the server connectivity fix.
- [x] Recheck 19 public/protected routes on each local server, ports 3000 and 3001. Public pages respond successfully; anonymous portal and credential-form requests redirect correctly.
- [x] Confirm the Employee authentication profile is active and the Manager profile remains pending during the system check. This verifies stored account status, not successful rendering of every authenticated screen.
- [x] Confirm anonymous authentication-profile reads are denied, the rate-limit RPC runs, and the credential-flow RPC rejects a nonexistent proof against the live database.
- [x] Scan generated client JavaScript and confirm the configured Supabase service-role and Brevo API keys are absent.
- [ ] Perform browser-based visual, responsive, keyboard, navigation, and dialog interaction checks. No browser automation surface was available during implementation.
- [ ] Complete both real activation/setup/login flows and verify their dashboard destinations.
- [ ] Verify live cross-role denial, invalid-password handling, duplicate activation, and provider-expired/reused links.
- [ ] Complete a real password reset, verify old/new password behavior, and confirm logout/session cleanup in the browser.
- [ ] Verify live RLS behavior with authenticated public clients for both users.

Passing mocked tests does not establish successful live account activation or email delivery for every flow. Those checks remain open until observed.

## 8. Files and Commands

| Area | Location |
| --- | --- |
| Authentication screens | `app/(auth)/` |
| Automatic email-link verification | `app/auth/confirm/page.tsx` |
| Authentication actions, policies, proofs, and email utility | `app/lib/auth/` |
| Supabase server clients | `app/lib/supabase/` |
| Route protection and session refresh | `proxy.ts` |
| Employee frontend | `app/employee/` |
| Manager frontend | `app/manager/` |
| Authentication migration | `supabase/migrations/202610150001_auth_only.sql` |
| Deployment and manual verification instructions | `supabase/AUTH_SETUP.md` |
| Account provisioning | `scripts/provision-auth.mjs` |
| Authentication regression tests | `tests/auth.test.mjs` |

Validation commands:

```text
npm run test:auth
npx tsc --noEmit
npm run lint
npm run build
```

Account provisioning, only when needed:

```text
npm run auth:provision
```

## 9. Preserved Restrictions

- Do not integrate portal business features with Supabase without a separate request.
- Do not add application users, an Admin role, public registration, or account-creation interfaces.
- Do not redesign existing screens as part of authentication work.
- Do not overwrite `.env.local` or put actual passwords, tokens, or service keys in source code.
- Do not reset the database, disable RLS, or delete accounts as an implicit cleanup step.
- Do not change Git identity or run `git add`, `git commit`, or `git push` without authorization.
- Require separate authorization for destructive changes or new credentials.
