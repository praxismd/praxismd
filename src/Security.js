import { Link } from 'react-router-dom';
import LegalLayout, { Section } from './LegalLayout';
import { C } from './Landing';

const p = { margin: '0 0 12px' };
const ul = { margin: '0 0 12px', paddingLeft: '20px' };
const li = { marginBottom: '6px' };
const strong = { color: C.ink, fontWeight: '600' };
const link = { color: C.brand, textDecoration: 'none' };

export default function Security() {
  return (
    <LegalLayout title="Security" updated="September 2026">
      <Section title="1. Overview">
        <p style={p}>
          PraxisMD handles patient health information, so security isn't an afterthought — it's built into how the
          Service is designed and operated. This page summarizes the safeguards in place; the specifics of how we
          handle PHI as a HIPAA business associate are set out in our{' '}
          <Link to="/baa" style={link}>Business Associate Agreement</Link>.
        </p>
      </Section>

      <Section title="2. Infrastructure">
        <p style={p}>
          The Service runs on Google Cloud / Firebase — the same infrastructure used by companies handling
          regulated data at scale. Data is encrypted in transit (TLS) and at rest, and access to production systems
          is restricted to the team members who need it to operate the Service.
        </p>
      </Section>

      <Section title="3. Access Controls">
        <ul style={ul}>
          <li style={li}>Every account is tied to an individual login — no shared credentials.</li>
          <li style={li}>Role-based access limits what staff/doctor vs. patient accounts can see and do inside a practice.</li>
          <li style={li}>Every action taken on a patient record is written to an audit log, visible to practice admins.</li>
          <li style={li}>Two-factor authentication is available for staff accounts.</li>
        </ul>
      </Section>

      <Section title="4. Application Security">
        <p style={p}>
          Backend logic that handles secrets or PHI (payment processing, messaging, patient invites) runs
          server-side in isolated Cloud Functions — API keys for connected services like Stripe and GoHighLevel are
          never exposed to the browser. Server-side access to those integrations is restricted to a fixed allowlist
          of endpoints the app actually needs, not open proxy access to the underlying accounts.
        </p>
      </Section>

      <Section title="5. Vendor Security">
        <p style={p}>
          We rely on a small number of well-vetted providers to deliver the Service — see the subprocessor list in
          our <Link to="/privacy" style={link}>Privacy Policy</Link> for details on who they are and what they do
          and don't receive.
        </p>
      </Section>

      <Section title="6. Incident Response">
        <p style={p}>
          If we identify or are notified of a security incident affecting Customer or patient data, we investigate
          promptly and notify affected Customers in line with our BAA and applicable law.
        </p>
      </Section>

      <Section title="7. Reporting a Vulnerability">
        <p style={p}>
          If you believe you've found a security issue, please report it to{' '}
          <span style={strong}>security@praxismd.health</span> rather than disclosing it publicly. We'll acknowledge
          reports promptly and work with you on a fix.
        </p>
      </Section>
    </LegalLayout>
  );
}
