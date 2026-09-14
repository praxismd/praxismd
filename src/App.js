function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* SIDEBAR */}
      <div style={{
        width: '240px',
        background: '#FAFAFA',
        borderRight: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0'
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #EEF2F7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: '#2563EB', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '13px'
            }}>Px</div>
            <span style={{ fontSize: '19px', fontWeight: '700', color: '#0F172A' }}>PraxisMD</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '6px', paddingLeft: '2px' }}>
            Bright Smiles Dental
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '10px 12px', flex: 1 }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', padding: '14px 10px 6px' }}>Main</div>
          <NavItem icon="📊" label="Overview" active={true} />
          <NavItem icon="📥" label="Inbox" badge="4" />
          <NavItem icon="📢" label="Campaigns" />
          <NavItem icon="🔄" label="Recall" />
          <NavItem icon="📅" label="Calendar" />
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', padding: '14px 10px 6px' }}>Practice</div>
          <NavItem icon="👥" label="Patients" />
          <NavItem icon="🆔" label="Patient Portal" />
          <NavItem icon="🛡️" label="Eligibility" />
          <NavItem icon="⭐" label="Reviews" />
          <NavItem icon="😊" label="Surveys" />
          <NavItem icon="🤖" label="AI Front Desk" badge="Live" badgeColor="#6D28D9" />
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', padding: '14px 10px 6px' }}>Billing</div>
          <NavItem icon="🧾" label="Billing" badge="Pro" badgeColor="#6D28D9" />
          <NavItem icon="💳" label="Payments" />
          <div style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px', padding: '14px 10px 6px' }}>Analytics</div>
          <NavItem icon="📈" label="Reports" />
          <NavItem icon="⚙️" label="Settings" />
        </nav>

        {/* User */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #EEF2F7', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', color: '#2563EB' }}>DR</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: '#1E293B' }}>Dr. Rivera</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Practice owner</div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F0F2F5' }}>
        
        {/* Topbar */}
        <div style={{
          height: '64px', background: '#FAFAFA', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 26px'
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#0F172A' }}>Good morning, Dr. Rivera</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Sunday, September 13 · Bright Smiles Dental</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ padding: '8px 15px', borderRadius: '10px', border: '1px solid #E2E8F0', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#475569' }}>
              🔔 Notifications
            </button>
            <button style={{ padding: '8px 15px', borderRadius: '10px', border: 'none', background: '#2563EB', color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              + New campaign
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '22px 26px' }}>
          
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '13px', marginBottom: '20px' }}>
            <StatCard label="Revenue recovered" value="$8,400" color="#0F7B54" accent="#10B981" sub="↑ 14 patients reactivated" />
            <StatCard label="Appointments booked" value="31" color="#2563EB" accent="#3B82F6" sub="↑ 8 from campaigns" />
            <StatCard label="Google rating" value="4.8 ★" color="#92400E" accent="#F59E0B" sub="↑ 6 new reviews" />
            <StatCard label="Open messages" value="4" color="#B91C1C" accent="#EF4444" sub="Needs reply today" />
          </div>

          <div style={{ padding: '20px', background: 'white', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B', marginBottom: '6px' }}>🚀 PraxisMD is running</div>
            <div style={{ fontSize: '13px', color: '#94A3B8' }}>Your dashboard is live. Time to start building the real features.</div>
          </div>

        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, badge, badgeColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 11px', borderRadius: '10px', marginBottom: '1px',
      background: active ? '#EFF6FF' : 'transparent',
      color: active ? '#2563EB' : '#475569',
      cursor: 'pointer', fontSize: '13px', fontWeight: active ? '500' : '400',
      transition: 'all 0.12s'
    }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: '10px', fontWeight: '600', padding: '2px 7px',
          borderRadius: '20px', background: badgeColor ? badgeColor + '22' : '#FEF2F2',
          color: badgeColor || '#B91C1C'
        }}>{badge}</span>
      )}
    </div>
  );
}

function StatCard({ label, value, color, accent, sub }) {
  return (
    <div style={{
      background: 'white', borderRadius: '14px', padding: '16px 18px',
      border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: `linear-gradient(90deg, ${accent}, ${color})`
      }} />
      <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: '700', color, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '7px' }}>{sub}</div>
    </div>
  );
}

export default App;