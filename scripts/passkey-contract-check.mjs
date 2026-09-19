import assert from "node:assert/strict";
import fs from "node:fs";

import {
  base64UrlToBytes,
  bytesToBase64Url,
  prepareAuthenticationOptions,
  prepareRegistrationOptions,
  serializePublicKeyCredential,
} from "../src/webauthn.js";

assert.equal(bytesToBase64Url(new Uint8Array([1, 2, 3])), "AQID");
assert.deepEqual([...base64UrlToBytes("AQID")], [1, 2, 3]);

const registration = prepareRegistrationOptions({
  challenge: "AQID",
  user: { id: "BAUG", name: "user@example.test", displayName: "Test User" },
  excludeCredentials: [{ type: "public-key", id: "BwgJ" }],
});
assert.deepEqual([...registration.challenge], [1, 2, 3]);
assert.deepEqual([...registration.user.id], [4, 5, 6]);
assert.deepEqual([...registration.excludeCredentials[0].id], [7, 8, 9]);

const authentication = prepareAuthenticationOptions({
  challenge: "AQID",
  allowCredentials: [{ type: "public-key", id: "BwgJ" }],
});
assert.deepEqual([...authentication.challenge], [1, 2, 3]);
assert.deepEqual([...authentication.allowCredentials[0].id], [7, 8, 9]);

const serialized = serializePublicKeyCredential({
  id: "credential-id",
  rawId: new Uint8Array([10, 11]).buffer,
  type: "public-key",
  authenticatorAttachment: "platform",
  response: {
    clientDataJSON: new Uint8Array([12, 13]).buffer,
    authenticatorData: new Uint8Array([14, 15]).buffer,
    signature: new Uint8Array([16, 17]).buffer,
    userHandle: new Uint8Array([18, 19]).buffer,
    getTransports: () => ["internal"],
  },
  getClientExtensionResults: () => ({}),
});
assert.equal(serialized.rawId, "Cgs");
assert.equal(serialized.response.clientDataJSON, "DA0");
assert.equal(serialized.response.authenticatorData, "Dg8");
assert.equal(serialized.response.signature, "EBE");
assert.equal(serialized.response.userHandle, "EhM");
assert.deepEqual(serialized.response.transports, ["internal"]);

const passkeyUi = fs.readFileSync(new URL("../src/PasskeyAccess.jsx", import.meta.url), "utf8");
assert.match(passkeyUi, /navigator\.credentials\.create/);
assert.match(passkeyUi, /navigator\.credentials\.get/);
assert.match(passkeyUi, /\/auth\/passkeys/);
assert.doesNotMatch(passkeyUi, /localStorage|sessionStorage/);

console.log("Safety360 passkey contract checks passed.");
