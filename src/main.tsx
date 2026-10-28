import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowDownRight, ArrowRight, Check, CheckCircle2, CircleHelp, Clock3, ExternalLink, Fingerprint, LockKeyhole, Plus, RefreshCw, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react';
import './styles.css';
import { PublicDemo } from './PublicDemo';
import { MemoryArtwork } from './art/MemoryArtwork';
import { StippleMark } from './art/StippleMark';

type Status = { network: string; tatumConfigured: boolean; memoryConfigured: boolean; confirmedWritesThisInstall: number; maxReviewSui: string };
type Memory = { blobId: string; decision: string; reason: string; createdAt: string };
type Evaluation = { recommendation: 'review' | 'consider' | 'decline'; reasons: string[]; balanceSui: string | null; matchedMemories: Memory[]; chainError: string | null; memoryError: string | null; chainVerified: boolean; memoryVerified: boolean };
type Proposal = { id: string; merchant: string; category: string; walletAddress: string; amountSui: string; createdAt: string; state: 'open' | 'pending_memory' | 'decided'; evaluation: Evaluation; memoryJobId?: string; decision?: { decision: 'approve' | 'decline'; reason: string; at: string }; memory?: { blobId: string; jobId: string; owner: string; namespace: string } };
type Transaction = { digest: string; status: string; checkpoint: string | null; timestampMs: string | null; balanceChanges: unknown[] };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'content-type': 'application/json', ...options?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

const short = (value: string) => value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
const when = (value: string) => new Date(value).toLocaleString();

