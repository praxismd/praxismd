import { useState, createContext, useContext } from 'react';
import { light, dark } from './theme';

export const ThemeContext = createContext(light);
export const useTheme = () => useContext(ThemeContext);
function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* SIDEBAR */}
      <div style={{
        width: '240px', background: '#FAFAFA', borderRight: '1px solid #E2E8F0',
        display: 'flex', flexDirection: 'column', position: 'fixed', height: '100vh'
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #EEF2F7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px' }}>Px</div>
            <span style={{ fontSize: '19px', fontWeight: '700', color: '#0F172A' }}>PraxisMD</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '6px' }}>Bright Smiles Dental</div>
        </div>

        <nav style={{ padding: '8px 12px', flex: 1, overflowY: 'auto' }}>
          <NavSection label="Main" />
          <NavItem label="Overview" icon="📊" tab="overview" active={activeTab} onClick={setActiveTab} />
          <NavItem label="Inbox" icon="📥" tab="inbox" active={activeTab} onClick={setActiveTab} badge="4" badgeColor="#B91C1C" />
          <NavItem label="Campaigns" icon="📢" tab="campaigns" active={activeTab} onClick={setActiveTab} />
          <NavItem label="Recall" icon="🔄" tab="recall" active={activeTab} onClick={setActiveTab} badge="89" badgeColor="#92400E" />
          <NavItem label="Calendar" icon="📅" tab="calendar" active={activeTab} onClick={setActiveTab} />
          <NavItem label="Waitlist" icon="📋" tab="waitlist" active={activeTab} onClick={setActiveTab} badge="12" badgeColor="#0E7490" />
          <NavSection label="Practice" />
          <NavItem label="Patients" icon="👥" tab="patients" active={activeTab} onClick={setActiveTab} />
          <NavItem label="Patient Portal" icon="🆔" tab="portal" active={activeTab} onClick={setActiveTab} />
          <NavItem label="Eligibility" icon="🛡️" tab="eligibility" active={activeTab} onClick={setActiveTab} badge="3" badgeColor="#92400E" />
          <NavItem label="Reviews" icon="⭐" tab="reviews" active={activeTab} onClick={setActiveTab} />
          <NavItem label="Surveys" icon="😊" tab="surveys" active={activeTab} onClick={setActiveTab} />
          <NavItem label="AI Front Desk" icon="🤖" tab="aifrontdesk" active={activeTab} onClick={setActiveTab} badge="Live" badgeColor="#6D28D9" />
          <NavSection label="Billing" />
          <NavItem label="Billing" icon="🧾" tab="billing" active={activeTab} onClick={setActiveTab} badge="Pro" badgeColor="#6D28D9" />
          <NavItem label="Payments" icon="💳" tab="payments" active={activeTab} onClick={setActiveTab} />
          <NavSection label="Analytics" />
          <NavItem label="Reports" icon="📈" tab="reports" active={activeTab} onClick={setActiveTab} />
          <NavItem label="Settings" icon="⚙️" tab="settings" active={activeTab} onClick={setActiveTab} />
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #EEF2F7', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#2563EB' }}>DR</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>Dr. Rivera</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Practice owner</div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column', background: '#F0F2F5', minHeight: '100vh' }}>
        
        {/* TOPBAR */}
        <div style={{ height: '64px', background: '#FAFAFA', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', position: 'sticky', top: 0, zIndex: 50 }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#0F172A' }}>{getPageTitle(activeTab)}</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Sunday, September 13 · Bright Smiles Dental</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #E2E8F0', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#475569' }}>🔔 Notifications</button>
            <button style={{ padding: '8px 15px', borderRadius: '10px', border: 'none', background: '#2563EB', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>+ New campaign</button>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div style={{ padding: '22px 26px', flex: 1 }}>
          {activeTab === 'overview' && <Overview setActiveTab={setActiveTab} />}
          {activeTab === 'inbox' && <Inbox />}
          {activeTab === 'campaigns' && <Campaigns />}
          {activeTab === 'recall' && <Recall />}
          {activeTab === 'patients' && <Patients />}
          {activeTab === 'billing' && <Billing />}
          {activeTab === 'payments' && <Payments />}
          {activeTab === 'reports' && <Reports />}
          {activeTab === 'settings' && <Settings />}
          {activeTab === 'aifrontdesk' && <AIFrontDesk />}
          {activeTab === 'reviews' && <Reviews />}
          {activeTab === 'surveys' && <Surveys />}
          {activeTab === 'eligibility' && <Eligibility />}
          {activeTab === 'portal' && <Portal />}
          {activeTab === 'waitlist' && <Waitlist />}
          {activeTab === 'calendar' && <Calendar />}
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS ───────────────────────────────────────────────
function getPageTitle(tab) {
  const titles = {
    overview: 'Good morning, Dr. Rivera',
    inbox: 'Inbox',
    campaigns: 'Campaigns',
    recall: 'Recall & Scheduling',
    calendar: 'Calendar',
    waitlist: 'Smart Waitlist',
    patients: 'Patients',
    portal: 'Patient Portal',
    eligibility: 'Insurance Eligibility',
    reviews: 'Reviews',
    surveys: 'Patient Satisfaction',
    aifrontdesk: 'AI Front Desk',
    billing: 'Billing Automation',
    payments: 'Payments & Plans',
    reports: 'Reports',
    settings: 'Settings',
  };
  return titles[tab] || tab;
}

// ─── NAV COMPONENTS ────────────────────────────────────────
function NavSection({ label }) {
  return <div style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', padding: '14px 10px 6px' }}>{label}</div>;
}

function NavItem({ label, icon, tab, active, onClick, badge, badgeColor }) {
  const isActive = active === tab;
  return (
    <div onClick={() => onClick(tab)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 11px', borderRadius: '10px', marginBottom: '1px', background: isActive ? '#EFF6FF' : 'transparent', color: isActive ? '#2563EB' : '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? '500' : '400', transition: 'all 0.12s' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '20px', background: badgeColor + '22', color: badgeColor }}>{badge}</span>}
    </div>
  );
}

function StatCard({ label, value, color, accent, sub }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '16px 18px', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${accent}, ${color})` }} />
      <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: '700', color, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '7px' }}>{sub}</div>
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: 'white', borderRadius: '14px', padding: '18px 20px', border: '1px solid #E2E8F0', ...style }}>{children}</div>;
}

function CardTitle({ children }) {
  return <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{children}</div>;
}

function Pill({ label, color, bg }) {
  return <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px', background: bg, color, whiteSpace: 'nowrap' }}>{label}</span>;
}

function RowItem({ children, style }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 13px', borderRadius: '10px', background: '#F8FAFC', marginBottom: '7px', border: '1px solid #EEF2F7', ...style }}>{children}</div>;
}

function Ava({ initials, bg, color }) {
  return <div style={{ width: '34px', height: '34px', minWidth: '34px', borderRadius: '10px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>{initials}</div>;
}

function Btn({ children, onClick, primary, small, style }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: small ? '5px 11px' : '8px 14px', borderRadius: '10px', border: primary ? 'none' : '1px solid #E2E8F0', background: primary ? '#2563EB' : 'white', color: primary ? 'white' : '#475569', fontSize: small ? '12px' : '13px', fontWeight: '500', cursor: 'pointer', ...style }}>{children}</button>
  );
}

// ─── OVERVIEW ──────────────────────────────────────────────
function Overview({ setActiveTab }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '20px' }}>
        <StatCard label="Revenue recovered" value="$8,400" color="#0F7B54" accent="#10B981" sub="↑ 14 patients reactivated" />
        <StatCard label="Appointments booked" value="31" color="#2563EB" accent="#3B82F6" sub="↑ 8 from campaigns" />
        <StatCard label="Google rating" value="4.8 ★" color="#92400E" accent="#F59E0B" sub="↑ 6 new reviews" />
        <StatCard label="Open messages" value="4" color="#B91C1C" accent="#EF4444" sub="Needs reply today" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '13px', marginBottom: '20px' }}>
        <StatCard label="Claims pending" value="7" color="#6D28D9" accent="#8B5CF6" sub="$4,200 in queue" />
        <StatCard label="Recall due" value="89" color="#0E7490" accent="#06B6D4" sub="Overdue 6-month" />
        <StatCard label="AI calls handled" value="47" color="#0F7B54" accent="#10B981" sub="Today · 0 missed" />
        <StatCard label="NPS score" value="72" color="#9D174D" accent="#EC4899" sub="↑ 4 pts this month" />
        <StatCard label="Waitlist filled" value="3" color="#C2410C" accent="#F97316" sub="Auto-filled today" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <Card>
          <CardTitle>Active campaigns <span onClick={() => setActiveTab('campaigns')} style={{ fontSize: '12px', color: '#2563EB', cursor: 'pointer', fontWeight: '500' }}>View all →</span></CardTitle>
          <RowItem style={{ background: '#ECFDF5', borderColor: 'rgba(16,185,129,.15)' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>6-month reactivation</div><div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>142 patients · Touch 3 of 7</div></div>
            <Pill label="Live" color="#0F7B54" bg="#ECFDF5" />
          </RowItem>
          <RowItem style={{ background: '#ECFDF5', borderColor: 'rgba(16,185,129,.15)' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>Post-visit review request</div><div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>Auto-sends after every visit</div></div>
            <Pill label="Auto" color="#2563EB" bg="#EFF6FF" />
          </RowItem>
          <RowItem style={{ background: '#FFFBEB', borderColor: 'rgba(245,158,11,.15)' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>Annual checkup reminder</div><div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>89 patients · Scheduled Sep 20</div></div>
            <Pill label="Queued" color="#92400E" bg="#FFFBEB" />
          </RowItem>
        </Card>

        <Card>
          <CardTitle>Today's appointments</CardTitle>
          <RowItem><div style={{ fontSize: '11.5px', color: '#94A3B8', width: '50px', flexShrink: 0, fontWeight: '500' }}>9:00 AM</div><Ava initials="SM" bg="#EFF6FF" color="#2563EB" /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>Sarah Martinez</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Cleaning · 60 min</div></div><Pill label="Confirmed" color="#0F7B54" bg="#ECFDF5" /></RowItem>
          <RowItem><div style={{ fontSize: '11.5px', color: '#94A3B8', width: '50px', flexShrink: 0, fontWeight: '500' }}>10:30 AM</div><Ava initials="JL" bg="#FFFBEB" color="#92400E" /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>James Lee</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Crown fitting · 90 min</div></div><Pill label="Pending" color="#92400E" bg="#FFFBEB" /></RowItem>
          <RowItem><div style={{ fontSize: '11.5px', color: '#94A3B8', width: '50px', flexShrink: 0, fontWeight: '500' }}>2:00 PM</div><Ava initials="AK" bg="#ECFDF5" color="#0F7B54" /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>Amy Kim</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Whitening · 45 min</div></div><Pill label="Confirmed" color="#0F7B54" bg="#ECFDF5" /></RowItem>
          <RowItem style={{ background: '#FEF2F2', borderColor: 'rgba(239,68,68,.15)' }}><div style={{ fontSize: '11.5px', color: '#94A3B8', width: '50px', flexShrink: 0, fontWeight: '500' }}>4:00 PM</div><Ava initials="RP" bg="#FEF2F2" color="#B91C1C" /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>Robert Park</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Emergency · tooth pain</div></div><Pill label="Urgent" color="#B91C1C" bg="#FEF2F2" /></RowItem>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Recent messages <span onClick={() => setActiveTab('inbox')} style={{ fontSize: '12px', color: '#2563EB', cursor: 'pointer', fontWeight: '500' }}>View all →</span></CardTitle>
          {[{ ini: 'MC', bg: '#EFF6FF', c: '#2563EB', name: 'Maria Chen', msg: "Yes I'd like to book the cleaning for next week", time: '2m ago', unread: true },
            { ini: 'DW', bg: '#FFFBEB', c: '#92400E', name: 'David Wong', msg: 'Can I reschedule my 3pm appointment?', time: '18m ago', unread: true },
            { ini: 'TN', bg: '#ECFDF5', c: '#0F7B54', name: 'Tina Nguyen', msg: 'Thank you! I left you a Google review ⭐', time: '1h ago', unread: false }
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: '11px', padding: '11px 13px', borderRadius: '10px', marginBottom: '6px', background: m.unread ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${m.unread ? 'rgba(59,130,246,.15)' : '#EEF2F7'}` }}>
              <Ava initials={m.ini} bg={m.unread ? m.c : m.bg} color={m.unread ? 'white' : m.c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{m.name}</span><span style={{ fontSize: '11px', color: '#94A3B8' }}>{m.time}</span></div>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.msg}</div>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <CardTitle>AI front desk — today</CardTitle>
          {[['📞', 'Calls answered', '47', '#2563EB'], ['📅', 'Appointments booked', '6', '#0F7B54'], ['🤖', 'Messages handled', '23', '#2563EB'], ['✋', 'Escalated to team', '2', '#92400E']].map(([icon, label, val, color], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: '#F8FAFC', borderRadius: '10px', marginBottom: '6px', border: '1px solid #EEF2F7' }}>
              <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}><span>{icon}</span>{label}</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color }}>{val}</div>
            </div>
          ))}
          <div style={{ marginTop: '8px', padding: '10px 12px', background: '#ECFDF5', borderRadius: '10px', fontSize: '12px', color: '#0F7B54', fontWeight: '500', border: '1px solid rgba(16,185,129,.15)' }}>⚡ AI saved your team ~4.2 hours today</div>
        </Card>
      </div>
    </div>
  );
}

