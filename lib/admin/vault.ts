// AES-256-GCM at-rest encryption for sensitive platform credentials stored
// in public.platform_settings. The master key lives in INVOXAI_VAULT_KEY
// (32-byte hex) and is loaded only on the server.
//
// Generate a key:   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import crypto from "node:crypto";

const ALG = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.INVOXAI_VAULT_KEY;
  if (!hex || hex.length < 64) {
    throw new Error(
      "Missing INVOXAI_VAULT_KEY (need 32-byte hex). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(hex.slice(0, 64), "hex");
}

/** Returns true if INVOXAI_VAULT_KEY is set — UI uses this to gate the Credentials page. */
export function vaultConfigured(): boolean {
  return !!process.env.INVOXAI_VAULT_KEY && process.env.INVOXAI_VAULT_KEY.length >= 64;
}

export function encryptValue(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptValue(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < 28) throw new Error("Invalid ciphertext");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf-8",
  );
}

/** Replace everything except the last 4 chars with bullets. */
export function maskValue(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return "•".repeat(Math.max(0, plaintext.length - 4)) + plaintext.slice(-4);
}
