function normalizeBase64Url(value) {
  return String(value || "").replace(/-/g, "+").replace(/_/g, "/");
}

export function base64UrlToBytes(value) {
  const normalized = normalizeBase64Url(value);
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function bytesToBase64Url(value) {
  if (value == null) return null;
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeCredentialDescriptors(descriptors = []) {
  return descriptors.map((descriptor) => ({
    ...descriptor,
    id: base64UrlToBytes(descriptor.id),
  }));
}

export function prepareRegistrationOptions(publicKey) {
  return {
    ...publicKey,
    challenge: base64UrlToBytes(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64UrlToBytes(publicKey.user.id),
    },
    excludeCredentials: decodeCredentialDescriptors(publicKey.excludeCredentials || []),
  };
}

export function prepareAuthenticationOptions(publicKey) {
  return {
    ...publicKey,
    challenge: base64UrlToBytes(publicKey.challenge),
    ...(publicKey.allowCredentials
      ? { allowCredentials: decodeCredentialDescriptors(publicKey.allowCredentials) }
      : {}),
  };
}

export function serializePublicKeyCredential(credential) {
  if (!credential) throw new Error("No WebAuthn credential returned by the browser.");

  const response = credential.response;
  const serializedResponse = {};
  for (const key of [
    "clientDataJSON",
    "attestationObject",
    "authenticatorData",
    "signature",
    "userHandle",
  ]) {
    if (response?.[key] != null) {
      serializedResponse[key] = bytesToBase64Url(response[key]);
    }
  }
  if (typeof response?.getTransports === "function") {
    serializedResponse.transports = response.getTransports();
  }

  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    response: serializedResponse,
    clientExtensionResults:
      typeof credential.getClientExtensionResults === "function"
        ? credential.getClientExtensionResults()
        : {},
    ...(credential.authenticatorAttachment
      ? { authenticatorAttachment: credential.authenticatorAttachment }
      : {}),
  };
}

export function isWebAuthnAvailable() {
  return Boolean(
    globalThis.PublicKeyCredential &&
      globalThis.navigator?.credentials &&
      typeof globalThis.navigator.credentials.create === "function" &&
      typeof globalThis.navigator.credentials.get === "function",
  );
}