function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Software');
  const [amountSui, setAmountSui] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [decision, setDecision] = useState<'approve' | 'decline'>('decline');
  const [reason, setReason] = useState('');
  const [digest, setDigest] = useState('');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState<'evaluate' | 'save' | 'verify' | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const [s, p] = await Promise.all([api<Status>('/status'), api<{ proposals: Proposal[] }>('/proposals')]);
    setStatus(s);
    setProposals(p.proposals);
  }

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);
  const selected = proposals.find((p) => p.id === selectedId) || proposals[0] || null;

  async function evaluate(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setBusy('evaluate');
    try {
      const { proposal } = await api<{ proposal: Proposal }>('/proposals', { method: 'POST', body: JSON.stringify({ merchant, category, amountSui, walletAddress }) });
      await refresh(); setSelectedId(proposal.id); setReason('');
      setNotice('Proposal evaluated. Review the evidence before recording a decision.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function saveDecision() {
    if (!selected) return;
    setError(''); setNotice(''); setBusy('save');
    try {
      const { proposal } = await api<{ proposal: Proposal }>(`/proposals/${selected.id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) });
      await refresh(); setSelectedId(proposal.id); setReason('');
      setNotice(`Confirmed on Walrus Mainnet. Blob ${short(proposal.memory!.blobId)} can now influence a later review.`);
    } catch (e) { setError((e as Error).message); await refresh().catch(() => {}); }
    finally { setBusy(null); }
  }

  async function checkWrite() {
    if (!selected) return;
    setError(''); setNotice(''); setBusy('save');
    try {
      const { proposal } = await api<{ proposal: Proposal }>(`/proposals/${selected.id}/reconcile`, { method: 'POST' });
      await refresh(); setSelectedId(proposal.id);
      setNotice(`Walrus Mainnet write confirmed: ${short(proposal.memory!.blobId)}.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function verifyTransaction(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice(''); setBusy('verify'); setTransaction(null);
    try {
      const result = await api<Transaction>(`/transactions/${encodeURIComponent(digest.trim())}`);
      setTransaction(result);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to main content</a>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><StippleMark size={32} /></div><span>SpendMemory<small>Decisions that learn</small></span></div>
      <div className="sidebar-label">Workspace</div>
      <nav aria-label="Main navigation"><a className="nav-item active" href="#overview"><Activity size={18} /> Overview</a><a className="nav-item" href="#review"><ShieldCheck size={18} /> Decision review</a><a className="nav-item" href="#proof"><Fingerprint size={18} /> Proof & receipts</a></nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-status"><div className="status-title"><span className="pulse-dot" /> Integrations</div><div className="status-row"><span>Tatum Sui RPC</span><strong className={status?.tatumConfigured ? 'ready' : 'muted'}>{status?.tatumConfigured ? 'Configured' : 'Needs key'}</strong></div><div className="status-row"><span>Walrus Memory</span><strong className={status?.memoryConfigured ? 'ready' : 'muted'}>{status?.memoryConfigured ? 'Configured' : 'Needs key'}</strong></div><p>Local development only. Credentials stay on the server.</p></div>
    </aside>
    <main id="main" className="main-content">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="network-badge"><span className="network-dot" /> Sui Mainnet</div></header>
      <div id="overview" className="content">
        <section className="hero"><div className="hero-copy"><h1>Better decisions, every time</h1><p>Review a Sui payment with live wallet context. Save your reasoning to Walrus Memory. See what changes the next time a similar decision appears.</p><a className="hero-cta" href="#review">Review a payment <ArrowRight size={18} /></a></div><div className="hero-art"><MemoryArtwork /></div></section>
        <section className="metrics" aria-label="Workspace metrics"><div className="metric"><span>Confirmed memories</span><strong>{status?.confirmedWritesThisInstall ?? '—'}<small> / 10 required</small></strong><p>Recorded by this installation</p></div><div className="metric"><span>Payments reviewed</span><strong>{proposals.filter((p) => p.state === 'decided').length}</strong><p>Human decisions saved</p></div><div className="metric"><span>Live integrations</span><strong>{Number(Boolean(status?.tatumConfigured)) + Number(Boolean(status?.memoryConfigured))}<small> / 2</small></strong><p>Tatum RPC + Walrus Memory</p></div></section>
        {!status?.tatumConfigured || !status?.memoryConfigured ? <div className="setup-alert" role="status"><CircleHelp size={20} /><div><strong>Connect the live services to complete the learning loop.</strong><span>Copy <code>.env.example</code> to <code>.env</code> and add your Tatum key and Walrus Memory Mainnet delegate credentials. No sample writes are counted.</span></div></div> : null}
        {notice && <div className="message success" role="status"><CheckCircle2 size={18}/>{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={16}/></button></div>}
        {error && <div className="message failure" role="alert"><CircleHelp size={18}/>{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}

        <section id="review" className="section-block"><div className="section-heading"><div><span className="section-kicker">Step 1</span><h2>Payment review</h2><p>Enter a proposed payment. SpendMemory checks live context and retrieves matching past decisions.</p></div><span className="section-aside"><LockKeyhole size={15}/> Never sends a payment</span></div>
          <div className="review-grid"><form className="panel form-panel" onSubmit={evaluate}><div className="panel-heading"><div className="panel-icon"><Plus size={18}/></div><div><h3>New proposal</h3><p>Nothing is paid or approved automatically.</p></div></div><div className="form-grid"><label>Merchant or payee<input required minLength={2} maxLength={80} value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Northwind Tools"/></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Software</option><option>Operations</option><option>Travel</option><option>Supplies</option><option>Other</option></select></label><label>Amount in SUI<input required inputMode="decimal" value={amountSui} onChange={(e) => setAmountSui(e.target.value)} placeholder="e.g. 3.5"/></label><label>Sui wallet address<input required value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} placeholder="0x…" spellCheck={false}/></label></div><button className="button primary full" disabled={busy !== null} type="submit">{busy === 'evaluate' ? <><RefreshCw className="spin" size={17}/> Checking live context…</> : <>Evaluate proposal <ArrowRight size={17}/></>}</button></form>
            <div className="panel result-panel"><div className="panel-heading"><div className="panel-icon violet"><Sparkles size={18}/></div><div><h3>Decision brief</h3><p>Advice changes only when a matching memory is recalled.</p></div></div>{selected ? <><div className="proposal-summary"><div><span>Proposed payment</span><h3>{selected.merchant}</h3><p>{selected.category} · {when(selected.createdAt)}</p></div><strong>{selected.amountSui} <small>SUI</small></strong></div><div className={`verdict ${selected.evaluation.recommendation}`}><span className="verdict-label">Recommendation</span><strong>{selected.evaluation.recommendation === 'consider' ? 'Consider approval' : selected.evaluation.recommendation === 'decline' ? 'Decline or investigate' : 'Review manually'}</strong><p>Human decision required. This recommendation does not move funds.</p></div><ul className="reason-list">{selected.evaluation.reasons.map((item, i) => <li key={i}><Check size={15}/>{item}</li>)}</ul><div className="evidence-row"><span><span className={selected.evaluation.chainVerified ? 'evidence-dot good' : 'evidence-dot'}/> Tatum {selected.evaluation.chainVerified ? 'live balance' : 'unverified'}</span><span><span className={selected.evaluation.memoryVerified ? 'evidence-dot good' : 'evidence-dot'}/> Walrus {selected.evaluation.memoryVerified ? 'recall checked' : 'unverified'}</span></div>{selected.evaluation.chainError && <p className="inline-error">Tatum: {selected.evaluation.chainError}</p>}{selected.evaluation.memoryError && <p className="inline-error">Walrus: {selected.evaluation.memoryError}</p>}</> : <div className="empty-state"><div className="empty-ring"><ArrowDownRight size={30}/></div><h3>Your first decision starts here</h3><p>Fill out the proposal to see live wallet evidence and recalled memory in one brief.</p></div>}</div></div>
        </section>

        {selected && <section className="section-block"><div className="section-heading"><div><span className="section-kicker">Step 2</span><h2>Record the decision</h2><p>A confirmed memory stores your decision and reason for the next session.</p></div></div><div className="panel decision-panel"><div className="decision-intro"><div className="panel-icon teal"><Fingerprint size={19}/></div><div><h3>{selected.state === 'decided' ? 'Memory confirmed on Mainnet' : selected.state === 'pending_memory' ? 'Write needs reconciliation' : 'Teach the next review'}</h3><p>{selected.state === 'decided' ? `Blob ${short(selected.memory?.blobId || '')}` : selected.state === 'pending_memory' ? selected.memoryJobId ? `Job ${short(selected.memoryJobId)} is waiting for confirmation.` : 'The write outcome is unknown. Check the Walrus dashboard before trying again.' : 'Choose an outcome and explain the reason. Walrus stores it before the app marks it complete.'}</p></div></div>{selected.state === 'open' && <div className="decision-fields"><div className="segmented" role="group" aria-label="Decision"><button className={decision === 'decline' ? 'selected' : ''} onClick={() => setDecision('decline')} type="button">Decline</button><button className={decision === 'approve' ? 'selected' : ''} onClick={() => setDecision('approve')} type="button">Approve</button></div><label>Why did you decide this?<textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Write a specific rule or observation the next review should remember."/></label><button className="button primary" onClick={saveDecision} disabled={!status?.memoryConfigured || reason.trim().length < 8 || busy !== null}>{busy === 'save' ? <><RefreshCw className="spin" size={17}/> Confirming Mainnet write…</> : <>Save to Walrus Memory <ArrowRight size={17}/></>}</button></div>}{selected.state === 'pending_memory' && selected.memoryJobId && <button className="button secondary" onClick={checkWrite} disabled={busy !== null}>{busy === 'save' ? 'Checking…' : 'Check write status'} <RefreshCw size={16}/></button>}{selected.state === 'decided' && <div className="confirmed"><CheckCircle2 size={18}/><span>{selected.decision?.decision.toUpperCase()} — {selected.decision?.reason}</span></div>}</div></section>}

        <section id="proof" className="section-block"><div className="section-heading"><div><span className="section-kicker">Step 3</span><h2>Proof & receipts</h2><p>Inspect confirmed memory IDs and verify a Sui transaction through Tatum.</p></div></div><div className="proof-grid"><div className="panel proof-panel"><div className="panel-heading"><div className="panel-icon teal"><Fingerprint size={18}/></div><div><h3>Memory trail</h3><p>Only confirmed writes from this installation appear here.</p></div></div>{proposals.filter((p) => p.memory?.blobId).length ? <div className="memory-list">{proposals.filter((p) => p.memory?.blobId).map((p) => <div className="memory-item" key={p.id}><span className="memory-symbol"><Check size={15}/></span><div><strong>{p.merchant}</strong><small>{p.decision?.decision} · {when(p.decision?.at || p.createdAt)}</small><code title={p.memory?.blobId}>{short(p.memory?.blobId || '')}</code></div></div>)}</div> : <div className="mini-empty">No confirmed memory writes yet.</div>}</div><div className="panel proof-panel"><div className="panel-heading"><div className="panel-icon"><Wallet size={18}/></div><div><h3>Sui transaction lookup</h3><p>Check a real Mainnet digest. This app does not send transactions.</p></div></div><form onSubmit={verifyTransaction} className="transaction-form"><label>Transaction digest<input value={digest} onChange={(e) => setDigest(e.target.value)} placeholder="Paste a Sui transaction digest" spellCheck={false}/></label><button className="button secondary" disabled={busy !== null || !status?.tatumConfigured} type="submit">{busy === 'verify' ? 'Checking…' : 'Verify with Tatum'} <ExternalLink size={15}/></button></form>{transaction && <div className="transaction-result"><div><span>Status</span><strong>{transaction.status}</strong></div><div><span>Checkpoint</span><strong>{transaction.checkpoint ?? 'Unknown'}</strong></div><div><span>Balance changes</span><strong>{transaction.balanceChanges.length}</strong></div></div>}</div></div></section>
        <section className="history-section"><div className="section-heading"><div><h2>Recent reviews</h2></div></div>{proposals.length ? <div className="history-list">{proposals.map((p) => <button key={p.id} onClick={() => { setSelectedId(p.id); document.getElementById('review')?.scrollIntoView({ behavior: 'smooth' }); }} className={`history-row ${selected?.id === p.id ? 'current' : ''}`}><span className="history-icon"><Wallet size={17}/></span><span className="history-main"><strong>{p.merchant}</strong><small>{p.category} · {when(p.createdAt)}</small></span><strong className="history-amount">{p.amountSui} SUI</strong><span className={`history-status ${p.state}`}>{p.state === 'decided' ? 'Memory saved' : p.state === 'pending_memory' ? 'Needs review' : 'Open'}</span><ArrowRight size={17}/></button>)}</div> : <div className="history-empty"><Clock3 size={20}/> Your reviews will appear here.</div>}</section>
        <footer><span>SpendMemory local prototype. Human decisions, portable memory.</span><span>Built for Total Recall</span></footer>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode>{import.meta.env.PROD ? <PublicDemo/> : <App/>}</React.StrictMode>);
