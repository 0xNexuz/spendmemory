import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Fingerprint, ShieldCheck, Wallet } from 'lucide-react';
import './live-app.css';

type Match = { blobId: string; decision: string; reason: string; createdAt: string };
type Evaluation = { recommendation: string; reasons: string[]; balanceSui: string | null; chainVerified: boolean; memoryVerified: boolean; matchedMemories: Match[]; chainError: string | null; memoryError: string | null };
type Entry = { id: string; merchant: string; category: string; amountSui: string; walletAddress: string; createdAt: string; evaluation: Evaluation; ticket: string; state: 'open' | 'pending' | 'confirmed' | 'failed'; decision?: string; reason?: string; jobId?: string; blobId?: string };
type Status = { network: string; memoryCount: number; maxMemories: number; maxReviewSui: string };
const STORAGE = 'spendmemory-public-reviews-v1';

async function request<T>(action: string, body?: unknown, extra = ''): Promise<T> {
  const response = await fetch(`/api/route?action=${action}${extra}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function LiveApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [entries, setEntries] = useState<Entry[]>(() => { try { return JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { return []; } });
  const [selectedId, setSelectedId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Software');
  const [amountSui, setAmountSui] = useState('0.02');
  const [walletAddress, setWalletAddress] = useState('');
  const [decision, setDecision] = useState<'approve' | 'decline'>('decline');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const selected = entries.find(e => e.id === selectedId) || entries[0];

  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(entries)); }, [entries]);
  useEffect(() => { request<Status>('status').then(setStatus).catch(e => setError(e.message)); }, []);

  function replace(entry: Entry) { setEntries(previous => { const next = [entry, ...previous.filter(item => item.id !== entry.id)]; localStorage.setItem(STORAGE, JSON.stringify(next)); return next; }); setSelectedId(entry.id); }

  async function evaluate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await request<{ proposal: Omit<Entry, 'evaluation' | 'ticket' | 'state'>; evaluation: Evaluation; ticket: string }>('evaluate', { merchant, category, amountSui, walletAddress });
      replace({ ...result.proposal, evaluation: result.evaluation, ticket: result.ticket, state: 'open' });
      setNotice('Live Tatum and Walrus checks completed. Review the evidence before deciding.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function checkJob(entry: Entry) {
    if (!entry.jobId) return;
    setBusy(true); setError('');
    try {
      const job = await request<{ status: string; blobId: string | null; error: string | null }>('memory-status', undefined, `&jobId=${encodeURIComponent(entry.jobId)}`);
      if (job.status === 'done' && job.blobId) { replace({ ...entry, state: 'confirmed', blobId: job.blobId }); setNotice(`Confirmed on Walrus Mainnet: ${job.blobId}`); request<Status>('status').then(setStatus).catch(() => {}); }
      else if (job.status === 'failed') { replace({ ...entry, state: 'failed' }); setError(job.error || 'Walrus write failed.'); }
      else setNotice(`Walrus write is ${job.status}. Check again shortly.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function saveDecision() {
    if (!selected || selected.state !== 'open') return;
    setBusy(true); setError(''); setNotice('');
    const pending: Entry = { ...selected, state: 'pending', decision, reason };
    replace(pending);
    try {
      const result = await request<{ jobId: string }>('remember', { ticket: selected.ticket, decision, reason });
      replace({ ...pending, jobId: result.jobId });
      setNotice('Walrus accepted the write. Check status until it returns a confirmed blob ID.');
    } catch (e) { setError(`${(e as Error).message} Write outcome may be uncertain. Create a new proposal only after checking the Walrus account.`); } finally { setBusy(false); }
  }

  return <div className="live-shell"><header className="live-header"><div className="live-brand"><Fingerprint size={23}/> Spend<span>Memory</span></div><nav><a href="/?replay=1">Verified replay</a><a href="https://github.com/0xNexuz/spendmemory" target="_blank" rel="noreferrer">GitHub <ArrowRight size={15}/></a></nav></header>
    <main className="live-main"><section className="live-hero"><div className="live-eyebrow">WALRUS × TATUM · LIVE MAINNET APP</div><h1>Review payments with memory.</h1><p>Check a Sui wallet through Tatum, recall decisions from Walrus, and make your own call. This app never sends payments.</p><div className="live-stats"><div><strong>{status?.memoryCount ?? '…'}</strong><span>confirmed Mainnet memories</span></div><div><strong>{status ? Math.max(0, 50 - status.memoryCount) : '…'}</strong><span>to the 50-memory goal</span></div><div><strong>{status?.maxMemories ?? '…'}</strong><span>public demo write cap</span></div></div></section>
      {error && <div className="live-alert error" role="alert">{error}</div>}{notice && <div className="live-alert">{notice}</div>}
      <section className="live-grid"><form onSubmit={evaluate} className="live-card"><div className="live-card-label"><Wallet size={18}/> 01 · CREATE A REVIEW</div><h2>Payment proposal</h2><p>Use a public Sui address. Merchant and category are labels, not an order or a payment.</p><label>Merchant<input required minLength={2} maxLength={80} value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="Example: Cloud subscription"/></label><label>Category<input required minLength={2} maxLength={50} value={category} onChange={e => setCategory(e.target.value)}/></label><label>Amount (SUI)<input required inputMode="decimal" value={amountSui} onChange={e => setAmountSui(e.target.value)}/></label><label>Public Sui wallet address<input required value={walletAddress} onChange={e => setWalletAddress(e.target.value)} placeholder="0x…"/></label><button disabled={busy} className="live-button" type="submit">{busy ? 'Checking…' : 'Check with Tatum + Walrus'} <ArrowRight size={17}/></button></form>
        <div className="live-card"><div className="live-card-label"><ShieldCheck size={18}/> 02 · REVIEW THE EVIDENCE</div>{selected ? <><h2>{selected.merchant}</h2><p>{selected.category} · {selected.amountSui} SUI</p><div className={`live-recommendation ${selected.evaluation.recommendation}`}>{selected.evaluation.recommendation.toUpperCase()}</div><div className="live-facts"><div><span>Tatum balance</span><strong>{selected.evaluation.chainVerified ? `${selected.evaluation.balanceSui} SUI` : 'Unverified'}</strong></div><div><span>Walrus recall</span><strong>{selected.evaluation.memoryVerified ? `${selected.evaluation.matchedMemories.length} matching` : 'Unverified'}</strong></div></div><ul>{selected.evaluation.reasons.map((item, i) => <li key={i}>{item}</li>)}</ul>{selected.evaluation.chainError && <small>Tatum: {selected.evaluation.chainError}</small>}{selected.evaluation.memoryError && <small>Walrus: {selected.evaluation.memoryError}</small>}{selected.state === 'open' && <div className="live-decision"><label>Decision<select value={decision} onChange={e => setDecision(e.target.value as 'approve' | 'decline')}><option value="decline">Decline</option><option value="approve">Approve</option></select></label><label>Reason<textarea required minLength={8} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why did you make this decision?"/></label><button className="live-button" disabled={busy || !selected.evaluation.memoryVerified} onClick={saveDecision} type="button">Save decision to Walrus <ArrowRight size={17}/></button></div>}{selected.state === 'pending' && (selected.jobId ? <button className="live-button" disabled={busy} onClick={() => checkJob(selected)} type="button">Check write status <ArrowRight size={17}/></button> : <p>Write outcome uncertain. Check the Walrus account before making another proposal.</p>)}{selected.state === 'confirmed' && <div className="live-confirmed"><CheckCircle2 size={19}/> Confirmed blob <code>{selected.blobId}</code></div>}{selected.state === 'failed' && <p>Write failed. Make a new proposal before trying again.</p>}</> : <div className="live-empty">Create a proposal to see live Tatum data and Walrus memory.</div>}</div></section>
      <section className="live-card live-history"><div className="live-card-label">03 · THIS BROWSER'S REVIEWS</div>{entries.length ? entries.map(entry => <button type="button" key={entry.id} onClick={() => setSelectedId(entry.id)}><span>{entry.merchant}<small>{entry.category} · {entry.amountSui} SUI</small></span><strong>{entry.state}</strong></button>) : <p>No reviews in this browser yet.</p>}</section><footer className="live-footer">This is a shared public demo. Confirmed decisions are stored in one Walrus Memory account; browser proposal history stays on this device. Do not enter private financial information or wallet keys.</footer></main></div>;
}
