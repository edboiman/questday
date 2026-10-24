import { useEffect, useState } from 'react';
import type { PurchaseOutcome } from '../billing/types';
import { FEATURE_TITLE, PREMIUM_PERKS, PREMIUM_PRICE_FALLBACK } from '../domain/premium';
import { useStore } from '../state/store';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

/*
 * The paywall. Shown only when someone taps a Premium feature (never on its
 * own). One-time purchase, no subscription. Every store outcome has a plain,
 * honest message; "cancelled" shows nothing because closing the sheet is not
 * an error.
 */
function message(o: PurchaseOutcome | null): { tone: 'ok' | 'warn' | 'error'; text: string } | null {
  if (!o) return null;
  switch (o.kind) {
    case 'purchased':
    case 'cancelled':
      return null;
    case 'pending':
      return { tone: 'warn', text: 'Your payment is pending with Google. Premium unlocks by itself as soon as it’s confirmed. You can keep playing meanwhile.' };
    case 'offline':
      return { tone: 'warn', text: 'You’re offline. Connect to the internet to buy or restore Premium. Nothing was charged.' };
    case 'nothing-to-restore':
      return { tone: 'warn', text: 'No Premium purchase was found on this Google account. If you bought it with another account, switch accounts in the Play Store and try again.' };
    case 'unavailable':
      return { tone: 'error', text: o.reason === 'web' ? 'Premium is bought in the QuestAday app on Google Play. This web version can’t take payments.' : o.reason };
    case 'error':
      return { tone: 'error', text: o.message };
  }
}

export function Paywall() {
  const { paywall, act, billing, premium } = useStore();
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [outcome, setOutcome] = useState<PurchaseOutcome | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (paywall) setOutcome(null);
  }, [paywall]);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  // Bought elsewhere while open (pending payment confirmed, restore on another screen): close.
  useEffect(() => {
    if (premium && paywall) act.closePaywall();
  }, [premium, paywall, act]);

  const run = async (kind: 'buy' | 'restore') => {
    if (busy) return;
    setBusy(kind);
    setOutcome(null);
    try {
      setOutcome(kind === 'buy' ? await act.buyPremium() : await act.restorePremium());
    } finally {
      setBusy(null);
    }
  };

  const msg = message(outcome) ?? (!billing.canPurchase ? message({ kind: 'unavailable', reason: 'web' }) : !online ? message({ kind: 'offline' }) : null);
  const price = billing.offer?.priceString ?? PREMIUM_PRICE_FALLBACK;

  return (
    <Dialog open={paywall !== null} onClose={act.closePaywall} title={paywall ? FEATURE_TITLE[paywall] : ''}>
      {paywall && (
        <div className="paywall stack">
          <div className="paywall-seal" aria-hidden="true">
            <Icon name="star" size={34} />
          </div>
          <p className="center">
            {paywall !== 'general' && (
              <>
                <strong>QuestAday Premium</strong>
                <br />
              </>
            )}
            <span className="muted small">One payment of {price}. Yours to keep. No subscription, no ads.</span>
          </p>
          <ul className="perks small">
            {PREMIUM_PERKS.map((p) => (
              <li key={p.feature} className={p.feature === paywall ? 'highlight' : undefined}>
                {p.text}
              </li>
            ))}
          </ul>
          {msg && (
            <p className={`note ${msg.tone === 'ok' ? '' : 'warn'}`} role="status">
              {msg.text}
            </p>
          )}
          {billing.canPurchase && (
            <button type="button" className="btn gold" data-autofocus disabled={busy !== null || !online} onClick={() => void run('buy')}>
              {busy === 'buy' ? 'Opening Google Play…' : `Unlock Premium · ${price}`}
            </button>
          )}
          {billing.canPurchase && (
            <button type="button" className="btn" disabled={busy !== null || !online} onClick={() => void run('restore')}>
              {busy === 'restore' ? 'Checking your purchases…' : 'Restore purchase'}
            </button>
          )}
          {__QA_ADMIN__ && !billing.canPurchase && <p className="muted small">Personal build: preview Premium with Admin tools in Settings.</p>}
          <button type="button" className="btn" data-autofocus={!billing.canPurchase || undefined} onClick={act.closePaywall}>
            Not now
          </button>
          <p className="muted small center">Payment is handled by Google Play. QuestAday never sees your card details.</p>
        </div>
      )}
    </Dialog>
  );
}
