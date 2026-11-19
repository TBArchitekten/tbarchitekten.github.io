/*
 * TBA Office · Kostenkern v0.1. Reine, deterministische Vorberechnung.
 * Kein DIN-Katalog, keine HOAI-Honorarermittlung, keine Freigabe oder Datenbankaktion.
 * Dezimal-Eingaben sind kanonische Strings mit Punkt und bis zu 4 Dezimalstellen.
 * Alle Geld-Ergebnisse sind Cent-Strings, nicht JS-Gleitkommazahlen.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.TBAOfficeKostenCore=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const SCALE=10000n, DIVISOR=1000000n;
  const decimal=/^(0|[1-9]\d{0,12})(?:\.(\d{1,4}))?$/;
  const isoDate=/^\d{4}-\d{2}-\d{2}$/;
  const hasText=v=>typeof v==='string'&&v.trim().length>0;
  function decimal4(value,field){
    if(typeof value!=='string'||!decimal.test(value))
      throw new TypeError(field+' muss eine nichtnegative Dezimalzeichenkette (max. 4 Nachkommastellen) sein');
    const [whole,fraction='']=value.split('.');
    return BigInt(whole)*SCALE+BigInt((fraction+'0000').slice(0,4));
  }
  function validSource(value){
    return !!value&&typeof value==='object'&&!Array.isArray(value)&&
      hasText(value.kind)&&hasText(value.reference);
  }
  function modelGuard(model){
    if(!model||typeof model!=='object'||Array.isArray(model))throw new TypeError('Kostenmodell fehlt');
    if(model.schema!=='tba.office.kosten.v0.1')throw new TypeError('Unbekannte Modellversion');
    if(!hasText(model.projectId))throw new TypeError('Projekt-ID fehlt');
    if(model.purpose!=='kostenberechnung')throw new TypeError('Nur Kostenberechnung, keine Honorarermittlung');
    if(model.currency!=='EUR'||model.taxBasis!=='net')throw new TypeError('Nur EUR netto; Steuern werden nicht berechnet');
    if(!model.classification||!hasText(model.classification.system)||!hasText(model.classification.edition))
      throw new TypeError('Kostengliederung und Normstand fehlen');
    if(!Array.isArray(model.positions))throw new TypeError('Positionen müssen eine Liste sein');
  }
  function calculate(model){
    modelGuard(model);
    const ids=new Set(), groups=new Map(), result=[], issues=[];
    let subtotal=0n,incomplete=0;
    if(model.positions.length===0)issues.push({positionId:null,code:'no_positions'});
    for(const pos of model.positions){
      if(!pos||typeof pos!=='object'||Array.isArray(pos)||!hasText(pos.id)||ids.has(pos.id))
        throw new TypeError('Positionen benötigen eindeutige IDs');
      ids.add(pos.id);
      if(!hasText(pos.label))throw new TypeError('Positionsbezeichnung fehlt: '+pos.id);
      const local=[];
      const group=hasText(pos.groupCode)?pos.groupCode.trim():null;
      if(!group)local.push('missing_group');
      const hasQuantity=pos.quantity!==null&&pos.quantity!==undefined;
      const hasPrice=pos.unitPriceEur!==null&&pos.unitPriceEur!==undefined;
      if(hasQuantity&&!hasText(pos.unit))local.push('missing_unit');
      if(!hasQuantity)local.push('missing_quantity');
      if(!hasPrice)local.push('missing_unit_price');
      if(hasQuantity&&!validSource(pos.quantitySource))local.push('missing_quantity_source');
      if(hasPrice&&!validSource(pos.priceSource))local.push('missing_price_source');
      if(hasPrice&&!(typeof pos.priceDate==='string'&&isoDate.test(pos.priceDate)&&
        !Number.isNaN(Date.parse(pos.priceDate+'T00:00:00Z'))&&
        new Date(pos.priceDate+'T00:00:00Z').toISOString().slice(0,10)===pos.priceDate))
        local.push('missing_or_invalid_price_date');
      // Ungültige Zahlen sind Vertragsfehler. Leere Zahlen dürfen NIE als Null gelten.
      const quantity=hasQuantity?decimal4(pos.quantity,'Menge '+pos.id):null;
      const price=hasPrice?decimal4(pos.unitPriceEur,'Einheitspreis '+pos.id):null;
      const amount=hasQuantity&&hasPrice?(quantity*price+DIVISOR/2n)/DIVISOR:null;
      if(amount!==null)subtotal+=amount;
      if(local.length)incomplete++;
      for(const code of local)issues.push({positionId:pos.id,code});
      const summary={id:pos.id,groupCode:group,amountCents:amount===null?null:String(amount),
        status:local.length?'incomplete':'ready',issues:local};
      result.push(summary);
      const groupKey=group;
      if(!groups.has(groupKey))groups.set(groupKey,{code:group,knownSubtotalCents:0n,incomplete:0});
      const g=groups.get(groupKey);
      if(amount!==null)g.knownSubtotalCents+=amount;
      if(local.length)g.incomplete++;
    }
    return {
      schema:'tba.office.kosten.result.v0.1',projectId:model.projectId,purpose:model.purpose,
      classification:{system:model.classification.system,edition:model.classification.edition},
      currency:'EUR',taxBasis:'net',status:(incomplete||issues.length)?'incomplete':'ready',
      knownSubtotalCents:String(subtotal),totalCents:(incomplete||issues.length)?null:String(subtotal),
      incompleteCount:incomplete,issues,positions:result,
      groups:[...groups.values()].map(g=>({code:g.code,knownSubtotalCents:String(g.knownSubtotalCents),
        totalCents:g.incomplete?null:String(g.knownSubtotalCents),incompleteCount:g.incomplete}))
    };
  }
  return {calculate,decimal4};
});
