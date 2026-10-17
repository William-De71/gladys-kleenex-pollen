import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  localClock,
  addDays,
  datesOf,
  nextMidnight,
  jitterOf,
  displayInstant,
  JITTER_MINUTES,
} from '../src/time.js';

test('days of the month become calendar dates from the reading day', () => {
  assert.deepEqual(datesOf([17, 18, 19, 20, 21], '2026-10-17'), [
    '2026-10-17',
    '2026-10-18',
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
  ]);
  assert.deepEqual(
    datesOf([30, 31, 1, 2], '2026-10-30'),
    ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'],
    'across a month',
  );
  assert.deepEqual(
    datesOf([31, 1, 2], '2026-12-31'),
    ['2026-12-31', '2027-01-01', '2027-01-02'],
    'across a year',
  );
});

test('an American city read from Europe after midnight starts the day before', () => {
  assert.deepEqual(datesOf([16, 17, 18], '2026-10-17'), ['2026-10-16', '2026-10-17', '2026-10-18']);
});

test('a day that cannot be placed is left empty, the next ones still are', () => {
  assert.deepEqual(datesOf([5, 18], '2026-10-17'), ['', '2026-10-18']);
});

test('local clock, midnight with summer time, stable jitter', () => {
  assert.deepEqual(localClock(Date.parse('2026-10-17T22:30:00Z'), 'Europe/Paris'), {
    date: '2026-10-18',
    minutes: 30,
  });
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  // 25 October 2026: back to winter time in Paris.
  assert.equal(
    new Date(nextMidnight(Date.parse('2026-10-25T12:00:00Z'), 'Europe/Paris')).toISOString(),
    '2026-10-25T23:01:00.000Z',
  );
  assert.equal(jitterOf('Mâcon'), jitterOf('Mâcon'));
  assert.ok(jitterOf('Mâcon') >= 0 && jitterOf('Mâcon') < JITTER_MINUTES);
  assert.equal(jitterOf(''), 0);
  assert.equal(displayInstant('2026-10-17'), '2026-10-17T00:00:00.000Z');
});
