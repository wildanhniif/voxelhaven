import { describe, expect, it } from 'vitest';
import { normalizeWorldName, validateWorldName, worldSeed } from '../../src/state/world-manager';

describe('aturan nama world', () => {
  it('case-insensitive: Test == test', () => {
    expect(worldSeed('Test')).toBe(worldSeed('test'));
    expect(worldSeed('TeSt')).toBe(worldSeed('test'));
  });
  it('valid: huruf, angka setelah awal, underscore', () => {
    expect(validateWorldName('Test')).toBeNull();
    expect(validateWorldName('world_1')).toBeNull();
    expect(validateWorldName('a1b2')).toBeNull();
  });
  it('invalid: kosong, angka awal, spasi, special char', () => {
    expect(validateWorldName('')).not.toBeNull();
    expect(validateWorldName('   ')).not.toBeNull();
    expect(validateWorldName('1test')).not.toBeNull();
    expect(validateWorldName('dua kata')).not.toBeNull();
    expect(validateWorldName('te!st')).not.toBeNull();
    expect(validateWorldName('te#st')).not.toBeNull();
  });
  it('normalize: trim + lowercase', () => {
    expect(normalizeWorldName('  Test  ')).toBe('test');
  });
});
