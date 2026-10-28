import { useState } from 'react';
import { ArrowRight, Check, Copy, Github, LockKeyhole, RotateCcw } from 'lucide-react';
import { MemoryArtwork } from './art/MemoryArtwork';
import { StippleMark } from './art/StippleMark';
import { useActiveSection, useScrolled } from './useActiveSection';
import './public-demo.css';

const blobId = 'VpDjzjIwtRW1UQJ8LOrUjUp2rbfV-RaIU36yB8DNSdg';
const repoUrl = 'https://github.com/0xNexuz/spendmemory';

function ReviewerFigure({ learned }: { learned: boolean }) {
  return <svg className={`reviewer ${learned ? 'is-learned' : ''}`} viewBox="0 0 360 440" role="img" aria-label={learned ? 'The reviewer is wired to a pinned memory of the earlier DemoCloud decline.' : 'The reviewer has no memory wired in yet.'}>
    <g className="slip">
      <rect x="60" y="18" width="176" height="118" className="slip-empty"/>
      <text x="148" y="83" textAnchor="middle" className="slip-empty-text">No matching memory</text>
      <g className="slip-full">
        <rect x="60" y="18" width="176" height="118" className="slip-paper"/>
        <rect x="70" y="28" width="156" height="34" fill="#1c58c9"/>
        <text x="78" y="53" className="slip-title" textLength="140" lengthAdjust="spacingAndGlyphs">DEMOCLOUD DECLINED</text>
        <text x="78" y="84" className="slip-meta">software, 0.02 SUI</text>
        <text x="78" y="106" className="slip-mono">blob VpDjzj…NSdg</text>
        <rect x="124" y="10" width="48" height="16" className="slip-tape" transform="rotate(-4 148 18)"/>
      </g>
    </g>
    <image href="/art/head-3.webp" x="36" y="134" width="288" height="288"/>
    <path d="M214 166C180 190 130 210 104 250C86 280 92 320 78 350" className="dangle"/>
    <circle cx="148" cy="128" r="4" className="slip-pin"/>
    <path d="M148 130C152 152 196 146 214 166" className="link red" pathLength={1}/>
    <path d="M246 190C290 176 330 224 392 212" className="link blue" pathLength={1}/>
    <rect x="205" y="160" width="18" height="12" rx="1.5" className="electrode" transform="rotate(-14 214 166)"/>
    <rect x="237" y="184" width="18" height="12" rx="1.5" className="electrode" transform="rotate(22 246 190)"/>
  </svg>;
}

