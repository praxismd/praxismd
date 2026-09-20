import { Link } from 'react-router-dom';
import { ArrowLeft } from './icons';
import { C } from './Landing';

// Shared chrome for the legal pages (Terms, Privacy) — a minimal header
// with a way back to the marketing site, and a consistent reading width.
// Reuses Landing's palette so these pages don't visually drift from the
// rest of the marketing site.
export default function LegalLayout({ title, updated, children }) {
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: C.bg, color: C.ink2, minHeight: '100vh' }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '18px 26px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: C.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>Px</div>
            <span style={{ fontSize: '18px', fontWeight: '700', color: C.ink }}>PraxisMD</span>
          </Link>
          <Link to="/" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: C.mid, textDecoration: 'none', fontSize: '13.5px', fontWeight: '500' }}>
            <ArrowLeft size={14} /> Back to site
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 26px 90px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: '800', color: C.ink, letterSpacing: '-.5px', margin: '0 0 8px' }}>{title}</h1>
        <div style={{ fontSize: '13px', color: C.muted, marginBottom: '28px' }}>Last updated {updated}</div>

        <div style={{ padding: '14px 16px', borderRadius: '10px', background: C.amberL, border: `1px solid ${withAlpha(C.amber, .25)}`, fontSize: '13px', color: C.ink2, lineHeight: 1.6, marginBottom: '36px' }}>
          <strong>Draft for a demo product.</strong> This page is a reasonable starting template, not legal advice — have an attorney review and tailor it to your actual business, jurisdiction, and vendor agreements before relying on it for a real launch.
        </div>

        <div style={{ fontSize: '14.5px', lineHeight: 1.75, color: C.ink2 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function withAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: '700', color: C.ink, margin: '0 0 10px' }}>{title}</h2>
      {children}
    </div>
  );
}
