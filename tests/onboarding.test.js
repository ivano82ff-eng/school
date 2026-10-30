const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  tourStorageKey,
  isTourDone,
  markTourDone,
  resetTour,
  getTourSteps,
} = require('../client/src/onboarding/tourConfig.cjs');

describe('onboarding tour config', () => {
  const store = new Map();
  const fakeStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  it('builds storage key per user', () => {
    assert.equal(tourStorageKey(7), 'itscool_onboarding_v1_7');
  });

  it('tracks done state', () => {
    store.clear();
    assert.equal(isTourDone(1, fakeStorage), false);
    markTourDone(1, fakeStorage);
    assert.equal(isTourDone(1, fakeStorage), true);
    resetTour(1, fakeStorage);
    assert.equal(isTourDone(1, fakeStorage), false);
  });

  it('returns role-specific steps', () => {
    const student = getTourSteps('student');
    const teacher = getTourSteps('teacher');
    const parent = getTourSteps('parent');
    assert.ok(student.length >= 3);
    assert.ok(teacher.length >= 4);
    assert.ok(parent.some((s) => s.id === 'parent'));
    assert.ok(teacher.some((s) => s.id === 'office'));
    assert.ok(!student.some((s) => s.id === 'office'));
  });
});
