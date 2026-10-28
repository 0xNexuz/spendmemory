import { ArrowUpRight, Github } from 'lucide-react';

const AUTHOR = '0xNexuz';
const AUTHOR_URL = 'https://github.com/0xNexuz';
const REPO_URL = 'https://github.com/0xNexuz/spendmemory';

/**
 * The notebook's last page: a handwritten sign-off by the author, an index of the other pages,
 * an ink stamp for the one rule that never bends, and the fine print.
 */
export function SiteFooter({ notice, pages }: { notice: string; pages?: number | null }) {
  return <footer className="sm-colophon">
    <div className="sm-colophon-inner">
      <div className="sm-signoff">
        <p className="sm-signoff-line">Every decision leaves a note.<br/>This notebook keeps them.</p>
        <a className="sm-signature" href={AUTHOR_URL} target="_blank" rel="noreferrer">
          <span className="sm-signature-by">signed,</span>
          <span className="sm-signature-name">{AUTHOR}</span>
          <svg className="sm-signature-stroke" viewBox="0 0 220 24" preserveAspectRatio="none" aria-hidden="true">
            <path d="M4 15C38 9 70 19 104 13S170 6 216 12" pathLength={1}/>
          </svg>
        </a>
        {typeof pages === 'number' && <p className="sm-pagecount">{pages === 0 ? 'The first page is still blank.' : `${pages} ${pages === 1 ? 'page' : 'pages'} written by visitors so far.`}</p>}
      </div>

      <nav className="sm-index" aria-label="Footer">
        <p className="sm-index-title">Index</p>
        <ol>
          <li><a href="/"><span>Live app</span><span className="sm-index-dots" aria-hidden="true"/><span className="sm-index-page">i</span></a></li>
          <li><a href="/?replay=1"><span>Verified replay</span><span className="sm-index-dots" aria-hidden="true"/><span className="sm-index-page">ii</span></a></li>
          <li><a href={REPO_URL} target="_blank" rel="noreferrer"><span>Source on GitHub</span><span className="sm-index-dots" aria-hidden="true"/><span className="sm-index-page"><ArrowUpRight size={15}/></span></a></li>
          <li><a href={AUTHOR_URL} target="_blank" rel="noreferrer"><span>More from {AUTHOR}</span><span className="sm-index-dots" aria-hidden="true"/><span className="sm-index-page"><Github size={15}/></span></a></li>
        </ol>
      </nav>

      <svg className="sm-footer-stamp" viewBox="0 0 140 140" role="img" aria-label="Stamp: the human decides, SpendMemory never sends payments">
        <defs><path id="footer-ring" d="M70 70m-50 0a50 50 0 1 1 100 0a50 50 0 1 1 -100 0"/></defs>
        <circle cx="70" cy="70" r="64"/><circle cx="70" cy="70" r="38"/>
        <text><textPath href="#footer-ring" textLength="304" lengthAdjust="spacingAndGlyphs">THE HUMAN DECIDES • NO PAYMENTS SENT • </textPath></text>
        <text x="70" y="67" textAnchor="middle" className="sm-footer-stamp-big" textLength="56" lengthAdjust="spacingAndGlyphs">NEVER</text>
        <text x="70" y="85" textAnchor="middle" className="sm-footer-stamp-small">PAYS</text>
      </svg>
    </div>

    <div className="sm-fineprint">
      <p>{notice}</p>
      <p>Built by <a href={AUTHOR_URL} target="_blank" rel="noreferrer">{AUTHOR}</a> for Walrus × Tatum Total Recall, 2026.</p>
    </div>
  </footer>;
}
