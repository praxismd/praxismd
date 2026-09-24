import { Link } from 'react-router-dom';
import LegalLayout, { Section } from './LegalLayout';
import { C } from './Landing';

const p = { margin: '0 0 12px' };
const ul = { margin: '0 0 12px', paddingLeft: '20px' };
const li = { marginBottom: '6px' };
const strong = { color: C.ink, fontWeight: '600' };
const link = { color: C.brand, textDecoration: 'none' };

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" updated="September 2026">
      <Section title="1. Agreement to Terms">
        <p style={p}>
          These Terms of Service ("Terms") govern access to and use of PraxisMD (the "Service"), operated by
          Vatent LLC ("Vatent," "we," "us"), provided to dental and medical practices ("Customer," "you"). By
          creating an account or using the Service, you agree to these Terms on behalf of yourself and, if
          applicable, your practice.
        </p>
      </Section>

      <Section title="2. The Service">
        <p style={p}>
          PraxisMD is a practice management platform covering patient communication, scheduling, billing, and related
          workflows. Certain features depend on connected third-party services (for example, GoHighLevel for messaging
          and Stripe for payments) and are only available once those connections are configured.
        </p>
      </Section>

      <Section title="3. Accounts">
        <p style={p}>
          You're responsible for the accuracy of the information you provide, for keeping your login credentials secure,
          and for all activity under your account. Notify us promptly of any unauthorized use.
        </p>
      </Section>

      <Section title="4. Fees &amp; Payment">
        <p style={p}>
          Paid plans are billed on the cycle shown at signup. Fees are non-refundable except where required by law.
          We may change our pricing with advance notice; continued use after a price change takes effect constitutes
          acceptance of the new pricing.
        </p>
      </Section>

      <Section title="5. Patient Data &amp; HIPAA">
        <p style={p}>
          Where your use of the Service involves Protected Health Information (PHI), a separate Business Associate
          Agreement (BAA) between you and PraxisMD governs our handling of that data and controls over these Terms in
          the event of a conflict. See our <Link to="/privacy" style={link}>Privacy Policy</Link> for how we handle data,
          including our use of third-party subprocessors.
        </p>
      </Section>

      <Section title="6. Third-Party Services">
        <p style={p}>
          The Service integrates with third-party providers, including Stripe for payment processing and GoHighLevel for
          messaging and CRM. Those providers' own terms apply to the portions of the Service they power. We are not
          responsible for outages, changes, or errors originating from a third-party provider, though we'll work to
          mitigate their impact on you.
        </p>
      </Section>

      <Section title="7. Acceptable Use">
        <p style={p}>You agree not to:</p>
        <ul style={ul}>
          <li style={li}>Use the Service for any unlawful purpose or in violation of any applicable healthcare, privacy, or data protection law.</li>
          <li style={li}>Attempt to access another Customer's data or bypass access controls.</li>
          <li style={li}>Interfere with or disrupt the integrity or performance of the Service.</li>
          <li style={li}>Use the Service to send unsolicited messages in violation of TCPA, CAN-SPAM, or similar laws.</li>
        </ul>
      </Section>

      <Section title="8. Intellectual Property">
        <p style={p}>
          We retain all rights in the Service and its underlying technology. You retain all rights in the data you and
          your patients provide ("Customer Data"). You grant us a limited license to use Customer Data solely to
          provide and improve the Service on your behalf.
        </p>
      </Section>

      <Section title="9. Disclaimers &amp; Limitation of Liability">
        <p style={p}>
          The Service is provided "as is" without warranties of any kind. To the maximum extent permitted by law,
          PraxisMD is not liable for indirect, incidental, or consequential damages arising from use of the Service,
          and our total liability is limited to the fees paid in the twelve months preceding a claim.
        </p>
      </Section>

      <Section title="10. Termination">
        <p style={p}>
          You may cancel at any time. We may suspend or terminate access for a material breach of these Terms,
          including non-payment or use that puts other Customers or patients at risk. Upon termination, we'll provide
          a reasonable period to export Customer Data.
        </p>
      </Section>

      <Section title="11. Governing Law">
        <p style={p}>
          These Terms are governed by the laws of the state in which PraxisMD is incorporated, without regard to
          conflict-of-law principles.
        </p>
      </Section>

      <Section title="12. Changes to These Terms">
        <p style={p}>
          We may update these Terms from time to time. Material changes will be communicated to Customers in advance
          of taking effect.
        </p>
      </Section>

      <Section title="13. Contact">
        <p style={p}>
          Questions about these Terms can be sent to <span style={strong}>legal@praxismd.health</span>.
        </p>
      </Section>
    </LegalLayout>
  );
}
