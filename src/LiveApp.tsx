import { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Github, RefreshCw, X } from 'lucide-react';
import { MemoryArtwork } from './art/MemoryArtwork';
import { StippleMark } from './art/StippleMark';
import { SiteFooter } from './SiteFooter';
import { useActiveSection, useScrolled } from './useActiveSection';
import './public-demo.css';
import './live-app.css';

type Match = { blobId: string; decision: string; reason: string; createdAt: string };
type Payment = { digest: string; checked: boolean; succeeded?: boolean; walletPaid?: boolean; matches?: boolean; walletChangeSui?: string; checkpoint?: number | string | null; error: string | null };
type Evaluation = { recommendation: string; reasons: string[]; balanceSui: string | null; chainVerified: boolean; memoryVerified: boolean; matchedMemories: Match[]; chainError: string | null; memoryError: string | null ; payment?: Payment | null };
type Entry = { id: string; merchant: string; category: string; amountSui: string; walletAddress: string; createdAt: string; evaluation: Evaluation; ticket: string; state: 'open' | 'pending' | 'confirmed' | 'failed'; decision?: string; reason?: string; jobId?: string; blobId?: string };
type Status = { network: string; memoryCount: number; demoMemoryCount: number; totalMemoryCount: number; maxMemories: number; maxReviewSui: string };
const STORAGE = 'spendmemory-public-reviews-v1';
const repoUrl = 'https://github.com/0xNexuz/spendmemory';

const VERDICT: Record<string, string> = { review: 'Review manually', consider: 'Consider approval', decline: 'Decline or investigate' };
const STATE: Record<Entry['state'], string> = { open: 'Open', pending: 'Saving', confirmed: 'Memory saved', failed: 'Write failed' };
const shortId = (v: string) => (v.length > 22 ? `${v.slice(0, 10)}…${v.slice(-8)}` : v);

