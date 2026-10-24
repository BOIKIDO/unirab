// Builds lib/cheat-sheet.js: wraps the standalone GEO cheat sheet
// (ai-visibility-cheat-sheet.html) in the standard UNIRAB page chrome
// (product header + site footer + product.css) with all sheet CSS scoped
// under .geo-sheet so it cannot collide with product.css.
// Usage: node scripts/build-cheat-sheet.mjs [path-to-source-html]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || join(root, '..', 'ai-visibility-cheat-sheet.html');
const html = readFileSync(source, 'utf8');

// ---- extract pieces from the standalone sheet ----
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
const scriptMatch = bodyMatch[1].match(/<script>([\s\S]*?)<\/script>\s*$/);
if (!styleMatch || !bodyMatch || !scriptMatch) throw new Error('could not parse sheet structure');
const sheetCss = styleMatch[1];
const sheetBody = bodyMatch[1].replace(/<script>[\s\S]*?<\/script>\s*$/, '');
const sheetJs = scriptMatch[1];

// ---- scope every sheet CSS rule under .geo-sheet ----
function scopeSelector(sel) {
  return sel.split(',').map((part) => {
    let s = part.trim();
    if (!s) return null;
    if (s === '*') return '.geo-sheet,.geo-sheet *';
    if (s.startsWith(':root')) return s.replace(':root', '.geo-sheet');
    if (s.startsWith('html')) s = s.replace(/^html(?![\w-])/, '.geo-sheet');
    if (s.startsWith('body')) s = s.replace(/^body(?![\w-])/, '.geo-sheet');
    if (s.startsWith('.geo-sheet')) return s;
    return '.geo-sheet ' + s;
  }).filter(Boolean).join(',');
}
function scopeCss(css) {
  let out = '';
  let i = 0;
  const len = css.length;
  while (i < len) {
    const brace = css.indexOf('{', i);
    if (brace === -1) { out += css.slice(i); break; }
    const head = css.slice(i, brace);
    if (head.trim().startsWith('@media')) {
      const close = matchingBrace(css, brace);
      out += head + '{' + scopeCss(css.slice(brace + 1, close)) + '}';
      i = close + 1;
    } else if (head.trim().startsWith('@')) {
      const close = matchingBrace(css, brace);
      out += css.slice(i, close + 1);
      i = close + 1;
    } else {
      const close = css.indexOf('}', brace);
      out += scopeSelector(head) + css.slice(brace, close + 1);
      i = close + 1;
    }
  }
  return out;
}
function matchingBrace(str, open) {
  let depth = 0;
  for (let j = open; j < str.length; j++) {
    if (str[j] === '{') depth++;
    else if (str[j] === '}') { depth--; if (depth === 0) return j; }
  }
  return -1;
}
const scopedCss = scopeCss(sheetCss).replace(/@media print\{/, '@media print{');

// ---- page chrome (matches the standard product pages) ----
const HEADER = `<header class="product-header"><button class="menu" aria-label="Open navigation" aria-expanded="false"><span></span><span></span></button><nav class="product-nav" aria-label="Primary"><button class="nav-close" type="button" aria-label="Close navigation">×</button><a href="/#included">About</a><a href="/#pricing">Pricing</a><a href="/#how">How It Works</a><a href="/case-studies">Case Studies</a><a href="/#faq">Support</a><a href="/login">Customer Login</a></nav><a class="brand" href="/" aria-label="UNIRAB home"><span>UNI</span><b>RAB</b><i></i></a></header>`;
const FOOTER = `<footer class="site-footer"><div class="footer-grid"><div><a class="brand footer-brand" href="/"><span>UNI</span><b>RAB</b><i></i></a><p>AI visibility for local business.<br>Built with care, measured monthly.</p></div><div><h3>Company</h3><a href="/">Home</a><a href="/#included">About Us</a><a href="/case-studies">Case Studies</a><a href="/#how">How It Works</a><a href="/#cheat-sheet">AI Cheat Sheet</a><a href="/#reviews">Reviews</a></div><div><h3>Resources</h3><a href="/contact">Contact Us</a><a href="/policies/privacy-policy">Privacy Policy</a><a href="/policies/terms-of-service">Terms of Service</a><a href="/policies/refund-policy">Refund Policy</a><a href="/policies/subscription-policy">Cancellation Policy</a></div><div><h3>Partners</h3><a href="/reseller-program">Reseller Program</a><a href="/login">Reseller Dashboard</a></div></div><p class="copyright">© 2026 UNIRAB. All rights reserved. · <a href="/policies/privacy-policy">Privacy Policy</a> · <a href="/policies/terms-of-service">Terms of Service</a></p></footer>`;
const MENU_JS = `const menu=document.querySelector('.menu'),nav=document.querySelector('.product-nav');menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});nav?.addEventListener('click',e=>{if(e.target.matches('a')||e.target.closest('.nav-close')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}});document.addEventListener('click',e=>{if(nav&&nav.classList.contains('open')&&!nav.contains(e.target)&&!menu.contains(e.target)){nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}});`;

const page = `<!doctype html><html lang="en"><head><!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-T7GK8MK9');</script>
<!-- End Google Tag Manager --><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="description" content="AI Visibility Cheat Sheet - your GEO playbook for making your business visible and citable in ChatGPT, Claude, Perplexity, Gemini and Copilot."><title>AI Visibility Cheat Sheet | UNIRAB</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="alternate icon" href="/favicon.ico" sizes="48x48"><link rel="stylesheet" href="/product.css"><style>${scopedCss}</style></head><body><!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T7GK8MK9"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
${HEADER}
<div class="geo-sheet">
${sheetBody.trim()}
</div>
${FOOTER}
<script>${MENU_JS}</script>
<script>${sheetJs}</script>
<script src="/session-widget.js" defer></script>
</body></html>`;

const out = `// GENERATED by scripts/build-cheat-sheet.mjs - do not edit by hand.
// The GEO cheat sheet wrapped in the standard UNIRAB page chrome (header,
// footer, product.css) with its CSS scoped under .geo-sheet. Served ONLY by
// the subscriber-gated api/cheat-sheet.js endpoint - never place in dist/.
export default ${JSON.stringify(page)};
`;
writeFileSync(join(root, 'lib', 'cheat-sheet.js'), out);
console.log('lib/cheat-sheet.js written:', out.length, 'bytes');
