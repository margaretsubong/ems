# Authentication deployment

Only authentication uses Supabase. Portal records and profile editors remain local mock UI.

## Project and migration

The configured project inspected on October 15, 2026 is `lotvipzkoiewofrrdomc`. It initially had zero Auth users and no public application tables. No Supabase MCP connection or SQL execution credential was available in this session.

1. Open this project's Supabase SQL Editor and run `supabase/migrations/202610150001_auth_only.sql` once. It creates only the authentication profile, persistent request limits, single-use credential flows, and their security functions. It backfills the two authorized users if already provisioned.
2. Run `node scripts/provision-auth.mjs`. This command is safe to repeat: it never changes existing users or passwords, never sends email, and refuses projects containing unexpected users. New users have no password and unverified email.
3. In Supabase Authentication settings, disable new user signups, anonymous sign-ins, and unused providers. Public email signup was enabled during inspection. The migration additionally blocks insertion of any email outside the two authorized identities, including direct Auth API calls.
4. Configure Supabase password requirements to match the application: minimum eight characters, uppercase, lowercase, number, and symbol. Set Email OTP Expiration to the desired short validity period, for example one hour. The app does not assume a fixed provider expiration.
5. Keep `NEXT_PUBLIC_APP_URL` set to the actual deployment origin. Local development currently uses `http://localhost:3000`; production must use HTTPS. Do not change Supabase project keys or create new credentials for this implementation.

`employee_profiles` has SELECT-only access for authenticated users through a self-only RLS policy. Browser roles cannot change username, identity, activation state, or authorization. The service-role key is used only on the server. Role and ID values come from a database constraint and server allowlist, never user metadata or client fields.

## Email and credential flows

The configured Brevo sender was found and active during inspection. Activation and reset template IDs were absent, so the application uses built-in professional HTML/text templates. Optional Brevo templates must use `{{params.ACTION_URL}}`; `ACTIVATION_URL`, `RESET_URL`, and `SUBJECT` are also supplied. Disable click tracking/link rewriting for credential emails to minimize token exposure.

Activation requests require the exact authorized employee-ID/email pair. The server generates a Supabase invite link for an unconfirmed user, or a magic link for an already verified user whose setup remains pending. Recovery uses a Supabase recovery token for an active user only. Tokens are delivered exclusively to the registered email through Brevo.

Email links carry their token hash in the URL fragment, so the initial request and HTTP referrer do not include it. Opening the link automatically verifies the token and navigates to the matching credentials form, without an extra confirmation click. A mounted-page promise prevents duplicate verification during React effect replay. Supabase verifies the expiring token once. The server then creates a separate 15-minute, single-use proof bound to the verified user, session, and credential operation. Credential forms cannot be reached with ID/email query parameters or a normal login session alone. The application home route opens Activate Account; existing users can use its Sign In link.

Submitting credentials consumes that proof atomically before changing the password. A provider/database failure after consumption requires a new email link. This favors replay resistance over silently retrying a credential write. Activation state is updated only after Supabase successfully saves the password. Successful setup/reset signs out all refresh-token sessions, clears local authentication cookies, and returns the user to Login. Previously issued access tokens expire according to the project's JWT settings.

Server Actions provide same-origin mutation handling. SSR cookies are HttpOnly, SameSite=Lax, and Secure in production. With Remember me unchecked they are session cookies; checked sessions have persistent Supabase cookies. Proxy refreshes sessions, and both proxy and server layouts enforce active status and the matching portal role. Protected responses are private/no-store.

Request limits are persistent and atomic: ten login attempts per account per 15 minutes, one activation/recovery email per minute and five per hour, and five verification attempts per token per 15 minutes. Recovery responses stay generic for unknown, inactive, throttled, and delivery-failed requests. Recovery email work runs through Next.js `after()` after the response, keeping provider and account lookup latency out of the public response. The deployment must support Next.js after-response work. Expired security records are pruned during subsequent calls.

## Verification after SQL is applied

- Run `npm run test:auth`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- Request activation for each authorized pair; confirm receipt in the actual inbox. Verify an incorrect pair is rejected and repeat requests are throttled.
- Open each link, verify it, choose username/password, and sign in. Confirm manager and employee redirects and cross-role route denial.
- Reopen consumed links, alter tokens, and test a provider-expired link. All must fail without granting credential access.
- Request recovery for an active account, an unknown email, and a pending account. Responses must not reveal account existence.
- Complete reset, verify the old password fails, and verify the new password signs in. Reusing the reset proof must fail.
- Sign out and verify that protected routes redirect to Login and session cookies are removed.
- With an authenticated public client, confirm own-profile SELECT succeeds, another user's SELECT returns no rows, and every profile INSERT/UPDATE/DELETE fails. Anonymous profile access must fail.

No password, token, activation email delivery, or inbox ownership is fabricated by the provisioning script. End-to-end completion requires the real recipients to choose credentials through their own email links.

## Rollback

Revert the authentication code and deployment together if needed. Retain the authentication tables and users; do not drop security functions while this implementation serves traffic. No destructive rollback or data reset is included. Removing the auth schema or accounts requires separate authorization.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase link generation](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [Brevo transactional email](https://developers.brevo.com/reference/send-transac-email).
