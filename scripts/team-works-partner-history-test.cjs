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
