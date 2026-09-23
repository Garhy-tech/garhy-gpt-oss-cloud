export const DEMO_ACCOUNT_BALANCE = 3860;

const DEMO_APP_MODES = new Set(['demo','preview','development','staging','ui-testing','test']);

export function formatDemoAccountBalance() {
  return `${new Intl.NumberFormat('en-US',{
    minimumFractionDigits:2,
    maximumFractionDigits:2,
    useGrouping:true,
  }).format(DEMO_ACCOUNT_BALANCE)} USD`;
}

export function isDemoFinancialMode(env = {}) {
  const vercelEnv=String(env.VERCEL_ENV || '').toLowerCase();
  if(vercelEnv === 'production') return false;
  if(vercelEnv === 'preview' || vercelEnv === 'development') return true;
  const appMode=String(env.GT_APP_MODE || env.GT_FINANCIAL_DATA_MODE || '').toLowerCase();
  if(DEMO_APP_MODES.has(appMode)) return true;
  return String(env.NODE_ENV || '').toLowerCase() === 'development' || String(env.GT_DEMO_MODE || '').toLowerCase() === 'true';
}
