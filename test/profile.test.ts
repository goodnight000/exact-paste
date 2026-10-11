import { describe, expect, it } from 'vitest';
import { savedSource, readProfile, vaultFrom } from '../src/profile';

describe('saved profile compatibility', () => {
  it('passes structured answers without reparsing their internal headings', () => {
    const profile = { version: 1 as const, fields: [{ kind: 'custom', label: 'Why this idea?', value: 'First paragraph.\n\n## The plan\nDetails: do it well.' }], notes: 'Other notes' };
    const source = savedSource({ profile, vault: vaultFrom(profile) });
    expect(source).toEqual({ text: 'Other notes', fields: profile.fields });
  });
  it('uses the current legacy vault when a profile is stale or missing', () => {
    const profile = { version: 1 as const, fields: [{ kind: 'email', label: 'Email', value: 'old@example.com' }], notes: '' };
    expect(savedSource({ profile, vault: 'Email: new@example.com' })).toEqual({ text: 'Email: new@example.com' });
    expect(savedSource({ vault: 'legacy' })).toEqual({ text: 'legacy' });
  });
  it('rejects malformed profiles rather than discarding saved text', () => {
    expect(readProfile({ version: 1, fields: [null], notes: '' })).toBeNull();
    expect(savedSource({ profile: { version: 2, fields: [], notes: '' }, vault: 'legacy' })).toEqual({ text: 'legacy' });
  });
});
