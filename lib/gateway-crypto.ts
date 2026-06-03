// =============================================================================
// Gateway key encryption / decryption — AES-256-GCM (Node crypto).
//
// The GATEWAY_ENCRYPTION_KEY env var must be a 32-byte hex string (64 chars).
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Encoded format: iv(24 hex) + authTag(32 hex) + ciphertext(hex).
// Server-only — never import from a "use client" module.
// =============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.GATEWAY_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "GATEWAY_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: " +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptGatewayKey(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

export function decryptGatewayKey(encoded: string): string {
  const iv = Buffer.from(encoded.slice(0, 24), "hex");
  const tag = Buffer.from(encoded.slice(24, 56), "hex");
  const encrypted = Buffer.from(encoded.slice(56), "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
