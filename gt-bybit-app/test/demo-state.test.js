import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_ACCOUNT_BALANCE, formatDemoAccountBalance, isDemoFinancialMode } from '../gt-bybit/demo-state.js';

test('demo balance has one centralized source of truth and stable formatting',()=>{
  assert.equal(DEMO_ACCOUNT_BALANCE,3860);
  assert.equal(formatDemoAccountBalance(),'3,860.00 USD');
});

test('demo financial mode is never inferred for production and is explicit elsewhere',()=>{
  assert.equal(isDemoFinancialMode({VERCEL_ENV:'production'}),false);
  assert.equal(isDemoFinancialMode({VERCEL_ENV:'production',GT_FINANCIAL_DATA_MODE:'live'}),false);
  assert.equal(isDemoFinancialMode({VERCEL_ENV:'preview'}),true);
  assert.equal(isDemoFinancialMode({VERCEL_ENV:'development'}),true);
  assert.equal(isDemoFinancialMode({GT_APP_MODE:'staging'}),true);
  assert.equal(isDemoFinancialMode({GT_APP_MODE:'ui-testing'}),true);
  assert.equal(isDemoFinancialMode({}),false);
});
