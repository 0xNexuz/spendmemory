import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, PenLine, RefreshCw, Wallet } from 'lucide-react';

type Proof = { blobId: string; decision: 'approve' | 'decline'; category: string | null; createdAt: string | null; walletBound: boolean; signed: boolean; payment: { digest: string; checkpoint: number | string | null } | null };

const short = (v: string) => (v.length > 20 ? `${v.slice(0, 8)}…${v.slice(-6)}` : v);
const day = (v: string | null) => {
  if (!v) return 'Undated';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'Undated' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Every genuine decision saved through the live app, read live from Walrus, with the facts anyone can check. */
export function ProofList() {
  const [proofs, setProofs] = useState<Proof[] | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  async function load() {
    setError('');
    try {
      const response = await fetch('/api/route?action=proofs');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setProofs(data.proofs);
    } catch (e) { setError((e as Error).message); setProofs((p) => p ?? []); }
  }
  useEffect(() => { load(); }, []);

  async function copy(id: string) {
    try { await navigator.clipboard.writeText(id); setCopied(id); window.setTimeout(() => setCopied(''), 1800); } catch { /* clipboard unavailable */ }
  }

  const verified = proofs?.filter((p) => p.payment).length ?? 0;

  return <section className="sm-section" id="ledger">
    <div className="sm-section-head">
      <div>
        <h2>Every decision since</h2>
        <p>Genuine decisions saved through the live app, read live from Walrus Mainnet. Names and reasons stay private; the blob ID, the outcome and any payment Tatum verified are public.</p>
      </div>
      {proofs && <p className="pl-tally"><strong>{proofs.length}</strong> saved{verified ? <>, <strong>{verified}</strong> with a verified payment</> : null}</p>}
    </div>

    {proofs === null && <div className="pl-empty"><RefreshCw className="pl-spin" size={18}/> Reading the ledger from Walrus…</div>}
    {error && <div className="pl-empty error">Could not read the ledger: {error} <button type="button" className="sm-button ink small" onClick={load}>Try again</button></div>}
    {proofs && !error && proofs.length === 0 && <div className="pl-empty">No visitor decisions yet. <a href="/#review">Save the first one in the live app</a> and it appears here.</div>}

    {proofs && proofs.length > 0 && <ol className="pl-ledger">
      {proofs.map((p, i) => <li key={p.blobId} style={{ ['--i' as string]: Math.min(i, 12) } as React.CSSProperties}>
        <span className="pl-date">{day(p.createdAt)}</span>
        <span className={`pl-stamp ${p.decision}`}>{p.decision === 'approve' ? 'Approved' : 'Declined'}</span>
        <span className="pl-cat">{p.category || 'Uncategorised'}</span>
        <button type="button" className="pl-blob" onClick={() => copy(p.blobId)} title={`Copy blob ID ${p.blobId}`}>
          <code>{short(p.blobId)}</code>{copied === p.blobId ? <Check size={14}/> : <Copy size={14}/>}
        </button>
        <span className="pl-badges">
          {p.signed && <span className="pl-badge signed" title="Signed by the reviewed wallet"><PenLine size={13}/> Signed</span>}
          {p.payment
            ? <a className="pl-badge paid" href={`https://suiscan.xyz/mainnet/tx/${p.payment.digest}`} target="_blank" rel="noreferrer" title="Payment verified by Tatum, open on Suiscan"><Wallet size={13}/> Payment verified <ArrowUpRight size={13}/></a>
            : !p.signed && <span className="pl-badge">User-reported</span>}
        </span>
      </li>)}
    </ol>}
  </section>;
}
