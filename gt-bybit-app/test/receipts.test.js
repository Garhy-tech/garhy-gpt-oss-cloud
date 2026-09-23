import test from 'node:test';
import assert from 'node:assert/strict';
import {createReceipt,sanitizeReceiptValue} from '../lib/receipts.js';

test('receipt strips secrets and emits a valid PDF',()=>{
  const receipt=createReceipt({
    channel:'BYBIT',
    action:'transfer',
    requestId:'11111111-1111-4111-8111-111111111111',
    request:{coin:'USDT',amount:'10',apiKey:'SECRET',controlToken:'SECRET',confirmed:true},
    result:{transferId:'abc',status:'SUCCESS',secret:'SECRET'},
    now:1700000000000,
  });
  assert.equal(receipt.request.coin,'USDT');
  assert.equal(receipt.request.amount,'10');
  assert.equal('apiKey' in receipt.request,false);
  assert.equal('controlToken' in receipt.request,false);
  assert.equal('confirmed' in receipt.request,false);
  assert.equal('secret' in receipt.result,false);
  assert.match(receipt.receiptId,/^GTB-/);
  assert.match(receipt.integrity,/^[0-9a-f]{64}$/);
  const pdf=Buffer.from(receipt.pdf.base64,'base64');
  assert.equal(pdf.subarray(0,8).toString('latin1'),'%PDF-1.4');
  assert.ok(pdf.length>800);
});

test('sanitizer keeps financial fields and removes auth data',()=>{
  assert.deepEqual(
    sanitizeReceiptValue({tokenId:'USDT',api_secret:'x',authorization:'Bearer x',price:'49.99'}),
    {tokenId:'USDT',price:'49.99'},
  );
});
