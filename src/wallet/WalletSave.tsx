import { useState } from 'react';
import { DAppKitProvider, useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { dAppKit } from './dapp-kit';

export type WalletSaveProps = {
  expectedAddress: string;
  disabled: boolean;
  /** Builds the exact text to sign for the decision as it stands now. */
  getMessage: () => Promise<string>;
  /** Called with the wallet's signature; saves the decision. */
  onSignature: (signature: string) => Promise<void>;
};

const short = (v: string) => (v.length > 16 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v);

function Panel({ expectedAddress, disabled, getMessage, onSignature }: WalletSaveProps) {
  const account = useCurrentAccount();
  const kit = useDAppKit();
  const [state, setState] = useState<'idle' | 'signing' | 'saving'>('idle');
  const [error, setError] = useState('');
  const expected = expectedAddress.toLowerCase();
  const connected = account?.address?.toLowerCase();

  async function signAndSave() {
    setError('');
    try {
      setState('signing');
      const message = await getMessage();
      const { signature } = await kit.signPersonalMessage({ message: new TextEncoder().encode(message) });
      setState('saving');
      await onSignature(signature);
    } catch (e) {
      const text = (e as Error)?.message || 'Signing was cancelled.';
      setError(/reject|cancel|denied/i.test(text) ? 'Signing was cancelled in the wallet. Nothing was saved.' : text);
    } finally { setState('idle'); }
  }

  return <div className="ws-panel">
    {!account && <>
      <p className="ws-note">Connect the wallet you are reviewing. You sign a short message to prove it is yours; nothing is paid or sent.</p>
      <ConnectButton/>
    </>}
    {account && connected !== expected && <>
      <p className="ws-note ws-warn">Connected wallet {short(account.address)} is not the wallet under review ({short(expectedAddress)}). Switch to that account in your wallet, or review your connected wallet instead.</p>
      <ConnectButton/>
    </>}
    {account && connected === expected && <div className="ws-ready">
      <span className="ws-chip"><span className="ws-dot"/>Signed in as {short(account.address)}</span>
      <button type="button" className="sm-button primary" disabled={disabled || state !== 'idle'} onClick={signAndSave}>
        {state === 'signing' ? 'Waiting for your wallet…' : state === 'saving' ? 'Saving to Walrus…' : 'Sign and save to Walrus'}
      </button>
    </div>}
    {error && <p className="ws-error" role="alert">{error}</p>}
  </div>;
}

export default function WalletSave(props: WalletSaveProps) {
  return <DAppKitProvider dAppKit={dAppKit}><Panel {...props}/></DAppKitProvider>;
}
