import { Link } from 'react-router-dom';
import LegalLayout, { Section } from './LegalLayout';
import { C } from './Landing';

const p = { margin: '0 0 12px' };
const ul = { margin: '0 0 12px', paddingLeft: '20px' };
const li = { marginBottom: '6px' };
const strong = { color: C.ink, fontWeight: '600' };
const link = { color: C.brand, textDecoration: 'none' };

export default function BAA() {
  return (
    <LegalLayout title="Business Associate Agreement" updated="September 2026">
      <Section title="1. What This Is">
        <p style={p}>
          A Business Associate Agreement (BAA) is a contract required under HIPAA whenever a "business associate"
          (Vatent LLC, operating PraxisMD) creates, receives, maintains, or transmits Protected Health Information
          (PHI) on behalf of a "covered entity" (your dental or medical practice). It sets out how we handle PHI,
          the safeguards we apply, and each party's obligations if something goes wrong.
        </p>
      </Section>

      <Section title="2. Who Needs One">
        <p style={p}>
          If your practice stores or processes any patient health information in PraxisMD — appointment history,
          treatment notes, insurance details, or messages that reference a patient's care — a signed BAA needs to
          be in place between your practice and Vatent LLC before that data enters the Service.
        </p>
      </Section>

      <Section title="3. What It Covers">
        <ul style={ul}>
          <li style={li}>Permitted and required uses of PHI in connection with the Service.</li>
          <li style={li}>The administrative, technical, and physical safeguards we apply (see our <Link to="/security" style={link}>Security</Link> page).</li>
          <li style={li}>Breach notification timelines and procedures.</li>
          <li style={li}>Subcontractor flow-down — requiring the same protections from any subprocessor that touches PHI.</li>
          <li style={li}>Return or deletion of PHI at the end of the relationship.</li>
        </ul>
        <p style={p}>
          Our <Link to="/privacy" style={link}>Privacy Policy</Link> lists the subprocessors involved in delivering
          the Service and which ones do — and don't — receive PHI.
        </p>
      </Section>

      <Section title="4. Getting One in Place">
        <p style={p}>
          We execute a BAA with every Customer before they store patient health information in the Service. If
          you're setting up a new practice account, reach out to <span style={strong}>legal@praxismd.health</span> and
          we'll send the agreement over for signature — this is typically part of onboarding, not something you need
          to chase down separately.
        </p>
      </Section>

      <Section title="5. Questions">
        <p style={p}>
          For anything specific to your practice's compliance requirements, contact{' '}
          <span style={strong}>legal@praxismd.health</span>.
        </p>
      </Section>
    </LegalLayout>
  );
}
