import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../lib/billing/platform/schedule.ts', import.meta.url), 'utf8');
const code = stripTypeScriptTypes(source, { mode: 'strip' });
const { getMonthlyBillingPeriod: period, MONTHLY_SCHEDULE_DECISION: policy } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
let checks = 0;
const test = (name, run) => { run(); checks++; console.log(`ok ${checks} - ${name}`); };

for (const [start, index, expectedStart, next] of [
  ['2026-09-10', 0, '2026-09-10', '2026-10-10'],
  ['2026-01-31', 0, '2026-01-31', '2026-02-28'],
  ['2026-01-31', 1, '2026-02-28', '2026-03-31'],
  ['2026-01-30', 1, '2026-02-28', '2026-03-30'],
  ['2026-01-29', 1, '2026-02-28', '2026-03-29'],
  ['2028-01-31', 1, '2028-02-29', '2028-03-31'],
  ['2028-02-29', 12, '2029-02-28', '2029-03-29'],
  ['2028-02-29', 48, '2032-02-29', '2032-03-29'],
  ['2099-12-31', 2, '2100-02-28', '2100-03-31'],
  ['2399-12-31', 2, '2400-02-29', '2400-03-31'],
  ['2026-04-30', 0, '2026-04-30', '2026-05-30'],
  ['2026-12-31', 0, '2026-12-31', '2027-01-31'],
  ['0001-01-31', 0, '0001-01-31', '0001-02-28'],
  ['9999-11-30', 0, '9999-11-30', '9999-12-30'],
]) test(`${start} index ${index}`, () => assert.deepEqual(period(start, index), { originalPaidStartDay:start, periodIndex:index, startsOn:expectedStart, nextRenewalOn:next }));

for (const start of [null, undefined, 20260901, {}, [], 'today', 'infinity', '', '2026-2-28', '2026-02-29', '2100-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-01-00', '0000-01-01', '10000-01-01', '2026-09-01 ', '2026-09-01T00:00:00.000Z', '2026-09-01\n']) {
  test(`invalid day ${JSON.stringify(start)}`, () => assert.equal(period(start, 0), null));
}
for (const index of [undefined, null, '0', true, [], {}, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER+1]) {
  test(`invalid index ${String(index)}`, () => assert.equal(period('2026-09-01', index), null));
}
test('cannot create a period extending beyond supported year', () => assert.equal(period('9999-12-01', 0), null));
test('detached immutable result', () => assert.equal(Object.isFrozen(period('2026-09-01', 0)), true));
test('approval is only monthly dates, no automatic trial conversion', () => {
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(policy.autoChargeAtTrialEnd, false);
  assert.equal(policy.explicitPaidApplicationRequired, true);
  assert.equal(policy.verifiedPaymentRequired, true);
  assert.equal('refund' in policy, false);
  assert.equal('price' in policy, false);
});

test('full Gregorian 400-year cycle: original day retained and adjacent periods continuous', () => {
  let cases = 0;
  for (let year=2000; year<2400; year++) for (let month=1; month<=12; month++) for (const day of [1,28,29,30,31]) {
    const start = `${year}-${String(month).padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
    if (new Date(`${start}T00:00:00.000Z`).toISOString().slice(0,10) !== start) continue;
    for (const index of [0,1,2,12,48]) {
      const actual = period(start,index);
      const absolute = year*12+month-1+index;
      const targetYear = Math.floor(absolute/12), targetMonth=absolute%12;
      const lastDay = new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate();
      const expected = new Date(Date.UTC(targetYear,targetMonth,Math.min(day,lastDay))).toISOString().slice(0,10);
      assert.equal(actual.startsOn,expected);
      assert.equal(actual.nextRenewalOn,period(start,index+1).startsOn);
      assert.ok(actual.nextRenewalOn>actual.startsOn);
      cases++;
    }
  }
  console.log(`calendar cases: ${cases}`);
});
console.log(`monthly schedule: ${checks} checks passed; no DB/provider calls`);