// ─── INBOX ─────────────────────────────────────────────────
function Inbox() {
  const messages = [
    { ini: 'MC', bg: '#EFF6FF', c: '#2563EB', name: 'Maria Chen', via: 'via SMS · 2 minutes ago', msg: "Yes I'd like to book the cleaning for next week — does Tuesday work?", ai: 'Tuesday the 17th at 10am or 2pm are available — which works better?', borderColor: '#2563EB' },
    { ini: 'DW', bg: '#FFFBEB', c: '#92400E', name: 'David Wong', via: 'via SMS · 18 minutes ago', msg: 'Can I reschedule my 3pm appointment? Something came up at work.', ai: 'Of course! We have Thursday at 2pm or Friday at 10am — which works?', borderColor: '#F59E0B' },
    { ini: 'RP', bg: '#FEF2F2', c: '#B91C1C', name: 'Robert Park', via: 'missed call · 45 minutes ago', msg: 'AI answered call — triaged tooth pain. Booked 4pm emergency slot automatically.', ai: null, borderColor: '#EF4444' },
    { ini: 'TN', bg: '#ECFDF5', c: '#0F7B54', name: 'Tina Nguyen', via: 'via SMS · 1 hour ago', msg: 'Thank you for the great service! I left you a 5-star Google review 😊', ai: null, borderColor: '#10B981' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['All (4)', 'SMS', 'Email', 'Missed calls', 'Voicemail'].map((t, i) => (
          <span key={i} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: i === 0 ? 'none' : '1px solid #E2E8F0', background: i === 0 ? '#2563EB' : 'white', color: i === 0 ? 'white' : '#475569' }}>{t}</span>
        ))}
      </div>
      {messages.map((m, i) => (
        <div key={i} style={{ background: 'white', borderRadius: '14px', padding: '16px 18px', border: '1px solid #E2E8F0', marginBottom: '10px', borderLeft: `4px solid ${m.borderColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '11px', alignItems: 'center' }}>
              <Ava initials={m.ini} bg={m.bg} color={m.c} />
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{m.name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{m.via}</div></div>
            </div>
            <div style={{ display: 'flex', gap: '7px' }}>
              {m.ai && <Btn small>↩ Reply</Btn>}
              {m.ai && <Btn small primary>📅 Book</Btn>}
              {!m.ai && i === 2 && <Btn small>📞 Call back</Btn>}
              {!m.ai && i === 3 && <Pill label="Read" color="#0F7B54" bg="#ECFDF5" />}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: '#1E293B', padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px' }}>{m.msg}</div>
          {m.ai && (
            <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#475569', marginTop: '10px', borderLeft: '3px solid #3B82F6' }}>
              <div style={{ color: '#2563EB', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '4px' }}>✨ AI suggested reply</div>
              {m.ai}
              <br /><Btn small primary style={{ marginTop: '8px' }}>Send this</Btn>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── CAMPAIGNS ─────────────────────────────────────────────
function Campaigns() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Patients in sequences" value="231" color="#2563EB" accent="#3B82F6" sub="" />
        <StatCard label="Replies this month" value="47" color="#92400E" accent="#F59E0B" sub="↑ 20% from last month" />
        <StatCard label="Booked from campaigns" value="14" color="#0F7B54" accent="#10B981" sub="$8,400 revenue recovered" />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <Btn primary>+ New campaign</Btn>
        <Btn>⬇ Export</Btn>
      </div>
      {[
        { name: '6-month reactivation sequence', sub: '142 patients · 7-touch email + SMS · Touch 3 of 7', stats: [['Open rate', '34%', '#2563EB'], ['Reply rate', '18%', '#2563EB'], ['Booked', '9', '#0F7B54'], ['Revenue', '$5,400', '#0F7B54'], ['Cost/booking', '$35', '#6D28D9']], pill: 'Live', pillColor: '#0F7B54', pillBg: '#ECFDF5', prog: 43 },
        { name: 'Post-visit review request', sub: 'Auto-sends 24hrs after every completed appointment', stats: [['Sent this month', '28', '#2563EB'], ['Clicked', '19', '#2563EB'], ['Reviews left', '6', '#0F7B54'], ['Avg rating', '4.8 ★', '#92400E']], pill: 'Auto', pillColor: '#2563EB', pillBg: '#EFF6FF', prog: null },
        { name: 'Annual checkup reminder', sub: '89 patients · 3-touch SMS · Scheduled September 20', stats: [], pill: 'Queued', pillColor: '#92400E', pillBg: '#FFFBEB', prog: null },
      ].map((c, i) => (
        <Card key={i} style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div><div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>{c.name}</div><div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{c.sub}</div></div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Pill label={c.pill} color={c.pillColor} bg={c.pillBg} />{c.pill === 'Live' && <Btn small>Pause</Btn>}{c.pill === 'Queued' && <Btn small>Launch now</Btn>}</div>
          </div>
          {c.stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${c.stats.length},1fr)`, gap: '10px', marginBottom: c.prog ? '10px' : '0' }}>
              {c.stats.map(([label, val, color], j) => (
                <div key={j} style={{ textAlign: 'center', padding: '10px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #EEF2F7' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{label}</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color }}>{val}</div>
                </div>
              ))}
            </div>
          )}
          {c.prog && <div><div style={{ height: '4px', borderRadius: '3px', background: '#E2E8F0', overflow: 'hidden', marginTop: '8px' }}><div style={{ height: '100%', borderRadius: '3px', background: '#10B981', width: `${c.prog}%` }} /></div><div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '5px' }}>Touch 3 of 7 · {c.prog}% through sequence</div></div>}
          {c.pill === 'Queued' && <div style={{ padding: '10px 12px', background: '#FFFBEB', borderRadius: '10px', fontSize: '12px', color: '#92400E', border: '1px solid rgba(245,158,11,.15)', marginTop: '8px' }}>🕐 Scheduled in 7 days · 89 patients receive first touch September 20</div>}
        </Card>
      ))}
    </div>
  );
}

