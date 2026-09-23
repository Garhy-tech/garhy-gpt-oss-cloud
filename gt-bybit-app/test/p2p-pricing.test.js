import test from 'node:test';
import assert from 'node:assert/strict';
import {isExplicitPromotion,subtractDecimal,selectFirstNonPromotedCompetitor} from '../lib/p2p-pricing.js';

test('monitor skips own and explicitly promoted ads without reordering',()=>{
  const ads=[
    {itemId:'mine',price:'50.00'},
    {itemId:'promo',price:'49.99',isPromoted:true},
    {itemId:'organic-1',price:'49.98'},
    {itemId:'organic-2',price:'49.95'},
  ];
  assert.equal(selectFirstNonPromotedCompetitor(ads,'mine').itemId,'organic-1');
  assert.equal(isExplicitPromotion({rankType:'PROMOTED'}),true);
});

test('target subtracts exactly 0.01 without floating point drift',()=>{
  assert.equal(subtractDecimal('50.00','0.01'),'49.99');
  assert.equal(subtractDecimal('50.123','0.01'),'50.113');
  assert.equal(subtractDecimal('0.01','0.01'),null);
});
