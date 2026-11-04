import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Canonical JSON: keys sorted lexicographically at every level, no
// insignificant whitespace, standard JSON string escaping. Only plain
// objects, arrays, strings, finite numbers, booleans and null are allowed.
// ---------------------------------------------------------------------------
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonicalJson: non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  throw new Error(`canonicalJson: unsupported type ${typeof value}`);
}

export const sha256Hex = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

export const hmacHex = (secret: string, data: string | Buffer) =>
  crypto.createHmac('sha256', secret).update(data).digest('hex');

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

// Crockford base32 (no I, L, O, U): readable aloud and case-insensitive.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function randomBase32(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CROCKFORD[bytes[i] & 31];
  return out;
}

/** High-entropy public version reference, e.g. VMB-7K2Q9XF3MA (50 bits). */
export const newVersionRef = () => `VMB-${randomBase32(10)}`;
/** Case reference. NOT a secret: case access always needs a token. */
export const newCaseRef = () => `VC-${randomBase32(8)}`;

/** Accepts "vmb-7k2q9xf3ma", a pasted passport link, or Crockford look-alikes. */
export function normaliseRef(input: string): string | null {
  const upper = input.toUpperCase();
  // Accept the separators people actually type: "VMB-…", "VMB …", "VMB_…", "VMB–…" or none.
  const m = upper.match(/VMB[\s\-\u2010-\u2015_.:]*([0-9A-Z]{10})(?![0-9A-Z])/);
  if (!m) return null;
  const body = m[1].replace(/O/g, '0').replace(/[IL]/g, '1');
  if (!/^[0-9A-HJKMNP-TV-Z]{10}$/.test(body)) return null;
  return `VMB-${body}`;
}

// ---------------------------------------------------------------------------
// Ed25519 signing of publication receipts.
// ---------------------------------------------------------------------------
export function generateSigningKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

export function signCanonical(payload: Record<string, unknown>, privateKeyPem: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  return crypto.sign(null, Buffer.from(canonicalJson(payload), 'utf8'), key).toString('base64url');
}

export function verifyCanonical(payload: Record<string, unknown>, signature: string, publicKeyPem: string): boolean {
  try {
    const key = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(null, Buffer.from(canonicalJson(payload), 'utf8'), key, Buffer.from(signature, 'base64url'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt) for the MVP's own accounts.
// ---------------------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64url'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------
// Symmetric encryption for reply addresses (AES-256-GCM).
// ---------------------------------------------------------------------------
function encKey(secret: string) {
  return crypto.createHash('sha256').update(`vimba-enc:${secret}`).digest();
}

export function encrypt(plain: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(secret), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(token: string, secret: string): string {
  const [iv, tag, ct] = token.split('.').map((s) => Buffer.from(s, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Signed, expiring cookie value: base64url(json).hmac */
export function sealValue(data: Record<string, unknown>, secret: string): string {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${body}.${hmacHex(secret, `seal:${body}`)}`;
}

export function unsealValue<T = Record<string, unknown>>(value: string | undefined, secret: string): T | null {
  if (!value) return null;
  const [body, mac] = value.split('.');
  if (!body || !mac || !timingSafeEqualStr(mac, hmacHex(secret, `seal:${body}`))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof data.exp === 'number' && data.exp < Date.now()) return null;
    return data as T;
  } catch {
    return null;
  }
}
