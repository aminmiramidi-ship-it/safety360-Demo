import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requests = [];

globalThis.__importMetaEnv = {};
globalThis.window = {
  location: { hostname: "localhost", protocol: "http:" },
  dispatchEvent() {},
  localStorage: new Proxy(
    {},
    {
      get() {
        throw new Error("Browser auth code must not access localStorage");
      },
    },
  ),
};
globalThis.document = {
  cookie: "safety360_csrf=csrf%20contract%20token; theme=dark",
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};
globalThis.FormData = class FormData {};
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url, options });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

let source = await readFile(new URL("../src/api.js", import.meta.url), "utf8");
source = source.replaceAll("import.meta.env", "globalThis.__importMetaEnv");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { api, apiRequest } = await import(moduleUrl);

await apiRequest("/tickets", {
  method: "POST",
  body: JSON.stringify({ description: "contract-check" }),
});

assert.equal(requests.length, 1);
assert.equal(requests[0].url, "http://localhost:8000/tickets");
assert.equal(requests[0].options.method, "POST");
assert.equal(requests[0].options.credentials, "include");
assert.equal(
  requests[0].options.headers.get("X-Requested-With"),
  "csrf contract token",
  "Unsafe browser requests must carry the CSRF cookie value in the configured header",
);
assert.equal(requests[0].options.headers.get("Content-Type"), "application/json");
assert.equal(
  requests[0].options.headers.get("Authorization"),
  null,
  "Browser requests must not reconstruct a bearer Authorization header",
);

requests.length = 0;
await apiRequest("/auth/me");
assert.equal(requests.length, 1);
assert.equal(requests[0].options.method, "GET");
assert.equal(requests[0].options.credentials, "include");
assert.equal(
  requests[0].options.headers.get("X-Requested-With"),
  null,
  "Safe GET requests should not receive a CSRF header",
);
assert.equal(requests[0].options.headers.get("Authorization"), null);

requests.length = 0;
await api.login({ email: "contract@example.com", password: "not-a-real-secret" });
assert.equal(requests.length, 1);
assert.equal(requests[0].url, "http://localhost:8000/auth/session/login");
assert.equal(requests[0].options.method, "POST");
assert.equal(requests[0].options.credentials, "include");
assert.equal(requests[0].options.headers.get("Authorization"), null);

console.log("Safety360 browser-session auth contract checks passed.");