// ─── RECALL ────────────────────────────────────────────────
function Recall() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Recall due this month" value="89" color="#0E7490" accent="#06B6D4" sub="Overdue for 6-month cleaning" />
        <StatCard label="Recalled this month" value="34" color="#0F7B54" accent="#10B981" sub="↑ 38% conversion rate" />
        <StatCard label="Recall revenue" value="$6,120" color="#2563EB" accent="#3B82F6" sub="From recalled patients" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Recall sequence — auto-touch</CardTitle>
          {[['3 months post-visit', 'Friendly reminder email — "Time for your checkup"', 'Active'],
            ['5 months post-visit', 'SMS — "Your cleaning is due next month"', 'Active'],
            ['6 months post-visit', 'SMS + email — "Book your cleaning today"', 'Active'],
            ['7 months — overdue', 'Urgent SMS — "Don\'t forget your dental health"', 'Overdue'],
          ].map(([title, sub, status], i) => (
            <RowItem key={i} style={status === 'Overdue' ? { background: '#FEF2F2', borderColor: 'rgba(239,68,68,.15)' } : { background: '#ECFDF5', borderColor: 'rgba(16,185,129,.15)' }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{title}</div><div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>{sub}</div></div>
              <Pill label={status} color={status === 'Overdue' ? '#B91C1C' : '#0F7B54'} bg={status === 'Overdue' ? '#FEF2F2' : '#ECFDF5'} />
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Overdue patients — action needed</CardTitle>
          {[['RP', '#FEF2F2', '#B91C1C', 'Robert Park', 'Last visit Jan 12 · 8 months overdue'],
            ['JL', '#FFFBEB', '#92400E', 'James Lee', 'Last visit Aug 20 · 1 month overdue'],
            ['MC', '#FEF2F2', '#B91C1C', 'Maria Chen', 'Last visit Mar 5 · 6 months overdue'],
          ].map(([ini, bg, c, name, sub], i) => (
            <RowItem key={i} style={{ background: bg, borderColor: 'rgba(239,68,68,.15)' }}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{sub}</div></div>
              <Btn small>Send recall</Btn>
            </RowItem>
          ))}
          <Btn primary style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>📨 Send bulk recall to all 89 patients</Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── PATIENTS ──────────────────────────────────────────────
function Patients() {
  const patients = [
    ['Sarah Martinez', 'sarah.m@email.com', 'Sep 13, 2026', 'Delta Dental', 'Active', '#0F7B54', '#ECFDF5'],
    ['James Lee', 'jlee@gmail.com', 'Aug 20, 2026', 'Aetna', 'Upcoming', '#92400E', '#FFFBEB'],
    ['Maria Chen', 'mchen@email.com', 'Mar 5, 2026', 'Cigna', 'Reactivating', '#2563EB', '#EFF6FF'],
    ['Robert Park', 'rpark@gmail.com', 'Jan 12, 2026', 'UnitedHealth', 'Overdue', '#B91C1C', '#FEF2F2'],
    ['Tina Nguyen', 'tnguyen@email.com', 'Sep 12, 2026', 'Blue Cross', 'Active', '#0F7B54', '#ECFDF5'],
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input placeholder="Search patients by name, email, or phone..." style={{ flex: 1, padding: '9px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#F8FAFC', color: '#1E293B' }} />
        <Btn primary>+ Add patient</Btn>
        <Btn>⬆ Import</Btn>
      </div>
      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead><tr>{['Patient', 'Last visit', 'Insurance', 'Status', ''].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '9px 13px', color: '#94A3B8', fontWeight: '500', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #E2E8F0' }}>{h}</th>)}</tr></thead>
          <tbody>
            {patients.map(([name, email, visit, ins, status, color, bg], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #EEF2F7' }}>
                <td style={{ padding: '11px 13px' }}><div style={{ fontWeight: '500', color: '#1E293B' }}>{name}</div><div style={{ fontSize: '11px', color: '#94A3B8' }}>{email}</div></td>
                <td style={{ padding: '11px 13px', color: '#475569' }}>{visit}</td>
                <td style={{ padding: '11px 13px', color: '#475569' }}>{ins}</td>
                <td style={{ padding: '11px 13px' }}><Pill label={status} color={color} bg={bg} /></td>
                <td style={{ padding: '11px 13px', textAlign: 'right' }}><Btn small>View</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── BILLING ───────────────────────────────────────────────
function Billing() {
  return (
    <div>
      <div style={{ padding: '11px 15px', background: '#F5F3FF', borderRadius: '10px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid rgba(109,40,217,.15)' }}>
        <span>⚡</span><span style={{ fontSize: '13px', color: '#6D28D9', fontWeight: '500' }}>Pro — Billing automation active · Connected to Office Ally clearinghouse</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '18px' }}>
        <StatCard label="Claims submitted" value="48" color="#2563EB" accent="#3B82F6" sub="This month" />
        <StatCard label="Claims paid" value="39" color="#0F7B54" accent="#10B981" sub="$28,400 collected" />
        <StatCard label="Pending" value="7" color="#92400E" accent="#F59E0B" sub="$4,200 in queue" />
        <StatCard label="Denials" value="2" color="#B91C1C" accent="#EF4444" sub="Action needed" />
      </div>
      <Card>
        <CardTitle>Recent claims</CardTitle>
        {[
          { name: 'Sarah Martinez', code: 'D1110 · Prophylaxis · Delta Dental · ERA auto-posted', amount: '$180', status: 'Paid', color: '#0F7B54', bg: '#ECFDF5' },
          { name: 'James Lee', code: 'D2740 · Crown · Aetna · Submitted 3 days ago', amount: '$1,200', status: 'Pending', color: '#92400E', bg: '#FFFBEB' },
          { name: 'Robert Park', code: 'D7210 · Extraction · UnitedHealth · Denied: Missing info', amount: '$320', status: 'Denied', color: '#B91C1C', bg: '#FEF2F2' },
        ].map((c, i) => (
          <div key={i} style={{ padding: '10px 13px', borderRadius: '10px', marginBottom: '6px', background: c.bg, border: `1px solid ${c.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{c.name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>{c.code}</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: c.color }}>{c.amount}</span>
              {c.status === 'Denied' ? <Btn small style={{ color: c.color, borderColor: c.color }}>↻ Resubmit</Btn> : <Pill label={c.status} color={c.color} bg={c.bg} />}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── PAYMENTS ──────────────────────────────────────────────
function Payments() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Collected this month" value="$12,840" color="#0F7B54" accent="#10B981" sub="↑ 18% from last month" />
        <StatCard label="Active payment plans" value="8" color="#2563EB" accent="#3B82F6" sub="$4,200 total outstanding" />
        <StatCard label="Co-pays collected online" value="$3,240" color="#92400E" accent="#F59E0B" sub="Before patients arrived" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Active payment plans</CardTitle>
          {[
            ['JL', '#EFF6FF', '#2563EB', 'James Lee · Crown $1,200', '$300/mo · 3 payments remaining', 'On track', '#0F7B54', '#ECFDF5'],
            ['PG', '#F5F3FF', '#6D28D9', 'Patricia Green · Implant $3,200', '$200/mo · 14 payments remaining', 'On track', '#0F7B54', '#ECFDF5'],
            ['MB', '#FEF2F2', '#B91C1C', 'Mike Brown · Veneers $2,400', 'Payment failed Sep 10 — card declined', 'Failed', '#B91C1C', '#FEF2F2'],
          ].map(([ini, bg, c, name, sub, status, sc, sbg], i) => (
            <RowItem key={i} style={status === 'Failed' ? { background: '#FEF2F2', borderColor: 'rgba(239,68,68,.15)' } : {}}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{sub}</div></div>
              {status === 'Failed' ? <Btn small style={{ color: sc, borderColor: sc }}>Retry</Btn> : <Pill label={status} color={sc} bg={sbg} />}
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Send payment request</CardTitle>
          {[['Patient name', 'text', 'Search patient...'], ['Amount', 'text', '$0.00']].map(([label, type, placeholder], i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px', display: 'block' }}>{label}</label>
              <input type={type} placeholder={placeholder} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#F8FAFC', color: '#1E293B' }} />
            </div>
          ))}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px', display: 'block' }}>Type</label>
            <select style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#F8FAFC', color: '#1E293B' }}>
              <option>Co-pay collection</option><option>Balance due</option><option>Deposit for procedure</option><option>Payment plan setup</option>
            </select>
          </div>
          <Btn primary style={{ width: '100%', justifyContent: 'center' }}>📨 Send payment link via SMS</Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── AI FRONT DESK ─────────────────────────────────────────
function AIFrontDesk() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Calls answered today" value="47" color="#0F7B54" accent="#10B981" sub="0 missed · 100% rate" />
        <StatCard label="Appts booked by AI" value="6" color="#2563EB" accent="#3B82F6" sub="No human involvement" />
        <StatCard label="Escalated to staff" value="2" color="#92400E" accent="#F59E0B" sub="Complex cases only" />
        <StatCard label="Hours saved today" value="4.2h" color="#6D28D9" accent="#8B5CF6" sub="Front desk time reclaimed" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Recent call log</CardTitle>
          {[
            { dot: '#10B981', title: 'Robert Park · 3 min · Emergency', sub: 'AI triaged tooth pain. Booked 4pm emergency slot. Sent intake form via SMS.', pill: 'Booked', c: '#0F7B54', bg: '#ECFDF5' },
            { dot: '#10B981', title: 'Unknown · 2 min · Hours inquiry', sub: 'Asked about office hours and parking. AI answered. Offered to book a cleaning.', pill: 'Resolved', c: '#2563EB', bg: '#EFF6FF' },
            { dot: '#F59E0B', title: 'Maria Chen · 4 min · Insurance Q', sub: 'Asked about Delta Dental coverage. AI escalated to staff — required plan lookup.', pill: 'Escalated', c: '#92400E', bg: '#FFFBEB' },
            { dot: '#10B981', title: 'David Wong · 2 min · Reschedule', sub: 'Wanted to move Thursday appt. AI checked calendar, offered two alternatives. Done.', pill: 'Rescheduled', c: '#0F7B54', bg: '#ECFDF5' },
          ].map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: '#F8FAFC', borderRadius: '10px', marginBottom: '7px', border: '1px solid #EEF2F7' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.dot, marginTop: '5px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{c.title}</div><div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>{c.sub}</div></div>
              <Pill label={c.pill} color={c.c} bg={c.bg} />
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle>AI voice settings</CardTitle>
          {[['AI voice name', 'What callers hear when AI picks up', 'Alex'],
            ['Auto-book appointments', 'AI can book without staff approval', 'On'],
            ['Emergency escalation', 'Keywords that trigger urgent alert to staff', 'On'],
            ['After-hours SMS fallback', 'Texts caller if they call when closed', 'On'],
            ['Call recording', 'Stored 90 days · HIPAA compliant', 'On'],
          ].map(([title, sub, val], i) => (
            <RowItem key={i} style={{ justifyContent: 'space-between' }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{title}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{sub}</div></div>
              <span style={{ fontSize: i === 0 ? '13px' : '11px', color: i === 0 ? '#2563EB' : '#0F7B54', fontWeight: '500', background: i === 0 ? 'transparent' : '#ECFDF5', padding: i === 0 ? '0' : '3px 9px', borderRadius: '20px' }}>{val}</span>
            </RowItem>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── REVIEWS ───────────────────────────────────────────────
function Reviews() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Google rating" value="4.8 ★" color="#92400E" accent="#F59E0B" sub="From 142 total reviews" />
        <StatCard label="New this month" value="6" color="#0F7B54" accent="#10B981" sub="↑ 3 from last month" />
        <StatCard label="Response rate" value="92%" color="#2563EB" accent="#3B82F6" sub="Industry avg is 54%" />
      </div>
      <Card>
        <CardTitle>Recent reviews</CardTitle>
        {[
          { stars: '★★★★★', text: '"Dr. Rivera and the team are absolutely wonderful. The automated reminder texts are so convenient!"', author: '— Sarah M. · 2 days ago · Google', negative: false },
          { stars: '★★★☆☆', text: '"Good dentist but the wait time was a bit long. Would appreciate better scheduling."', author: '— Anonymous · 1 week ago · Google', negative: true },
        ].map((r, i) => (
          <div key={i} style={{ padding: '14px', borderRadius: '10px', background: '#F8FAFC', marginBottom: '10px', border: '1px solid #EEF2F7', borderLeft: `3px solid ${r.negative ? '#EF4444' : '#F59E0B'}` }}>
            <div style={{ color: '#F59E0B', fontSize: '13px', marginBottom: '5px', letterSpacing: '1px' }}>{r.stars}</div>
            <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.6' }}>{r.text}</div>
            <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '7px' }}>{r.author}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              {r.negative && <Btn small primary>🤖 AI draft response</Btn>}
              <Btn small>Reply</Btn>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── SURVEYS ───────────────────────────────────────────────
function Surveys() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="NPS score" value="72" color="#9D174D" accent="#EC4899" sub="↑ 4 pts from last month" />
        <StatCard label="Promoters (9-10)" value="68%" color="#0F7B54" accent="#10B981" sub="Would recommend us" />
        <StatCard label="Detractors (0-6)" value="12%" color="#B91C1C" accent="#EF4444" sub="Needs follow-up" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Recent responses</CardTitle>
          {[['TN', '#ECFDF5', '#0F7B54', 'Tina Nguyen · Score: 10', '"Amazing experience — staff was so kind!"', 'Promoter', '#0F7B54', '#ECFDF5'],
            ['SM', '#EFF6FF', '#2563EB', 'Sarah Martinez · Score: 9', '"Great service, would definitely return"', 'Promoter', '#0F7B54', '#ECFDF5'],
            ['AN', '#FEF2F2', '#B91C1C', 'Anonymous · Score: 4', '"Wait time too long, felt rushed"', 'Detractor', '#B91C1C', '#FEF2F2'],
          ].map(([ini, bg, c, name, text, status, sc, sbg], i) => (
            <RowItem key={i} style={status === 'Detractor' ? { background: '#FEF2F2', borderColor: 'rgba(239,68,68,.15)' } : {}}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{text}</div></div>
              <Pill label={status} color={sc} bg={sbg} />
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>NPS breakdown</CardTitle>
          {[['Promoters (9-10)', '68%', '#10B981'], ['Passives (7-8)', '20%', '#F59E0B'], ['Detractors (0-6)', '12%', '#EF4444']].map(([label, pct, color], i) => (
            <div key={i} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94A3B8', marginBottom: '5px' }}><span>{label}</span><span style={{ color, fontWeight: '600' }}>{pct}</span></div>
              <div style={{ height: '4px', borderRadius: '3px', background: '#E2E8F0', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', background: color, width: pct }} /></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── ELIGIBILITY ───────────────────────────────────────────
function Eligibility() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Verified today" value="4" color="#0F7B54" accent="#10B981" sub="Auto-checked before appt" />
        <StatCard label="Issues found" value="3" color="#92400E" accent="#F59E0B" sub="Requires action before visit" />
        <StatCard label="Denials prevented" value="$2,840" color="#2563EB" accent="#3B82F6" sub="This month in saved claims" />
      </div>
      <Card>
        <CardTitle>Today's verification results</CardTitle>
        {[
          { ini: 'SM', bg: '#EFF6FF', c: '#2563EB', name: 'Sarah Martinez · Delta Dental', sub: '$1,200 remaining benefits · $0 deductible · D1110 covered 100%', status: 'Verified ✓', sc: '#0F7B54', sbg: '#ECFDF5', rowBg: '#F8FAFC' },
          { ini: 'JL', bg: '#FFFBEB', c: '#92400E', name: 'James Lee · Aetna', sub: '⚠ Deductible not met · Patient owes $450 before insurance kicks in', status: 'Action needed', sc: '#92400E', sbg: '#FFFBEB', rowBg: '#FFFBEB' },
          { ini: 'AK', bg: '#ECFDF5', c: '#0F7B54', name: 'Amy Kim · Cigna', sub: 'D9972 whitening not covered · Patient responsible for full $280', status: 'Verified ✓', sc: '#0E7490', sbg: '#ECFEFF', rowBg: '#F8FAFC' },
          { ini: 'RP', bg: '#FEF2F2', c: '#B91C1C', name: 'Robert Park · UnitedHealth', sub: '⚠ Policy terminated Sep 1 · No active coverage — collect full payment', status: 'No coverage', sc: '#B91C1C', sbg: '#FEF2F2', rowBg: '#FEF2F2' },
        ].map((e, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', background: e.rowBg, borderRadius: '10px', marginBottom: '6px', border: '1px solid #EEF2F7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <Ava initials={e.ini} bg={e.bg} color={e.c} />
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{e.name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px' }}>{e.sub}</div></div>
            </div>
            <Pill label={e.status} color={e.sc} bg={e.sbg} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── PORTAL ────────────────────────────────────────────────
function Portal() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Forms pending" value="7" color="#6D28D9" accent="#8B5CF6" sub="Awaiting patient completion" />
        <StatCard label="Completed this week" value="18" color="#0F7B54" accent="#10B981" sub="↑ 94% completion rate" />
        <StatCard label="Docs e-signed" value="31" color="#2563EB" accent="#3B82F6" sub="No paper needed" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Pending intake forms</CardTitle>
          {[['RP', '#FEF2F2', '#B91C1C', 'Robert Park', 'Emergency intake — due before 4pm today', true],
            ['JL', '#FFFBEB', '#92400E', 'James Lee', 'Crown consent form — sent Sep 10', false],
            ['MC', '#EFF6FF', '#2563EB', 'Maria Chen', 'New patient health history — sent Sep 12', false],
          ].map(([ini, bg, c, name, sub, urgent], i) => (
            <RowItem key={i} style={urgent ? { background: '#FEF2F2', borderColor: 'rgba(239,68,68,.15)' } : {}}>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{sub}</div></div>
              <Btn small primary={urgent}>Remind</Btn>
            </RowItem>
          ))}
        </Card>
        <Card>
          <CardTitle>Available forms</CardTitle>
          {['New patient health history', 'HIPAA consent form', 'Treatment plan consent', 'Insurance update form', 'Financial responsibility agreement'].map((form, i) => (
            <RowItem key={i} style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#1E293B' }}>{form}</span>
              <Btn small>Send</Btn>
            </RowItem>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── WAITLIST ──────────────────────────────────────────────
function Waitlist() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="On waitlist" value="12" color="#0E7490" accent="#06B6D4" sub="Waiting for open slots" />
        <StatCard label="Slots filled this week" value="5" color="#0F7B54" accent="#10B981" sub="Auto-filled · no manual work" />
        <StatCard label="Avg fill time" value="8 min" color="#2563EB" accent="#3B82F6" sub="From cancellation to fill" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <Card>
          <CardTitle>Current waitlist</CardTitle>
          {[['1', 'MC', '#EFF6FF', '#2563EB', 'Maria Chen', 'Cleaning · Any time this week', 'Next up', '#2563EB', '#EFF6FF'],
            ['2', 'DW', '#FFFBEB', '#92400E', 'David Wong', 'Cleaning · Mornings preferred', '#2', '#94A3B8', '#F8FAFC'],
            ['3', 'SK', '#ECFDF5', '#0F7B54', 'Sam Kim', 'Exam · Afternoons only', '#3', '#94A3B8', '#F8FAFC'],
          ].map(([rank, ini, bg, c, name, sub, pill, pc, pbg], i) => (
            <RowItem key={i}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{rank}</div>
              <Ava initials={ini} bg={bg} color={c} />
              <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{sub}</div></div>
              <Pill label={pill} color={pc} bg={pbg} />
            </RowItem>
          ))}
          <div style={{ marginTop: '10px', padding: '10px 12px', background: '#ECFEFF', borderRadius: '10px', fontSize: '12px', color: '#0E7490', border: '1px solid rgba(14,116,144,.15)' }}>⚡ When a slot opens PraxisMD auto-texts the next patient. First to reply gets the spot.</div>
        </Card>
        <Card>
          <CardTitle>Recent auto-fills</CardTitle>
          {[['Today 2:30pm — filled in 4 min', 'Maria Chen accepted · David Wong declined'],
            ['Yesterday 10am — filled in 11 min', 'Sam Kim accepted the slot'],
            ['Sep 11 4pm — filled in 6 min', 'Priya Patel accepted the slot'],
          ].map(([title, sub], i) => (
            <RowItem key={i} style={{ justifyContent: 'space-between' }}>
              <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{title}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{sub}</div></div>
              <Pill label="Filled" color="#0F7B54" bg="#ECFDF5" />
            </RowItem>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── CALENDAR ──────────────────────────────────────────────
function Calendar() {
  const appts = { 13: 4, 15: 2, 16: 3, 17: 5, 18: 2, 20: 1, 22: 3, 23: 4, 24: 2, 27: 3, 29: 2, 30: 3 };
  const days = [];
  for (let i = 0; i < 2; i++) days.push(null);
  for (let d = 1; d <= 30; d++) days.push(d);
  return (
    <Card>
      <CardTitle>September 2026 <div style={{ display: 'flex', gap: '8px' }}><Btn small>← Prev</Btn><Btn small>Next →</Btn></div></CardTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '6px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600', textAlign: 'center', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '.5px' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          const isToday = d === 13;
          const has = appts[d] || 0;
          return (
            <div key={i} style={{ borderRadius: '10px', padding: '8px 6px', textAlign: 'center', cursor: 'pointer', minHeight: '54px', border: `1px solid ${isToday ? '#1D4ED8' : has ? 'rgba(59,130,246,.2)' : '#EEF2F7'}`, background: isToday ? '#2563EB' : has ? '#EFF6FF' : '#F8FAFC', transition: 'all .12s' }}>
              <div style={{ fontSize: '13px', fontWeight: isToday ? '700' : has ? '500' : '400', color: isToday ? 'white' : has ? '#1E293B' : '#94A3B8' }}>{d}</div>
              {has > 0 && <div style={{ fontSize: '10px', marginTop: '3px', color: isToday ? 'rgba(255,255,255,.85)' : '#2563EB', fontWeight: '600' }}>{has} apt{has > 1 ? 's' : ''}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '14px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #EEF2F7' }}>
        {[['#2563EB', 'Today'], ['#EFF6FF', 'Has appointments'], ['#F8FAFC', 'Available']].map(([bg, label], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#94A3B8' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: bg, border: '1px solid #E2E8F0' }} />{label}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── REPORTS ───────────────────────────────────────────────
function Reports() {
  const metrics = [
    ['Reactivation emails sent', '847', '#2563EB'], ['SMS messages sent', '312', '#2563EB'],
    ['Email open rate', '34%', '#2563EB'], ['Reply rate', '18%', '#2563EB'],
    ['Cost per booked appointment', '$35', '#0F7B54'], ['Recall conversion rate', '38%', '#0E7490'],
    ['Reviews collected', '6', '#92400E'], ['Average Google rating', '4.8 ★', '#92400E'],
    ['NPS score', '72', '#9D174D'], ['Waitlist slots filled', '14', '#C2410C'],
    ['Insurance denials prevented', '$2,840', '#0F7B54'], ['AI front desk calls', '847', '#6D28D9'],
    ['Claims submitted', '48', '#6D28D9'], ['Claims paid · revenue', '39 · $28,400', '#0F7B54'],
    ['AI hours saved total', '~68 hrs', '#0F7B54'],
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['September 2026', 'August', 'July', 'Q3 2026'].map((t, i) => (
          <span key={i} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: i === 0 ? 'none' : '1px solid #E2E8F0', background: i === 0 ? '#2563EB' : 'white', color: i === 0 ? 'white' : '#475569' }}>{t}</span>
        ))}
        <Btn small>⬇ Export PDF</Btn>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '13px', marginBottom: '16px' }}>
        <StatCard label="Revenue recovered" value="$8,400" color="#0F7B54" accent="#10B981" sub="↑ 24% vs last month" />
        <StatCard label="New appointments" value="31" color="#2563EB" accent="#3B82F6" sub="↑ 8 from campaigns" />
        <StatCard label="Patient retention" value="87%" color="#0E7490" accent="#06B6D4" sub="↑ 4% improvement" />
      </div>
      <Card>
        <CardTitle>Monthly performance breakdown</CardTitle>
        {metrics.map(([label, val, color], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', background: '#F8FAFC', borderRadius: '10px', marginBottom: '6px', border: '1px solid #EEF2F7' }}>
            <span style={{ fontSize: '12.5px', color: '#475569' }}>{label}</span>
            <span style={{ fontSize: '14px', fontWeight: '600', color }}>{val}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────
function Settings() {
  const integrations = [
    ['GoHighLevel', 'CRM and automation', true],
    ['Office Ally', 'Clearinghouse · billing', true],
    ['Stripe', 'Payment processing', true],
    ['Google Business', 'Reviews and reputation', false],
    ['Dentrix', 'Practice management sync', false],
    ['Eaglesoft', 'Practice management sync', false],
    ['Availity', 'Eligibility verification', false],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
      <Card>
        <CardTitle>Practice details</CardTitle>
        {[['Practice name', 'Bright Smiles Dental'], ['Phone number', '(813) 555-0142'], ['Email', 'hello@brightsmiles.com'], ['Address', '4210 W Bay Ave, Tampa FL 33616'], ['NPI number', '1234567890']].map(([label, val], i) => (
          <div key={i} style={{ marginBottom: '13px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '5px', display: 'block' }}>{label}</label>
            <input defaultValue={val} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#F8FAFC', color: '#1E293B' }} />
          </div>
        ))}
        <Btn primary>Save changes</Btn>
      </Card>
      <Card>
        <CardTitle>Integrations</CardTitle>
        {integrations.map(([name, sub, connected], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', borderRadius: '10px', marginBottom: '8px', border: '1px solid #EEF2F7', background: connected ? '#ECFDF5' : '#F8FAFC', borderColor: connected ? 'rgba(16,185,129,.15)' : '#EEF2F7' }}>
            <div><div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>{name}</div><div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{sub}</div></div>
            {connected ? <Pill label="Connected" color="#0F7B54" bg="#ECFDF5" /> : <Btn small>Connect</Btn>}
          </div>
        ))}
      </Card>
    </div>
  );
}

export default App;