export function PublicDemo() {
  const [learned, setLearned] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrolled = useScrolled(12);
  const section = useActiveSection(['top', 'replay', 'receipt'], 'top');

  async function copyBlob() {
    try {
      await navigator.clipboard.writeText(blobId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const range = document.createRange();
      const node = document.getElementById('blob-id');
      if (node) { range.selectNodeContents(node); window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range); }
    }
  }

  return <main className="sm-page">
    <header className={`sm-header${scrolled ? ' is-stuck' : ''}`}>
      <div className="sm-header-inner">
        <a className="sm-brand" href="#top" aria-label="SpendMemory, back to top"><StippleMark/><span>SpendMemory</span></a>
        <nav className="sm-nav" aria-label="Page">
          <a href="/">Live app</a>
          <a href="#replay" aria-current={section === 'replay' ? 'location' : undefined}>Replay</a>
          <a href="#receipt" aria-current={section === 'receipt' ? 'location' : undefined}>Receipt</a>
          <a className="sm-nav-repo" href={repoUrl} target="_blank" rel="noreferrer" aria-label="Source on GitHub"><Github size={16}/><span>Source</span></a>
        </nav>
      </div>
    </header>

    <section className="sm-hero" id="top">
      <h1>A payment review that remembers why</h1>
      <div className="sm-hero-side">
        <p>SpendMemory reads a Sui wallet through Tatum, recalls your past decisions from Walrus Memory, and leaves the final call to you. This page replays one verified learning loop from Mainnet.</p>
        <div className="sm-actions">
          <a href="#replay" className="sm-button primary">Replay the learning loop <ArrowRight size={17}/></a>
          <a href={repoUrl} target="_blank" rel="noreferrer" className="sm-button ink">Read the source</a>
        </div>
      </div>
    </section>

    <figure className="sm-art">
      <MemoryArtwork/>
    </figure>

    <section className="sm-ledger" aria-label="Verified milestones">
      <dl>
        <div><dt>Mainnet memories</dt><dd><strong>50+ confirmed</strong><span>Live count in the app. Seeded demo records are labeled fictional.</span></dd></div>
        <div><dt>Tatum reads</dt><dd><strong>Verified</strong><span>Sui balance and transaction data.</span></dd></div>
        <div><dt>Walrus write</dt><dd><strong>Confirmed</strong><span>The stored blob came back after a restart.</span></dd></div>
      </dl>
    </section>

    <section className="sm-section" id="replay">
      <div className="sm-section-head">
        <div>
          <h2>Same proposal, new context</h2>
          <p>The scenario is fictional. The Mainnet write, its confirmation and the later recall were real.</p>
        </div>
        <div className="sm-switch" role="group" aria-label="Replay step">
          <button type="button" aria-pressed={!learned} onClick={() => setLearned(false)}>Before memory</button>
          <button type="button" aria-pressed={learned} onClick={() => setLearned(true)}>After recall</button>
        </div>
      </div>

      <div className={`sm-replay ${learned ? 'is-learned' : ''}`}>
        <article className="sm-sheet proposal">
          <span className="sm-tape" aria-hidden="true"/>
          <p className="sm-sheet-kind">Payment proposal</p>
          <h3>DemoCloud subscription</h3>
          <p className="sm-sheet-meta">Software, 0.02 SUI</p>
          <dl className="sm-rows">
            <div><dt>Onchain balance</dt><dd>Enough to cover it</dd></div>
            <div><dt>Who decides</dt><dd>The human reviewer</dd></div>
          </dl>
          <p className="sm-note">A public funded Sui address was used for this demo. No transaction was submitted.</p>
        </article>

        <div className="sm-figure"><ReviewerFigure learned={learned}/></div>

        <article className="sm-sheet outcome" aria-live="polite">
          <span className="sm-tape" aria-hidden="true"/>
          <p className="sm-sheet-kind">SpendMemory suggests</p>
          <span key={learned ? 'decline' : 'review'} className={`sm-verdict ${learned ? 'decline' : 'review'}`}>{learned ? 'Decline' : 'Review'}</span>
          <h3>{learned ? 'A past decline changes the brief' : 'No matching history yet'}</h3>
          <p>{learned ? 'Walrus recalled a confirmed decline for the same merchant and category, so the brief suggests declining this unfamiliar recurring charge.' : 'Tatum confirmed the wallet could cover the amount. With no matching memory, the brief asks for a manual review.'}</p>
          <dl className="sm-rows">
            <div><dt>Matching memories</dt><dd>{learned ? '1 confirmed decline' : 'None'}</dd></div>
          </dl>
          <button type="button" className="sm-button primary small" onClick={() => setLearned(!learned)}>{learned ? <><RotateCcw size={16}/> Replay from the start</> : <>Recall the saved decision <ArrowRight size={16}/></>}</button>
        </article>
      </div>
    </section>

    <section className="sm-section" id="receipt">
      <div className="sm-section-head">
        <div>
          <h2>Memory with a real ID</h2>
          <p>One fictional decision was written to Walrus Memory on Mainnet and returned this confirmed blob ID. The app recalled the same blob after a server restart.</p>
        </div>
      </div>
      <div className="sm-receipt">
        <span className="sm-tape" aria-hidden="true"/>
        <svg className="sm-stamp" viewBox="0 0 140 140" aria-hidden="true">
          <defs><path id="stamp-ring" d="M70 70m-50 0a50 50 0 1 1 100 0a50 50 0 1 1 -100 0"/></defs>
          <circle cx="70" cy="70" r="64"/><circle cx="70" cy="70" r="38"/>
          <text><textPath href="#stamp-ring" startOffset="0">CONFIRMED ON WALRUS MAINNET •</textPath></text>
          <text x="70" y="66" textAnchor="middle" className="sm-stamp-day">28 OCT</text>
          <text x="70" y="86" textAnchor="middle" className="sm-stamp-year">2026</text>
        </svg>
        <p className="sm-sheet-kind">Confirmed Walrus blob</p>
        <code id="blob-id">{blobId}</code>
        <div className="sm-receipt-foot">
          <p>Decision: decline. Merchant: DemoCloud subscription. Category: software.</p>
          <button type="button" className="sm-button ink small" onClick={copyBlob} aria-live="polite">{copied ? <><Check size={16}/> Copied</> : <><Copy size={16}/> Copy blob ID</>}</button>
        </div>
      </div>
    </section>

    <section className="sm-callout">
      <LockKeyhole size={24}/>
      <div>
        <h3>Human control stays in the loop</h3>
        <p>The live app can evaluate proposals and save decisions to Walrus Mainnet. It never sends payments. Server credentials stay out of GitHub and the browser.</p>
      </div>
      <a href="/" className="sm-link-ink">Open the live app <ArrowRight size={16}/></a>
    </section>

    <footer className="sm-footer"><span>SpendMemory, built for Total Recall 2026</span><span>Evidence replay. 50+ confirmed Mainnet memories, including fictional demos.</span></footer>
  </main>;
}