async function request<T>(action: string, body?: unknown, extra = ''): Promise<T> {
  const response = await fetch(`/api/route?action=${action}${extra}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function readEntries(): Entry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '[]'); } catch { return []; }
}
function writeEntries(entries: Entry[]) {
  try { localStorage.setItem(STORAGE, JSON.stringify(entries)); } catch { /* storage unavailable: history stays in memory */ }
}

export function LiveApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [entries, setEntries] = useState<Entry[]>(readEntries);
  const [selectedId, setSelectedId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Software');
  const [amountSui, setAmountSui] = useState('0.02');
  const [walletAddress, setWalletAddress] = useState('');
  const [txDigest, setTxDigest] = useState('');
  const [decision, setDecision] = useState<'approve' | 'decline'>('decline');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const selected = entries.find((e) => e.id === selectedId) || entries[0];
  const scrolled = useScrolled(12);
  const section = useActiveSection(['top', 'review', 'history'], 'top');

  useEffect(() => { writeEntries(entries); }, [entries]);
  useEffect(() => { request<Status>('status').then(setStatus).catch((e) => setError(e.message)); }, []);

  function replace(entry: Entry) {
    setEntries((previous) => { const next = [entry, ...previous.filter((item) => item.id !== entry.id)]; writeEntries(next); return next; });
    setSelectedId(entry.id);
  }

  async function evaluate(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await request<{ proposal: Omit<Entry, 'evaluation' | 'ticket' | 'state'>; evaluation: Evaluation; ticket: string }>('evaluate', { merchant, category, amountSui, walletAddress, txDigest: txDigest.trim() || undefined });
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

  const demoCount = status?.demoMemoryCount;

  return <main className="sm-page lv-page">
    <header className={`sm-header${scrolled ? ' is-stuck' : ''}`}>
      <div className="sm-header-inner">
        <a className="sm-brand" href="#top" aria-label="SpendMemory, back to top"><StippleMark/><span>SpendMemory</span></a>
        <nav className="sm-nav" aria-label="Page">
          <a href="#review" aria-current={section === 'review' ? 'location' : undefined}>Review</a>
          <a href="#history" aria-current={section === 'history' ? 'location' : undefined}>History</a>
          <a href="/?replay=1">Replay</a>
          <a className="sm-nav-repo" href={repoUrl} target="_blank" rel="noreferrer" aria-label="Source on GitHub"><Github size={16}/><span>Source</span></a>
        </nav>
      </div>
    </header>

    <section className="sm-hero lv-hero" id="top">
      <h1>Review payments with memory</h1>
      <div className="sm-hero-side">
        <p>Check a Sui wallet through Tatum, recall past decisions from Walrus, and make your own call. Every decision you save becomes memory for the next review. This app never sends payments.</p>
        <div className="sm-actions">
          <a href="#review" className="sm-button primary">Start a review <ArrowRight size={17}/></a>
          <a href="/?replay=1" className="sm-button ink">See the verified replay</a>
        </div>
      </div>
    </section>

    <figure className="sm-art"><MemoryArtwork/></figure>

    <section className="sm-ledger" aria-label="Live memory count">
      <dl>
        <div><dt>Visitor decision memories</dt><dd><strong>{status?.memoryCount ?? '…'}</strong><span>All wallets combined, read live from Walrus. Each wallet only learns from its own.</span></dd></div>
        <div><dt>Test memories (confirmed Mainnet writes)</dt><dd><strong>{demoCount ?? '…'}</strong><span>Created during testing with example decisions. Real Walrus writes with confirmed blob IDs; excluded from visitor recommendations.</span></dd></div>
        <div><dt>Public write cap</dt><dd><strong>{status?.maxMemories ?? '…'}</strong><span>Evaluation stays open after the cap.</span></dd></div>
      </dl>
    </section>

    {(error || notice) && <div className="lv-alerts">
      {error && <div className="lv-alert error" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
      {notice && <div className="lv-alert" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16}/></button></div>}
    </div>}

    <section className="sm-section" id="review">
      <div className="sm-section-head"><div><h2>Review a payment</h2><p>Memory is kept per wallet: only decisions saved for the Sui address you enter shape its review. Merchant and category are labels, not an order or a payment.</p></div></div>
      <div className="lv-grid">
        <form onSubmit={evaluate} className="sm-sheet lv-form">
          <span className="sm-tape" aria-hidden="true"/>
          <p className="sm-sheet-kind">Step 1</p>
          <h3>Payment proposal</h3>
          <div className="lv-fields">
            <label>Merchant<input required minLength={2} maxLength={80} value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Example: Cloud subscription"/></label>
            <label>Category<input required minLength={2} maxLength={50} value={category} onChange={(e) => setCategory(e.target.value)}/></label>
            <label>Amount in SUI<input required inputMode="decimal" value={amountSui} onChange={(e) => setAmountSui(e.target.value)}/></label>
            <label className="wide">Public Sui wallet address<input required value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="0x…" spellCheck={false}/></label>
            <label className="wide"><span>Payment transaction digest <span className="lv-optional">optional</span></span><input value={txDigest} onChange={(e) => setTxDigest(e.target.value)} placeholder="Already paid? Paste the Sui transaction digest" spellCheck={false}/><small className="lv-hint">Tatum checks that this wallet paid exactly the amount above. A matching payment is saved with your decision.</small></label>
          </div>
          <button disabled={busy} className="sm-button primary lv-full" type="submit">{busy ? <><RefreshCw className="lv-spin" size={17}/> Checking…</> : <>Check with Tatum and Walrus <ArrowRight size={17}/></>}</button>
        </form>

        <article className="sm-sheet lv-brief" aria-live="polite">
          <span className="sm-tape" aria-hidden="true"/>
          <p className="sm-sheet-kind">Step 2</p>
          {selected ? <>
            <h3>{selected.merchant}</h3>
            <p className="sm-sheet-meta">{selected.category}, {selected.amountSui} SUI</p>
            <span key={`${selected.id}-${selected.evaluation.recommendation}`} className={`sm-verdict lv-verdict ${selected.evaluation.recommendation}`}>{VERDICT[selected.evaluation.recommendation] ?? selected.evaluation.recommendation}</span>
            <dl className="sm-rows">
              <div><dt>Tatum balance</dt><dd>{selected.evaluation.chainVerified ? `${selected.evaluation.balanceSui} SUI` : 'Unverified'}</dd></div>
              <div><dt>Walrus recall</dt><dd>{selected.evaluation.memoryVerified ? `${selected.evaluation.matchedMemories.length} for this wallet` : 'Unverified'}</dd></div>
            
              {selected.evaluation.payment && <div><dt>Payment on Sui</dt><dd className={selected.evaluation.payment.matches ? 'lv-ok' : 'lv-warn'}>{!selected.evaluation.payment.checked ? 'Could not check' : selected.evaluation.payment.matches ? `Verified, ${selected.amountSui} SUI paid` : selected.evaluation.payment.succeeded ? 'Does not match' : 'Transaction failed'}</dd></div>}
            </dl>
            <ul className="lv-reasons">{selected.evaluation.reasons.map((item, i) => <li key={i}><Check size={15}/>{item}</li>)}</ul>
            {selected.evaluation.chainError && <p className="lv-inline-error">Tatum: {selected.evaluation.chainError}</p>}
            {selected.evaluation.memoryError && <p className="lv-inline-error">Walrus: {selected.evaluation.memoryError}</p>}
            {selected.evaluation.payment?.error && <p className="lv-inline-error">Tatum payment check: {selected.evaluation.payment.error}</p>}

            {selected.state === 'open' && <div className="lv-decision">
              <div className="sm-switch" role="group" aria-label="Decision">
                <button type="button" aria-pressed={decision === 'decline'} onClick={() => setDecision('decline')}>Decline</button>
                <button type="button" aria-pressed={decision === 'approve'} onClick={() => setDecision('approve')}>Approve</button>
              </div>
              <label>Why did you decide this?<textarea required minLength={8} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A specific rule or observation the next review should remember."/></label>
              <button className="sm-button primary" disabled={busy || !selected.evaluation.memoryVerified || reason.trim().length < 8} onClick={saveDecision} type="button">Save decision to Walrus <ArrowRight size={17}/></button>
            </div>}
            {selected.state === 'pending' && (selected.jobId
              ? <button className="sm-button ink lv-top" disabled={busy} onClick={() => checkJob(selected)} type="button"><RefreshCw size={16}/> Check write status</button>
              : <p className="lv-note">Write outcome uncertain. Check the Walrus account before making another proposal.</p>)}
            {selected.state === 'confirmed' && <div className="lv-confirmed"><CheckCircle2 size={19}/><span>Confirmed blob <code title={selected.blobId}>{shortId(selected.blobId || '')}</code>{selected.evaluation.payment?.matches ? ', saved with the verified payment' : ''}</span></div>}
            {selected.state === 'failed' && <p className="lv-note">Write failed. Make a new proposal before trying again.</p>}
          </> : <div className="lv-empty"><h3>Your brief appears here</h3><p>Fill in the proposal to see the live Tatum balance and any past decisions Walrus recalls for this wallet.</p></div>}
        </article>
      </div>
    </section>

    <section className="sm-section" id="history">
      <div className="sm-section-head"><div><h2>This browser's reviews</h2><p>Proposal history stays on this device. Confirmed decisions are stored on Walrus with the wallet they were made for.</p></div></div>
      {entries.length ? <div className="lv-history">
        {entries.map((entry) => <button type="button" key={entry.id} className={selected?.id === entry.id ? 'current' : ''} onClick={() => { setSelectedId(entry.id); document.getElementById('review')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <span className="lv-h-main"><strong>{entry.merchant}</strong><small>{entry.category}, {entry.amountSui} SUI</small></span>
          <span className={`lv-h-state ${entry.state}`}>{STATE[entry.state]}</span>
          <ArrowRight size={16}/>
        </button>)}
      </div> : <p className="lv-history-empty">No reviews in this browser yet.</p>}
    </section>

    <SiteFooter pages={status ? status.memoryCount : null}/>
  </main>;
}
