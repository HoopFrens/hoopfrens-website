import assert from "node:assert/strict";
import test from "node:test";
import { AccessRestricted } from "@/components/admin/AccessRestricted";
import { accessDeniedCopy, collectionManagerKey } from "@/components/admin/adminDashboardUtils";
import { IntentType } from "@/domain/intent";
import {
  adminAuthorizationService,
  executiveCommandService,
  intentService,
  type ExecutiveCommandHandlers,
} from "@/services";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("Headquarters authorization allows only authenticated admin user documents", async () => {
  assert.deepEqual(
    await adminAuthorizationService.authorize({ uid: "admin" }, async () => ({ exists: true, role: "admin" })),
    { allowed: true, reason: "admin" },
  );
  assert.deepEqual(
    await adminAuthorizationService.authorize({ uid: "member" }, async () => ({ exists: true, role: "member" })),
    { allowed: false, reason: "not-admin" },
  );
  assert.deepEqual(
    await adminAuthorizationService.authorize({ uid: "missing-role" }, async () => ({ exists: true })),
    { allowed: false, reason: "missing-role" },
  );
  assert.deepEqual(
    await adminAuthorizationService.authorize({ uid: "missing-user" }, async () => ({ exists: false })),
    { allowed: false, reason: "missing-user" },
  );
  assert.deepEqual(
    await adminAuthorizationService.authorize(null, async () => ({ exists: true, role: "admin" })),
    { allowed: false, reason: "unauthenticated" },
  );
  assert.deepEqual(
    await adminAuthorizationService.authorize({ uid: "failure" }, async () => { throw new Error("lookup failed"); }),
    { allowed: false, reason: "lookup-failed" },
  );
});

test("authenticated denial copy protects account and authorization details", () => {
  assert.deepEqual(accessDeniedCopy, {
    title: "Access Restricted",
    body: "Your account has been authenticated, but it is not authorized to access Hoop Frens Headquarters.",
    help: "If you believe this is an error, contact a Headquarters administrator.",
  });
  const renderedCopy = Object.values(accessDeniedCopy).join(" ");
  assert.doesNotMatch(renderedCopy, /@/);
  assert.doesNotMatch(renderedCopy, /admin role/i);
});

test("Access Restricted view omits identity details and exposes a Sign Out action", () => {
  const markup = renderToStaticMarkup(createElement(AccessRestricted));

  assert.match(markup, /Access Restricted/i);
  assert.match(markup, /Sign Out/i);
  assert.doesNotMatch(markup, /@/);
  assert.doesNotMatch(markup, /admin role/i);
  assert.doesNotMatch(markup, /Return to Sign In/i);
});

function classify(text: string) {
  const result = intentService.classify({ workspaceId: "executive-workspace", text });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Intent classification failed");
  return result.data;
}

function commandHandlers(createdProjects: Map<string, string>, requestId: string): ExecutiveCommandHandlers<IntentType> {
  return {
    async create(intent) {
      const projectId = executiveCommandService.projectIdForRequest(requestId);
      createdProjects.set(projectId, intent.normalizedInput);
      return IntentType.Create;
    },
    async continue() { return IntentType.Continue; },
    async review() { return IntentType.Review; },
    async approve() { return IntentType.Approve; },
    async learn() { return IntentType.Learn; },
    async think() { return IntentType.Think; },
    async search() { return IntentType.Search; },
    async navigate() { return IntentType.Navigate; },
    async unknown() { return IntentType.Unknown; },
  };
}

test("Executive Conversation routes every intent explicitly and only create persists a project", async () => {
  const cases: Array<[string, IntentType]> = [
    ["Create a school spotlight for Ashland University", IntentType.Create],
    ["Review Ashland University", IntentType.Review],
    ["Approve Ashland University", IntentType.Approve],
    ["Continue Ashland University", IntentType.Continue],
    ["Find Ashland University", IntentType.Search],
    ["Open the library", IntentType.Navigate],
    ["Do something surprising", IntentType.Unknown],
  ];

  for (const [request, expectedIntent] of cases) {
    const createdProjects = new Map<string, string>();
    const result = await executiveCommandService.execute(
      classify(request),
      commandHandlers(createdProjects, `request-${expectedIntent}`),
    );
    assert.equal(result, expectedIntent);
    assert.equal(createdProjects.size, expectedIntent === IntentType.Create ? 1 : 0);
  }
});

test("duplicate create retries produce at most one permanent project", async () => {
  const createdProjects = new Map<string, string>();
  const intent = classify("Create a school spotlight for Ashland University");
  const requestId = executiveCommandService.createRequestId("founder", "submission-123");
  const handlers = commandHandlers(createdProjects, requestId);

  await Promise.all([
    executiveCommandService.execute(intent, handlers),
    executiveCommandService.execute(intent, handlers),
  ]);

  assert.equal(createdProjects.size, 1);
  assert.equal(
    Array.from(createdProjects.keys())[0],
    executiveCommandService.projectIdForRequest(requestId),
  );
});

test("admin collection keys reset slug form state only when the collection changes", () => {
  assert.equal(collectionManagerKey("articles"), collectionManagerKey("articles"));
  assert.notEqual(collectionManagerKey("articles"), collectionManagerKey("players"));
});
