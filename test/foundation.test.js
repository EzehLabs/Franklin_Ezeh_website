import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import app from "../app.js";
import { parseCookies } from "../middleware/cookies.js";
import { verifyRequestOrigin } from "../middleware/origin.js";
import { createOpaqueToken, formatClientNumber, hashToken } from "../lib/tokens.js";
import { proposalSchema, registerSchema } from "../lib/validation.js";

let server;
let origin;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("the public portfolio and client portal are served", async () => {
  for (const [route, expected] of [
    ["/", "Ideas into"],
    ["/portal", "Your work"],
    ["/verify-email", "Verify your"],
    ["/portal.js", "apiRequest"],
  ]) {
    const response = await fetch(new URL(route, origin));
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), new RegExp(expected));
  }
});

test("server source and environment files are not exposed as static assets", async () => {
  for (const route of ["/server.js", "/db/migrations/001_initial.sql", "/.env"]) {
    const response = await fetch(new URL(route, origin));
    assert.equal(response.status, 404, route);
  }
});

test("invalid JSON receives a client error", async () => {
  const response = await fetch(new URL("/api/auth/login", origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Request body must contain valid JSON." });
});

test("client IDs are padded and opaque session tokens are stored by hash", () => {
  assert.equal(formatClientNumber(1), "EL-000001");
  assert.equal(formatClientNumber(123456), "EL-123456");
  const token = createOpaqueToken();
  assert.equal(token.length, 43);
  assert.notEqual(hashToken(token), token);
  assert.equal(hashToken(token), hashToken(token));
});

test("registration normalizes email and enforces password length", () => {
  const valid = registerSchema.parse({
    fullName: "  Franklin Ezeh ",
    email: "  FRANKLIN@example.com ",
    password: "correct horse battery",
  });
  assert.equal(valid.fullName, "Franklin Ezeh");
  assert.equal(valid.email, "franklin@example.com");
  assert.equal(registerSchema.safeParse({
    fullName: "Franklin",
    email: "franklin@example.com",
    password: "short",
  }).success, false);
});

test("proposal input requires bounded service details", () => {
  assert.equal(proposalSchema.safeParse({
    serviceType: "Web development",
    description: "A small site",
    budgetRange: "₦100,000–₦200,000",
    timeline: "Four weeks",
  }).success, true);
  assert.equal(proposalSchema.safeParse({
    serviceType: "Web development",
    description: "",
    budgetRange: "Flexible",
    timeline: "Flexible",
  }).success, false);
});

test("cookie parser reads opaque cookie values", () => {
  const request = { headers: { cookie: "theme=dark; ezehlabs_session=abc_DEF-123" } };
  parseCookies(request, {}, () => {});
  assert.equal(request.cookies.theme, "dark");
  assert.equal(request.cookies.ezehlabs_session, "abc_DEF-123");
});

test("cross-site state-changing requests are rejected", () => {
  const request = {
    method: "POST",
    get(name) {
      return name === "sec-fetch-site" ? "cross-site" : undefined;
    },
  };
  const response = {
    statusCode: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  let continued = false;
  verifyRequestOrigin(request, response, () => { continued = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(continued, false);
});
