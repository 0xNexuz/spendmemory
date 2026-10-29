import { useState } from 'react';
import { DAppKitProvider, useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { dAppKit } from './dapp-kit';

export type WalletSaveProps = {
  expectedAddress: string;
  disabled: boolean;
  /** Button text once the right wallet is connected. */
  actionLabel?: string;
  /** Shown while the server works after the wallet has signed. */
  workingLabel?: string;
  /** Shown before a wallet is connected. */
  intro?: string;
  /** Builds the exact text to sign for the decision as it stands now. */
  getMessage: () => Promise<string>;
  /** Called with the wallet's signature and the bytes it signed. Throw to show an error here. */
  onSignature: (signature: string, signedBytes: string) => Promise<void>;
};

const WALLET_TIMEOUT_MS = 120_000;
const short = (v: string) => (v.length > 16 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v);

class WalletTimeout extends Error {}
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => { timer = window.setTimeout(() => reject(new WalletTimeout()), ms); }),
  ]).finally(() => window.clearTimeout(timer));
}

function Panel({ expectedAddress, disabled, actionLabel = 'Sign and save to Walrus', workingLabel = 'Saving to Walrus…', intro = 'Connect the wallet you are reviewing. You sign a short message to prove it is yours; nothing is paid or sent.', getMessage, onSignature }: WalletSaveProps) {
  const account = useCurrentAccount();
  const kit = useDAppKit();
  const [state, setState] = useState<'idle' | 'signing' | 'saving'>('idle');
  const [error, setError] = useState('');
  const expected = expectedAddress.toLowerCase();
  const connected = account?.address?.toLowerCase();

  async function signAndSave() {
    setError('');
    let signed: { signature: string; bytes: string };
    try {
      setState('signing');
      const message = await getMessage();
      signed = await withTimeout(kit.signPersonalMessage({ message: new TextEncoder().encode(message) }), WALLET_TIMEOUT_MS);
    } catch (e) {
      setState('idle');
      if (e instanceof WalletTimeout) { setError('No answer from your wallet after 2 minutes. Open the wallet extension to approve the request, or try again.'); return; }
      const text = (e as Error)?.message || 'Signing was cancelled.';
      setError(/reject|cancel|denied|declin/i.test(text) ? 'Signing was cancelled in the wallet. Nothing was saved or shown.' : `Your wallet could not sign: ${text}`);
      return;
    }
    try {
      setState('saving');
      await onSignature(signed.signature, signed.bytes);
    } catch (e) {
      setError((e as Error)?.message || 'The server could not use that signature.');
    } finally { setState('idle'); }
  }

  async function disconnect() {
    setError('');
    try { await kit.disconnectWallet(); } catch (e) { setError((e as Error)?.message || 'Could not disconnect.'); }
  }

  const busy = state !== 'idle';
  return <div className="ws-panel">
    {!account && <>
      <p className="ws-note">{intro}</p>
      <ConnectButton/>
    </>}
    {account && connected !== expected && <>
      <p className="ws-note ws-warn">Connected wallet {short(account.address)} is not the wallet under review ({short(expectedAddress)}). Switch to that account in your wallet, or disconnect and connect the right one.</p>
      <div className="ws-ready">
        <ConnectButton/>
        <button type="button" className="ws-link" onClick={disconnect}>Disconnect</button>
      </div>
    </>}
    {account && connected === expected && <div className="ws-ready">
      <span className="ws-chip"><span className="ws-dot"/>Signed in as {short(account.address)}</span>
      <button type="button" className="sm-button primary" disabled={disabled || busy} onClick={signAndSave}>
        {state === 'signing' ? 'Waiting for your wallet…' : state === 'saving' ? workingLabel : actionLabel}
      </button>
      <button type="button" className="ws-link" disabled={busy} onClick={disconnect}>Disconnect</button>
    </div>}
    {state === 'signing' && <p className="ws-note" role="status">Approve the request in your wallet. If no window opened, click the wallet extension's icon.</p>}
    {state === 'saving' && <p className="ws-note" role="status">Signed. Checking the signature and sending the decision to Walrus…</p>}
    {error && <p className="ws-error" role="alert">{error}</p>}
  </div>;
}

export default function WalletSave(props: WalletSaveProps) {
  return <DAppKitProvider dAppKit={dAppKit}><Panel {...props}/></DAppKitProvider>;
}
