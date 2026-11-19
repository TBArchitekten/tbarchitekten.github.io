'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const K=require('../app/office-kosten-core.js');
const source=()=>({kind:'manual',reference:'Testaufmaß, freigegebene Eingabe'});
const position=(o={})=>({id:'A',label:'Testposition',groupCode:'KG-A',unit:'m2',quantity:'2.5000',
  unitPriceEur:'100.0000',quantitySource:source(),priceSource:source(),priceDate:'2026-11-19',...o});
const model=(positions,other={})=>({schema:'tba.office.kosten.v0.1',projectId:'synthetic-only',
  purpose:'kostenberechnung',classification:{system:'project-specific',edition:'test-1'},
  currency:'EUR',taxBasis:'net',positions,...other});
test('exact decimal calculation: canonical strings and integer-cent output',()=>{
  const x=K.calculate(model([position({quantity:'12.3456',unitPriceEur:'19.9999'})]));
  assert.equal(x.knownSubtotalCents,'24691');
  assert.equal(x.totalCents,'24691');
  assert.equal(x.status,'ready');
});
test('round half up per position, not by binary floating point',()=>{
  const x=K.calculate(model([position({id:'1',quantity:'1',unitPriceEur:'1.0050'}),
    position({id:'2',quantity:'1',unitPriceEur:'1.0050'})]));
  assert.deepEqual(x.positions.map(p=>p.amountCents),['101','101']);
  assert.equal(x.totalCents,'202');
});
test('known zero is not a missing value',()=>{
  const x=K.calculate(model([position({quantity:'0',unitPriceEur:'0'})]));
  assert.equal(x.totalCents,'0');assert.equal(x.status,'ready');
});
test('missing prices remain unknown, never become zero or an apparent grand total',()=>{
  const x=K.calculate(model([position({id:'a'}),position({id:'b',groupCode:'KG-B',unitPriceEur:null,priceSource:null,priceDate:null})]));
  assert.equal(x.knownSubtotalCents,'25000');assert.equal(x.totalCents,null);
  assert.equal(x.incompleteCount,1);assert.equal(x.groups[1].totalCents,null);
  assert.deepEqual(x.positions[1].issues,['missing_unit_price']);
});
test('absent sources / price date prohibit ready status but keep arithmetic visible',()=>{
  const x=K.calculate(model([position({quantitySource:null,priceDate:null})]));
  assert.equal(x.knownSubtotalCents,'25000');assert.equal(x.totalCents,null);
  assert.deepEqual(x.issues.map(p=>p.code),['missing_quantity_source','missing_or_invalid_price_date']);
});
test('group subtotal cannot imply completeness of an incomplete classification',()=>{
  const x=K.calculate(model([position({id:'a',groupCode:'G'}),position({id:'b',groupCode:'G',quantity:null,quantitySource:null})]));
  assert.equal(x.groups.length,1);assert.equal(x.groups[0].knownSubtotalCents,'25000');
  assert.equal(x.groups[0].totalCents,null);
});
test('missing group is not silently given a DIN cost code',()=>{
  const x=K.calculate(model([position({groupCode:null})]));
  assert.equal(x.status,'incomplete');assert.equal(x.groups[0].code,null);
  assert.equal(x.totalCents,null);
});
test('invalid format, negative values, exponent and excess precision are rejected',()=>{
  for(const q of ['-1','1,50','1e3','1.00001',12,NaN,'01.2','10000000000000']){
    assert.throws(()=>K.calculate(model([position({quantity:q})])),TypeError,String(q));
  }
});
test('dates, currency, net-basis, purpose and duplicate IDs must be explicit',()=>{
  const date=K.calculate(model([position({priceDate:'2026-02-30'})]));
  assert.equal(date.totalCents,null);
  assert.ok(date.issues.some(p=>p.code==='missing_or_invalid_price_date'));
  assert.throws(()=>K.calculate(model([position(),position()])),/eindeutige IDs/);
  assert.throws(()=>K.calculate(model([position()],{taxBasis:'gross'})),/Nur EUR netto/);
  assert.throws(()=>K.calculate(model([position()],{currency:'USD'})),/Nur EUR netto/);
  assert.throws(()=>K.calculate(model([position()],{purpose:'honorar'})),/Nur Kostenberechnung/);
  assert.throws(()=>K.calculate(model([position()],{classification:{system:'',edition:'2018'}})),/Kostengliederung/);
});
test('empty estimate cannot claim a complete zero-cost project',()=>{
  const x=K.calculate(model([]));
  assert.equal(x.status,'incomplete');assert.equal(x.totalCents,null);
  assert.deepEqual(x.issues,[{positionId:null,code:'no_positions'}]);
});
test('missing quantities and sources are separately reported',()=>{
  const x=K.calculate(model([position({quantity:null,quantitySource:null,priceSource:null})]));
  assert.equal(x.positions[0].amountCents,null);
  assert.deepEqual(x.positions[0].issues,['missing_quantity','missing_price_source']);
});
