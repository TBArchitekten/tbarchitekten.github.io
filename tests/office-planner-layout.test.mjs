// The Office Planner uses Window's Planner layout unchanged (as in Isabella's Planner).
// Office rules that size the board, the Buckets or their card area broke «Liste» on phones
// (column width became the Bucket height) and hid cards in landscape. They must not return.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('office.css leaves board, Bucket and card-area sizing to Window',()=>{
  const css=read('app/office.css');
  for(const sel of ['.work-board','.work-bucket','.work-bucket-scroll']){
    const esc=sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const rules=[...css.matchAll(new RegExp(esc+'\\s*\\{([^}]*)\\}','g'))].map(m=>m[1]);
    for(const body of rules)
      assert.doesNotMatch(body,/(^|;)\s*(flex|flex-basis|height|max-height|min-height|overflow|overflow-y)\s*:/,
        'office.css must not size '+sel+': '+body);
  }
});

test('Window list mode and desktop rules that the Office relies on are still present',()=>{
  assert.match(read('app/mobile-refinement.css'),/\.app \.work-board\.mobile-stack \.work-bucket\{[^}]*height:auto/);
  assert.match(read('app/mobile-refinement.css'),/\.app \.work-board\.mobile-stack \.work-bucket-scroll\{[^}]*overflow:visible/);
  assert.match(read('app/app.css'),/\.work-bucket-scroll\{flex:none!important;min-height:0!important;max-height:none!important;overflow:visible!important\}/);
  assert.match(read('app/index.html'),/office\.css\?v=office42/);
});
