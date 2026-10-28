import { useState } from 'react';
import { ArrowRight, CheckCircle2, Fingerprint, Github, LockKeyhole, RotateCcw, ShieldCheck, Wallet } from 'lucide-react';
import './public-demo.css';

const blobId = 'VpDjzjIwtRW1UQJ8LOrUjUp2rbfV-RaIU36yB8DNSdg';
const repoUrl = 'https://github.com/0xNexuz/spendmemory';

export function PublicDemo() {
  const [learned, setLearned] = useState(false);

  return <main className="demo-shell">
    <header className="demo-header">
      <a className="demo-brand" href="#top"><span className="demo-brand-icon"><Fingerprint size={21}/></span><span>Spend<span>Memory</span></span></a>
      <a className="demo-repo-link" href={repoUrl} target="_blank" rel="noreferrer"><Github size={17}/> Public repo <ArrowRight size={16}/></a>
    </header>

    <section className="demo-hero" id="top">
      <div className="demo-kicker"><span/> WALRUS × TATUM · MAINNET EVIDENCE</div>
      <h1>A payment review that<br/><em>remembers why.</em></h1>
      <p>SpendMemory checks Sui context through Tatum, recalls past decisions from Walrus Memory, and gives a person the final say. This public page replays one verified Mainnet learning loop.</p>
      <div className="demo-hero-actions"><a href="#replay" className="demo-button primary">Replay the learning loop <ArrowRight size={17}/></a><a href={repoUrl} target="_blank" rel="noreferrer" className="demo-button outline">Explore the code</a></div>
      <div className="demo-hero-orb" aria-hidden="true"/>
    </section>

    <section className="demo-metrics" aria-label="Verified milestones">
      <div><span>MAINNET MEMORIES</span><strong>50 <small>/ 50</small></strong><p>49 labeled fictional demo records; submission evidence is separate.</p></div>
      <div><span>TATUM READS</span><strong>Verified</strong><p>Sui balance and transaction data.</p></div>
      <div><span>WALRUS WRITE</span><strong>Confirmed</strong><p>Stored blob recalled after restart.</p></div>
    </section>

    <section className="demo-section" id="replay">
      <div className="demo-section-head"><div><span className="demo-section-tag">01 / THE LEARNING LOOP</span><h2>Same proposal. New context.</h2><p>The scenario is fictional. The Mainnet write, blob confirmation, and later recall were real.</p></div><div className="demo-switch" role="group" aria-label="Replay step"><button type="button" className={!learned ? 'active' : ''} onClick={() => setLearned(false)}>Before memory</button><button type="button" className={learned ? 'active' : ''} onClick={() => setLearned(true)}>After recall</button></div></div>
      <div className="demo-replay-grid">
        <div className="demo-card proposal"><div className="demo-card-label"><Wallet size={18}/> PAYMENT PROPOSAL</div><h3>DemoCloud subscription</h3><p>Software · 0.02 SUI</p><div className="demo-detail"><span>Onchain balance</span><strong>Enough to cover proposal</strong></div><div className="demo-detail"><span>Decision authority</span><strong>Human reviewer</strong></div><small>A public funded Sui address was used for this demo. No transaction was submitted.</small></div>
        <div className={`demo-card outcome ${learned ? 'learned' : ''}`}><div className="demo-card-label"><ShieldCheck size={18}/> SPENDMEMORY SUGGESTION</div><span className="demo-pill">{learned ? 'DECLINE' : 'REVIEW'}</span><h3>{learned ? 'A past decline changes the brief.' : 'No matching history yet.'}</h3><p>{learned ? 'Walrus recalled a confirmed decline for the same merchant and category. The app suggests declining this unfamiliar recurring charge.' : 'Tatum verified that the wallet could cover the amount. With no matching memory, the app asked for manual review.'}</p><div className="demo-detail"><span>Matching memories</span><strong>{learned ? '1 confirmed decline' : '0'}</strong></div><button type="button" className="demo-next" onClick={() => setLearned(!learned)}>{learned ? <><RotateCcw size={16}/> Replay from start</> : <>Recall the saved decision <ArrowRight size={16}/></>}</button></div>
      </div>
    </section>

    <section className="demo-section proof"><div className="demo-section-head"><div><span className="demo-section-tag">02 / THE RECEIPT</span><h2>Memory with a real ID.</h2><p>One fictional decision was written to Walrus Memory Mainnet and returned this confirmed blob ID. The app recalled the same blob after a server restart.</p></div></div><div className="demo-proof-card"><div className="demo-proof-icon"><CheckCircle2 size={25}/></div><div><span>CONFIRMED WALRUS BLOB</span><code>{blobId}</code><p>Decision: decline · Merchant: DemoCloud subscription · Category: software</p></div></div></section>

    <section className="demo-footer-callout"><LockKeyhole size={22}/><div><h3>Human control stays in the loop.</h3><p>The live app can evaluate proposals and save decisions to Walrus Mainnet. It never sends payments. Server credentials stay out of GitHub and the browser.</p></div><a href="/">Open live app <ArrowRight size={16}/></a></section>
    <footer className="demo-footer"><span>SpendMemory · Total Recall 2026</span><span>Evidence replay · 50 confirmed Mainnet memories, 49 fictional seeds</span></footer>
  </main>;
}
