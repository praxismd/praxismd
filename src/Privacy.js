import LegalLayout, { Section } from './LegalLayout';
import { C } from './Landing';

const p = { margin: '0 0 12px' };
const ul = { margin: '0 0 12px', paddingLeft: '20px' };
const li = { marginBottom: '6px' };
const strong = { color: C.ink, fontWeight: '600' };

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" updated="September 2026">
      <Section title="1. Overview">
        <p style={p}>
          This Privacy Policy explains what information PraxisMD ("we", "us") collects through our software (the "Service"),
          how we use it, and who we share it with. It applies to the dental and medical practices that use PraxisMD
          ("Customers") and, where noted, to the patients of those practices.
        </p>
        <p style={p}>
          Where a Customer's use of the Service involves patient health information, PraxisMD acts as a <span style={strong}>Business
          Associate</span> under HIPAA and enters into a separate Business Associate Agreement (BAA) with that Customer,
          which governs our handling of Protected Health Information (PHI) and controls in the event of any conflict with
          this policy.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p style={p}>We collect information in a few different ways:</p>
        <ul style={ul}>
          <li style={li}><span style={strong}>Account &amp; practice information</span> — name, email, phone, practice name and address, and role, provided when a Customer signs up or invites a team member.</li>
          <li style={li}><span style={strong}>Patient information</span> — names, contact details, appointment history, messages, and billing records that a Customer stores or syncs into the Service (for example, via a connected GoHighLevel account) in order to run their practice.</li>
          <li style={li}><span style={strong}>Payment information</span> — handled directly by our payment processor (see Section 3); we do not store card numbers ourselves.</li>
          <li style={li}><span style={strong}>Usage data</span> — how the Service is used, for security, reliability, and product improvement.</li>
        </ul>
      </Section>

      <Section title="3. Third-Party Service Providers (Subprocessors)">
        <p style={p}>
          We rely on a small number of third-party providers to deliver the Service. We share only what each provider
          needs to do its job, and we deliberately minimize what reaches providers that don't sign a BAA.
        </p>
        <ul style={ul}>
          <li style={li}>
            <span style={strong}>Payment processing (Stripe).</span> We use Stripe to process patient payments and payment
            links. Stripe does not sign a Business Associate Agreement under HIPAA. Because of that, we do not send Stripe
            a patient's name, diagnosis, or treatment details — Stripe only ever receives the payment amount and a generic
            billing category (for example, "Co-pay collection"). If we add or change payment processors (including
            providers such as Square), the same rule applies: no patient-identifying or treatment information is sent to
            a payment processor unless that processor has signed a BAA with us.
          </li>
          <li style={li}>
            <span style={strong}>Communications &amp; CRM (GoHighLevel).</span> Customers may connect a GoHighLevel account
            to sync contacts, appointments, and two-way messaging. Data shared with GoHighLevel is governed by the
            Customer's own agreement with GoHighLevel and our BAA with the Customer.
          </li>
          <li style={li}>
            <span style={strong}>Infrastructure (Google Cloud / Firebase).</span> We host the Service and store Customer
            and patient data on Google Cloud / Firebase infrastructure.
          </li>
        </ul>
        <p style={p}>
          We do not sell patient or Customer data, and we do not share it with third parties for their own marketing
          purposes.
        </p>
      </Section>

      <Section title="4. How We Use Information">
        <ul style={ul}>
          <li style={li}>To provide, maintain, and improve the Service.</li>
          <li style={li}>To process payments and send appointment, billing, and account notifications.</li>
          <li style={li}>To provide customer support and respond to inquiries.</li>
          <li style={li}>To detect, prevent, and investigate fraud, abuse, and security incidents.</li>
          <li style={li}>To comply with legal obligations.</li>
        </ul>
      </Section>

      <Section title="5. Data Security">
        <p style={p}>
          We use industry-standard safeguards — encryption in transit, access controls, and audit logging of actions
          taken on patient records — to protect the data in our care. No system is perfectly secure, and we'll notify
          affected Customers in the event of a breach as required by law and our BAA.
        </p>
      </Section>

      <Section title="6. Data Retention">
        <p style={p}>
          We retain Customer and patient data for as long as a Customer's account is active, plus a limited period
          afterward for backup, legal, and recovery purposes, after which it is deleted or de-identified. Customers can
          request earlier deletion by contacting us.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p style={p}>
          Patients seeking to access, correct, or delete their information should contact their provider (the PraxisMD
          Customer) directly, as they control that data. Customers and account users can access or update their own
          account information within the Service, or by contacting us.
        </p>
      </Section>

      <Section title="8. Cookies">
        <p style={p}>
          We use essential cookies and local storage to keep you signed in and remember basic preferences (like theme).
          We do not use third-party advertising trackers.
        </p>
      </Section>

      <Section title="9. Children's Privacy">
        <p style={p}>
          The Service is intended for use by dental and medical practice staff, not by children. Patient records may
          include minors' information where a practice provides care to them, handled under the same safeguards as any
          other patient record.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p style={p}>
          We may update this policy from time to time. Material changes will be communicated to Customers, and the
          "Last updated" date above will reflect the most recent revision.
        </p>
      </Section>

      <Section title="11. Contact">
        <p style={p}>
          Questions about this policy or a Business Associate Agreement can be sent to <span style={strong}>privacy@praxismd.health</span>.
        </p>
      </Section>
    </LegalLayout>
  );
}
