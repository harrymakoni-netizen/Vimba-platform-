import { describe, expect, it } from 'vitest';
import { canonicalJson, generateSigningKeyPair, normaliseRef, signCanonical, verifyCanonical, sealValue, unsealValue, encrypt, decrypt } from '@/lib/crypto';
import { contentDigest } from '@/services/publication';

describe('canonical JSON', () => {
  it('is independent of key order and whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, 'x'], c: null } })).toBe('{"a":{"c":null,"d":[1,"x"]},"b":1}');
    expect(canonicalJson({ a: { c: null, d: [1, 'x'] }, b: 1 })).toBe(canonicalJson({ b: 1, a: { d: [1, 'x'], c: null } }));
  });
  it('rejects non-finite numbers', () => {
    expect(() => canonicalJson({ a: Infinity })).toThrow();
  });
});

describe('Ed25519 receipts', () => {
  const { privateKeyPem, publicKeyPem } = generateSigningKeyPair();
  const receipt = { schema_version: 1, version_number: 1, content_sha256: contentDigest({ title: 'T', body: '12 schools', language: 'en' }) };
  const sig = signCanonical(receipt, privateKeyPem);

  it('verifies an approved payload', () => {
    expect(verifyCanonical(receipt, sig, publicKeyPem)).toBe(true);
  });
  it('fails for a changed signed field', () => {
    expect(verifyCanonical({ ...receipt, version_number: 2 }, sig, publicKeyPem)).toBe(false);
  });
  it('fails for changed text', () => {
    expect(contentDigest({ title: 'T', body: '2 schools', language: 'en' })).not.toBe(receipt.content_sha256);
  });
  it('fails with the wrong key', () => {
    expect(verifyCanonical(receipt, sig, generateSigningKeyPair().publicKeyPem)).toBe(false);
  });
});

describe('references', () => {
  it('normalises typed and pasted references', () => {
    expect(normaliseRef('vmb-7k2q9xf3ma')).toBe('VMB-7K2Q9XF3MA');
    expect(normaliseRef('https://vimba.test/p/VMB-7K2Q9XF3MA')).toBe('VMB-7K2Q9XF3MA');
    expect(normaliseRef('vmb 7k2q9xf3ma')).toBe('VMB-7K2Q9XF3MA');
    expect(normaliseRef('VMB–7K2Q9XF3MA')).toBe('VMB-7K2Q9XF3MA');
    expect(normaliseRef('HLOLA vmb7k2q9xf3ma')).toBe('VMB-7K2Q9XF3MA');
    expect(normaliseRef('CHECK VMB-7K2Q9XF3MA please')).toBe('VMB-7K2Q9XF3MA');
    expect(normaliseRef('VMB-7K2Q')).toBeNull();
    expect(normaliseRef('hello')).toBeNull();
  });
});

describe('sealed values and encryption', () => {
  it('rejects tampered or expired cookies', () => {
    const v = sealValue({ a: 'x', exp: Date.now() + 1000 }, 's');
    expect(unsealValue(v, 's')).toMatchObject({ a: 'x' });
    expect(unsealValue(v, 'other')).toBeNull();
    expect(unsealValue(v.replace(/^./, 'A'), 's')).toBeNull();
    expect(unsealValue(sealValue({ a: 'x', exp: Date.now() - 1 }, 's'), 's')).toBeNull();
  });
  it('round-trips reply addresses', () => {
    expect(decrypt(encrypt('263771234567', 'k'), 'k')).toBe('263771234567');
  });
});
