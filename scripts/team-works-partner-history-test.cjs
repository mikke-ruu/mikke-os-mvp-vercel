const assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
const moduleUnderTest={exports:{}};
new Function('exports',ts.transpileModule(fs.readFileSync('lib/team-works-partner-history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleUnderTest.exports);
const {historyTotals,parseHourlyWage,parseActualMinutes}=moduleUnderTest.exports;
assert.deepEqual(historyTotals([{status:'completed',minutes:45,amount:900},{status:'completed',minutes:30,amount:null},{status:'cancelled',minutes:60,amount:2000},{status:'unconfirmed',minutes:20,amount:null},{status:'completed',minutes:15,amount:0}]),{count:3,minutes:90,amount:900,unpriced:1});
assert.equal(parseHourlyWage(''),null);assert.equal(parseHourlyWage('0'),0);assert.equal(parseHourlyWage('1500'),1500);
for(const invalid of ['-1','1.5','Infinity','NaN','2147483648'])assert.throws(()=>parseHourlyWage(invalid));
console.log('PASS totals exclude cancelled/unconfirmed and distinguish unpriced from zero; integer yen validation');

assert.equal(parseActualMinutes('50'),50);assert.equal(parseActualMinutes('0'),0);for(const invalid of ['', '-1','1.2','1441'])assert.throws(()=>parseActualMinutes(invalid));
assert.deepEqual(historyTotals([{status:'completed',minutes:45,actualMinutes:50,calculationBasis:'actual',amount:1000},{status:'completed',minutes:45,actualMinutes:null,calculationBasis:'actual',amount:null}]),{count:2,minutes:50,amount:1000,unpriced:1});
const {actualTimeMinutes,scheduledTimeRange,lessonTimeLabel}=moduleUnderTest.exports;
assert.equal(actualTimeMinutes('14:00','15:10',false,'10'),60);
assert.equal(actualTimeMinutes('23:30','00:30',true,'10'),50);
for(const args of [['','15:00',false,'0'],['14:00','13:00',false,'0'],['14:00','15:00',true,'0'],['14:00','15:00',false,'61']])assert.throws(()=>actualTimeMinutes(...args));
assert.equal(scheduledTimeRange('23:30:00',60),'23:30〜翌日 00:30');
assert.equal(lessonTimeLabel({calculationBasis:'actual',actualMinutes:60}),'実働60分（開始・終了時刻は未登録）');
assert.equal(lessonTimeLabel({calculationBasis:'actual',actualMinutes:60,actualStartTime:'14:00:00',actualEndTime:'15:10:00',actualBreakMinutes:10}),'14:00〜15:10（実働60分・休憩10分）');
console.log('PASS explicit actual clock ranges, breaks, overnight validation and no invented legacy start/end times');
