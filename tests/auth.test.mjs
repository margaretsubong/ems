import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "../app/lib/auth/policy.ts";

function loadModule(path, imports, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exported = {};
  const run = vm.runInNewContext(`(function(require,exports){${compiled}\n})`, { URL, URLSearchParams, console: { error() {} }, process, Date, ...globals });
  run((name) => { if (name === "server-only") return {}; if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`); return imports[name]; }, exported);
  return exported;
}

function harness(role = "employee", status = "active") {
  const account = policy.authorizedAccounts.find((entry) => entry.role === role);
  const profile = { id: "test-user", employee_id: account.employeeId, email: account.email, username: "test.user", role, account_status: status, activated_at: status === "active" ? "2026-10-15T00:00:00Z" : null };
  const user = { id: profile.id, email: account.email, email_confirmed_at: status === "active" ? "2026-10-15T00:00:00Z" : undefined };
  const state = { profile, user, rateAllowed: true, credentialsValid: true, tokenValid: true, hasProof: false, emailCount: 0, passwordWrites: 0, cookieClears: 0, issuedPurpose: null, providerFails: false, updates: [], jobs: [] };
  const store = { set() {}, delete() {} };
  const table = () => {
    let update;
    const query = { select() { return query; }, eq() { return query; }, delete() { return query; }, update(value) { update = value; return query; }, async maybeSingle() { if (update) { Object.assign(profile, update); state.updates.push(update); } return { data: profile, error: null }; } };
    return query;
  };
  const client = {
    from: table,
    auth: {
      async getUser() { return { data: { user }, error: null }; },
      async signInWithPassword() { return state.credentialsValid ? { data: { user }, error: null } : { data: { user: null }, error: { message: "Invalid credentials" } }; },
      async signOut() { return { error: null }; },
      async updateUser() { state.passwordWrites++; return { error: null }; },
      async verifyOtp() { if (!state.tokenValid) return { data: {}, error: { message: "Expired or used" } }; state.tokenValid = false; return { data: { user, session: { user } }, error: null }; },
      async getClaims() { return { data: { claims: { session_id: "test-session" } }, error: null }; },
    },
  };
  const admin = { from: table, auth: { admin: {
    async getUserById() { return { data: { user }, error: null }; },
    async generateLink() { return { data: { user, properties: { hashed_token: "a".repeat(64) } }, error: null }; },
  } } };
  const actions = loadModule("../app/lib/auth/actions.ts", {
    "next/headers": { cookies: async () => store },
    "next/navigation": { redirect(path) { throw new Error(`REDIRECT:${path}`); } },
    "next/server": { after(job) { state.jobs.push(job); } },
    "../supabase/admin": { createAdminClient: () => admin },
    "../supabase/config": { secureCookies: {} },
    "../supabase/server": { createSessionClient: async () => client },
    "./policy": policy,
    "./email": { applicationUrl: () => "https://ems.example", async sendAuthEmail() { if (state.providerFails) throw new Error("Provider unavailable"); state.emailCount++; } },
    "./flows": {
      takeRateLimit: async () => state.rateAllowed,
      async issueFlow(userId, sessionId, purpose) { assert.equal(userId, user.id); assert.equal(sessionId, "test-session"); state.hasProof = true; state.issuedPurpose = purpose; },
      async verifiedFlow(purpose, consume) { if (!state.hasProof || (purpose === "activation" ? profile.account_status !== "pending" : profile.account_status !== "active")) return null; if (consume) state.hasProof = false; return { client, user, profile }; },
    },
    "./clear-cookies": { async clearAuthCookies() { state.cookieClears++; } },
  });
  return { actions, state, account };
}

test("only two exact authorized identities and roles are accepted", () => {
  assert.equal(policy.authorizedAccounts.length, 2);
  assert.equal(policy.authorizedAccount("unknown@example.com"), undefined);
  assert.equal(policy.authorizedAccount(" DANICAACOSTA544@GMAIL.COM ").employeeId, "EMP-4092");
  const { state } = harness();
  assert.equal(policy.validProfile(state.profile, state.user), true);
  assert.equal(policy.validProfile({ ...state.profile, role: "department_manager" }, state.user), false);
  assert.equal(policy.validProfile({ ...state.profile, id: "different-user" }, state.user), false);
});

test("password and username policies reject weak or oversized values", () => {
  for (const password of ["", "aA1!", "no-uppercase42!", "NO-LOWERCASE42!", "NoNumberHere!", "NoSymbolHere42", "aA1!".repeat(33)]) assert.equal(policy.strongPassword(password), false);
  assert.equal(policy.strongPassword("Valid-Test-Password42!"), true);
  for (const username of ["ab", "has spaces", "a".repeat(41)]) assert.equal(policy.validUsername(username), false);
});

for (const role of ["employee", "department_manager"]) {
  test(`${role}: activation emails require the correct ID/email pair`, async () => {
    const { actions, state, account } = harness(role, "pending");
    assert.equal((await actions.requestActivation("WRONG-ID", account.email)).success, false);
    assert.equal(state.emailCount, 0);
    assert.equal((await actions.requestActivation(account.employeeId, account.email)).success, true);
    assert.equal(state.emailCount, 1);
    assert.equal(state.profile.account_status, "pending");
    state.rateAllowed = false;
    assert.equal((await actions.requestActivation(account.employeeId, account.email)).success, false);
    assert.equal(state.emailCount, 1);
  });

  test(`${role}: password login redirects only to the matching portal`, async () => {
    const { actions, state, account } = harness(role);
    state.credentialsValid = false;
    assert.equal((await actions.login(account.email, "Wrong-Test-Password42!")).success, false);
    state.credentialsValid = true;
    const result = await actions.login(account.email, "Valid-Test-Password42!");
    assert.equal(result.redirectTo, role === "employee" ? "/employee/dashboard" : "/manager/dashboard");
    state.profile.account_status = "pending";
    assert.equal((await actions.login(account.email, "Valid-Test-Password42!")).success, false);
    assert.equal(state.cookieClears, 1);
  });
}

test("duplicate activation is rejected for active accounts", async () => {
  const { actions, state, account } = harness();
  assert.equal((await actions.requestActivation(account.employeeId, account.email)).success, false);
  assert.equal(state.emailCount, 0);
});

test("expired, malformed, wrong-purpose, and reused email tokens do not issue proofs", async () => {
  const { actions, state } = harness("employee", "pending");
  assert.equal((await actions.verifyEmailLink("invalid", "invite", "activation")).success, false);
  assert.equal((await actions.verifyEmailLink("a".repeat(64), "recovery", "activation")).success, false);
  state.tokenValid = false;
  assert.equal((await actions.verifyEmailLink("a".repeat(64), "invite", "activation")).success, false);
  assert.equal(state.hasProof, false);
  state.tokenValid = true;
  assert.equal((await actions.verifyEmailLink("a".repeat(64), "invite", "activation")).redirectTo, "/setup-account");
  assert.equal(state.issuedPurpose, "activation");
  assert.equal((await actions.verifyEmailLink("a".repeat(64), "invite", "activation")).success, false);
});

test("setup requires verified proof, consumes it once, and activates after saving the password", async () => {
  const { actions, state } = harness("employee", "pending");
  const password = "Valid-Test-Password42!";
  assert.equal((await actions.setupAccount("test.user", password, password)).success, false);
  assert.equal(state.passwordWrites, 0);
  state.hasProof = true;
  assert.equal((await actions.setupAccount("test.user", password, password)).success, true);
  assert.equal(state.passwordWrites, 1);
  assert.equal(state.profile.account_status, "active");
  assert.equal(state.profile.username, "test.user");
  assert.equal((await actions.setupAccount("test.user", password, password)).success, false);
});

test("password recovery responses remain generic for unknown, throttled, and delivery-failed requests", async () => {
  const { actions, state, account } = harness();
  assert.equal((await actions.requestPasswordReset("unknown@example.com")).success, true);
  await state.jobs.shift()();
  assert.equal(state.emailCount, 0);
  state.rateAllowed = false;
  assert.equal((await actions.requestPasswordReset(account.email)).success, true);
  await state.jobs.shift()();
  state.rateAllowed = true;
  state.providerFails = true;
  assert.equal((await actions.requestPasswordReset(account.email)).success, true);
  await state.jobs.shift()();
  assert.equal(state.emailCount, 0);
  state.providerFails = false;
  assert.equal((await actions.requestPasswordReset(account.email)).success, true);
  assert.equal(state.emailCount, 0);
  await state.jobs.shift()();
  assert.equal(state.emailCount, 1);
});

test("reset requires recovery proof, matching strong passwords, and rejects repeated submission", async () => {
  const { actions, state } = harness();
  const password = "Valid-Test-Password42!";
  assert.equal((await actions.resetPassword(password, password)).success, false);
  state.hasProof = true;
  assert.equal((await actions.resetPassword(password, "different")).success, false);
  assert.equal(state.passwordWrites, 0);
  assert.equal((await actions.resetPassword(password, password)).success, true);
  assert.equal(state.passwordWrites, 1);
  assert.equal(state.cookieClears, 1);
  assert.equal((await actions.resetPassword(password, password)).success, false);
});

test("logout clears local cookies and redirects to Login", async () => {
  const { actions, state } = harness();
  await assert.rejects(actions.logout(), /REDIRECT:\/login/);
  assert.equal(state.cookieClears, 1);
});

test("credential proof lookup is bound to user, session, purpose, and expiry", async () => {
  const { state } = harness("employee", "pending");
  const filters = {};
  let flowExists = true;
  const query = { select() { return query; }, eq(key, value) { filters[key] = value; return query; }, gt(key, value) { filters[key] = value; return query; }, async maybeSingle() { return { data: flowExists ? { nonce_hash: "hash" } : null, error: null }; } };
  const flows = loadModule("../app/lib/auth/flows.ts", {
    "node:crypto": { createHash, randomBytes },
    "next/headers": { cookies: async () => ({ get: () => ({ value: "test-proof" }) }) },
    "../supabase/admin": { createAdminClient: () => ({ from: () => query }) },
    "../supabase/config": { secureCookies: {} },
    "./session": { getAuthContext: async () => ({ profile: state.profile, user: state.user, client: { auth: { getClaims: async () => ({ data: { claims: { session_id: "verified-session" } }, error: null }) } } }) },
  });
  assert.ok(await flows.verifiedFlow("activation"));
  assert.equal(filters.user_id, state.user.id);
  assert.equal(filters.session_id, "verified-session");
  assert.equal(filters.purpose, "activation");
  assert.equal(typeof filters.expires_at, "string");
  assert.equal(filters.nonce_hash, createHash("sha256").update("test-proof").digest("hex"));
  flowExists = false;
  assert.equal(await flows.verifiedFlow("activation"), null);
  assert.equal(await flows.verifiedFlow("recovery"), null);
});

test("proxy denies anonymous, inactive, tampered-role, and cross-role portal access", async () => {
  const { state } = harness();
  let user = state.user;
  function response(location) { const values = []; return { location, headers: new Map(), cookies: { set(cookie) { values.push(cookie); }, getAll: () => values } }; }
  const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: state.profile, error: null }) };
  const { proxy } = loadModule("../proxy.ts", {
    "@supabase/ssr": { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from: () => query }) },
    "next/server": { NextResponse: { next: () => response(null), redirect: (url) => response(url.pathname + url.search) } },
    "./app/lib/supabase/config": { secureCookies: {}, supabaseConfig: () => ({ url: "https://project.supabase.co", key: "test-public-key" }) },
    "./app/lib/auth/policy": policy,
  });
  function request(path) { return { url: `https://ems.example${path}`, nextUrl: { pathname: path }, cookies: { getAll: () => [], get: () => undefined } }; }
  assert.equal((await proxy(request("/manager/dashboard"))).location, "/employee/dashboard");
  assert.equal((await proxy(request("/employee/tasks"))).location, null);
  state.profile.role = "department_manager";
  assert.equal((await proxy(request("/manager/dashboard"))).location, "/login");
  state.profile.role = "employee";
  state.profile.account_status = "disabled";
  assert.equal((await proxy(request("/employee/tasks"))).location, "/login");
  const manager = policy.authorizedAccounts[0];
  state.profile.employee_id = manager.employeeId;
  state.profile.email = manager.email;
  state.profile.role = manager.role;
  state.profile.account_status = "active";
  user = { ...state.user, email: manager.email };
  assert.equal((await proxy(request("/employee/dashboard"))).location, "/manager/dashboard");
  assert.equal((await proxy(request("/manager/tasks"))).location, null);
  user = null;
  assert.equal((await proxy(request("/manager/tasks"))).location, "/login");
  assert.equal((await proxy(request("/setup-account"))).location, "/activate-account?error=verification-required");
  assert.equal((await proxy(request("/reset-password"))).location, "/forgot-password?error=verification-required");
});

for (const [purpose, type, destination] of [["activation", "invite", "/setup-account"], ["recovery", "recovery", "/reset-password"]]) {
  test(`${purpose} email link verifies automatically once during effect replay and opens credentials`, async () => {
    const effects = [];
    const navigations = [];
    let requests = 0;
    let complete;
    let cleared = false;
    const verification = new Promise((resolve) => { complete = resolve; });
    const window = { location: { hash: `#token_hash=${"b".repeat(64)}&type=${type}&purpose=${purpose}` }, history: { replaceState() { cleared = true; } } };
    const { default: ConfirmEmailPage } = loadModule("../app/auth/confirm/page.tsx", {
      "react/jsx-runtime": { jsx: (element, props) => ({ element, props }), jsxs: (element, props) => ({ element, props }) },
      "next/link": { default: () => null },
      "next/navigation": { useRouter: () => ({ replace: (path) => navigations.push(path), refresh() {} }) },
      "react": { useState: () => ["", () => {}], useRef: () => ({ current: null }), useEffect: (effect) => effects.push(effect) },
      "@/app/lib/auth/actions": { verifyEmailLink(token, receivedType, receivedPurpose) { requests++; assert.equal(token, "b".repeat(64)); assert.equal(receivedType, type); assert.equal(receivedPurpose, purpose); return verification; } },
    }, { window });
    ConfirmEmailPage();
    const cleanup = effects[0]();
    cleanup();
    effects[0]();
    assert.equal(requests, 1);
    assert.equal(navigations.length, 0);
    complete({ success: true, redirectTo: destination });
    await verification;
    await Promise.resolve();
    assert.equal(navigations[0], destination);
    assert.equal(cleared, true);
  });
}
