import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  useEffect(() => {
    const reveals = document.querySelectorAll('.stat-row, .card, .why-item, .role-row, .flow-step, .status-card');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 90);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));

    const faqQuestions = document.querySelectorAll('.faq-q');
    const handleFaqClick = function() {
      const item = this.parentElement;
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    };

    faqQuestions.forEach(q => q.addEventListener('click', handleFaqClick));

    const nav = document.querySelector('nav');
    const handleScroll = () => {
      if (nav) {
        nav.style.background = window.scrollY > 40 ? 'rgba(8,8,16,0.98)' : 'rgba(8,8,16,0.88)';
      }
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      observer.disconnect();
      faqQuestions.forEach(q => q.removeEventListener('click', handleFaqClick));
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="homepage-wrapper">
<nav>
  <a href="#" className="nav-logo"><span className="logo-dot"></span> CrisisSync</a>
  <ul className="nav-links">
    <li><a href="#about">About</a></li>
    <li><a href="#how">How It Works</a></li>
    <li><a href="#status">Status System</a></li>
    <li><a href="#faq">FAQ</a></li>
  </ul>
  <Link to="/signin" className="nav-cta">Launch System →</Link>
</nav>

<section className="hero">
  <div className="hero-mesh"></div>
  <div className="hero-tag"><span className="hero-tag-dot"></span> Google Hackathon 2025 · Firebase Powered</div>
  <h1>Crisis Response<br/><span className="hero-gradient-text">In Seconds,</span><br/>Not Minutes.</h1>
  <p className="hero-sub">A real-time emergency coordination platform for hospitality venues. Guests trigger. Staff act. Admins control. All synchronized instantly.</p>
  <div className="hero-actions">
    <Link to="/signin" className="btn-primary">Trigger Demo SOS</Link>
    <a href="#how" className="btn-ghost">See How It Works</a>
  </div>
</section>

<div className="status-legend">
  <div className="legend-item"><span className="legend-dot blue"></span> Starting / Pending</div>
  <div className="legend-item"><span className="legend-dot yellow"></span> In Progress</div>
  <div className="legend-item"><span className="legend-dot green"></span> Completed Successfully</div>
  <div className="legend-item"><span className="legend-dot red"></span> Incomplete / Failed</div>
</div>

<div className="strip">
  <div className="strip-track">
    <span className="strip-item">Real-Time Firebase Sync <span className="strip-sep b">·</span></span>
    <span className="strip-item">Gemini AI Triage <span className="strip-sep g">·</span></span>
    <span className="strip-item">Google Maps Live Pins <span className="strip-sep b">·</span></span>
    <span className="strip-item">Role-Based Access <span className="strip-sep y">·</span></span>
    <span className="strip-item">Auto Task Assignment <span className="strip-sep g">·</span></span>
    <span className="strip-item">FCM Push Alerts <span className="strip-sep b">·</span></span>
    <span className="strip-item">&lt; 2 Second Response <span className="strip-sep y">·</span></span>
    <span className="strip-item">Priority Classification <span className="strip-sep g">·</span></span>
    <span className="strip-item">Real-Time Firebase Sync <span className="strip-sep b">·</span></span>
    <span className="strip-item">Gemini AI Triage <span className="strip-sep g">·</span></span>
    <span className="strip-item">Google Maps Live Pins <span className="strip-sep b">·</span></span>
    <span className="strip-item">Role-Based Access <span className="strip-sep y">·</span></span>
    <span className="strip-item">Auto Task Assignment <span className="strip-sep g">·</span></span>
    <span className="strip-item">FCM Push Alerts <span className="strip-sep b">·</span></span>
    <span className="strip-item">&lt; 2 Second Response <span className="strip-sep y">·</span></span>
    <span className="strip-item">Priority Classification <span className="strip-sep g">·</span></span>
  </div>
</div>

<section id="about">
  <div className="about">
    <div className="about-stats">
      <div className="section-tag">ABOUT US</div>
      <div className="stat-row"><span className="stat-num">01.</span><span className="stat-text">Emergency converted to assigned tasks in under 2 seconds</span></div>
      <div className="stat-row"><span className="stat-num">02.</span><span className="stat-text">Intelligent priority routing — Critical, High, Medium</span></div>
      <div className="stat-row"><span className="stat-num">03.</span><span className="stat-text">Availability-based staff assignment, no double tasking</span></div>
      <div className="stat-row"><span className="stat-num">04.</span><span className="stat-text">Full incident lifecycle logged with timestamps</span></div>
    </div>
    <div className="about-right">
      <h2>Technology That Works When It Matters Most</h2>
      <p>In hospitality emergencies, fragmented communication costs lives. CrisisSync bridges distressed guests, active staff, and management into one unified real-time system — built entirely on the Google ecosystem.</p>
      <span className="about-badge">Powered by Firebase · Gemini AI · Google Maps</span>
    </div>
  </div>
</section>

<section id="how" style={{'background': 'var(--surface)', 'borderTop': '1px solid var(--border)'}}>
  <div className="programs-header">
    <div className="section-tag">HOW IT WORKS</div>
    <h2>From Alert to Resolution — In One Flow</h2>
    <p>Three user types. One shared dashboard. Every action tracked in real-time.</p>
  </div>
  <div className="cards-grid">
    <div className="card">
      <div className="card-icon">🚨</div>
      <div className="card-date">STEP 01 · GUEST · PENDING</div>
      <h3>One-Tap SOS Trigger</h3>
      <p>Guest selects emergency type and room number. Two taps maximum. Incident created instantly — status set to Blue (Pending).</p>
    </div>
    <div className="card">
      <div className="card-icon">⚡</div>
      <div className="card-date">STEP 02 · SYSTEM · IN PROGRESS</div>
      <h3>AI Priority + Auto-Assignment</h3>
      <p>Gemini classifies severity. Tasks distributed to available staff only. Status shifts to Yellow as the first staff member acknowledges.</p>
    </div>
    <div className="card">
      <div className="card-icon">✅</div>
      <div className="card-date">STEP 03 · ADMIN · RESOLVED</div>
      <h3>Acknowledge, Act, Resolve</h3>
      <p>All tasks completed, admin confirms. Status turns Green. Any incomplete or timed-out tasks flag Red for immediate escalation.</p>
    </div>
  </div>
</section>

<section id="status" className="status-section">
  <div className="status-section-inner">
    <div className="section-tag">STATUS SYSTEM</div>
    <h2 style={{'fontSize': 'clamp(2rem, 4vw, 3rem)', 'fontWeight': '800', 'letterSpacing': '-0.03em', 'maxWidth': '560px', 'marginBottom': '12px'}}>Four States. One Clear Picture.</h2>
    <p style={{'color': 'var(--muted)', 'maxWidth': '500px'}}>Every incident, task, and staff member has a live status. Color tells you everything at a glance — no reading required under pressure.</p>
    <div className="status-showcase">
      <div className="status-card s-blue">
        <div className="sc-icon">🔵</div>
        <div className="sc-label">Starting / Pending</div>
        <div className="sc-title">Incident Created</div>
        <div className="sc-desc">SOS triggered. System is processing. Tasks being assigned. Awaiting staff acknowledgement.</div>
      </div>
      <div className="status-card s-yellow">
        <div className="sc-icon">🟡</div>
        <div className="sc-label">In Progress</div>
        <div className="sc-title">Active Response</div>
        <div className="sc-desc">Staff acknowledged and is actively responding. Admin monitors live task updates in real-time.</div>
      </div>
      <div className="status-card s-green">
        <div className="sc-icon">🟢</div>
        <div className="sc-label">Completed Successfully</div>
        <div className="sc-title">Incident Resolved</div>
        <div className="sc-desc">All tasks done. Admin confirmed resolution. Incident logged with full timestamp trail.</div>
      </div>
      <div className="status-card s-red">
        <div className="sc-icon">🔴</div>
        <div className="sc-label">Incomplete / Failed</div>
        <div className="sc-title">Escalation Required</div>
        <div className="sc-desc">Task ignored, timed out, or staff unavailable. Admin escalates — re-alerts all available personnel.</div>
      </div>
    </div>
  </div>
</section>

<section style={{'background': 'var(--bg)', 'borderTop': '1px solid var(--border)'}}>
  <div className="why-inner">
    <div className="why-header">
      <div><div className="section-tag">WHY CHOOSE US</div><h2>A System Built for Real Emergencies</h2></div>
      <p>Every design decision was made to reduce confusion, speed up response, and put the right information in the right hands — instantly.</p>
    </div>
    <div className="why-grid">
      <div className="why-item"><div className="why-item-icon">🎨</div><h3>Color-Coded at Every Level</h3><p>Blue for pending, yellow for active, green for resolved, red for failed. Status is visible at a glance — no text reading needed under panic.</p></div>
      <div className="why-item"><div className="why-item-icon">🔄</div><h3>Real-Time Across All Devices</h3><p>Firebase Firestore onSnapshot ensures every connected screen updates within 2 seconds. No polling. No refresh needed.</p></div>
      <div className="why-item"><div className="why-item-icon">✅</div><h3>Acknowledgement-Based Tasks</h3><p>Staff must actively acknowledge each task. Pending → Acknowledged → In Progress → Done. No silent ignoring of critical assignments.</p></div>
      <div className="why-item"><div className="why-item-icon">🛡️</div><h3>Offline Resilience</h3><p>Auto-retry handler attempts 3 times on network failure. Incidents cached locally — no data loss during connectivity issues.</p></div>
    </div>
  </div>
</section>

<section id="roles" style={{'background': 'var(--surface)', 'borderTop': '1px solid var(--border)'}}>
  <div className="roles-list">
    <div className="roles-header"><div><div className="section-tag">SYSTEM ROLES</div><h2>Every Stakeholder Has a Role</h2></div></div>
    <div className="role-row"><span className="role-badge blue">GUEST</span><div className="role-info"><h3>Emergency Trigger</h3><p>No login required. Select room + emergency type → tap SOS. Max 2 actions. Status immediately turns Blue — Pending.</p></div><span className="role-arrow">→</span></div>
    <div className="role-row"><span className="role-badge yellow">STAFF</span><div className="role-info"><h3>Task Executor</h3><p>Receives FCM push notification. Views assigned tasks only. Acknowledges → works → marks done. Yellow → Green.</p></div><span className="role-arrow">→</span></div>
    <div className="role-row"><span className="role-badge green">ADMIN</span><div className="role-info"><h3>Command & Control</h3><p>Full incident overview. Live task status across all colors. Can override assignments, escalate, or mark resolved.</p></div><span className="role-arrow">→</span></div>
    <div className="role-row"><span className="role-badge red">EMS</span><div className="role-info"><h3>Emergency Services Handoff</h3><p>Gemini generates a ready-to-share incident brief. Red flag triggers automatic EMS summary for first responders.</p></div><span className="role-arrow">→</span></div>
  </div>
</section>

<section style={{'background': 'var(--bg)'}}>
  <div className="flow-header">
    <div className="section-tag">INCIDENT LIFECYCLE</div>
    <h2>From SOS to Resolved</h2>
    <p>Color transitions mirror exactly what's happening on the ground.</p>
  </div>
  <div className="flow-steps">
    <div className="flow-step"><div className="step-num">1</div><div className="step-content"><span className="step-tag blue">● Pending</span><h3>Guest Triggers SOS</h3><p>Firestore incident created in &lt;1 second. Status: Blue — Pending. retryHandler active.</p></div></div>
    <div className="flow-step"><div className="step-num">2</div><div className="step-content"><span className="step-tag blue">● Starting</span><h3>Priority Assigned by Gemini AI</h3><p>Fire → Critical · Medical → High · Security → Medium. Task assignment initializing. Still Blue.</p></div></div>
    <div className="flow-step"><div className="step-num">3</div><div className="step-content"><span className="step-tag yellow">● In Progress</span><h3>Staff Acknowledges Task</h3><p>First acknowledgement received. Status transitions to Yellow — In Progress. FCM confirmed, staff en route.</p></div></div>
    <div className="flow-step"><div className="step-num">4</div><div className="step-content"><span className="step-tag yellow">● In Progress</span><h3>Active Response Underway</h3><p>Staff updates task status live. Admin monitors Yellow. Escalation available if response stalls.</p></div></div>
    <div className="flow-step"><div className="step-num">5</div><div className="step-content"><span className="step-tag green">● Completed</span><h3>All Tasks Marked Done</h3><p>Staff completes role. Admin confirms resolution. Status turns Green — Completed Successfully.</p></div></div>
    <div className="flow-step"><div className="step-num">6</div><div className="step-content"><span className="step-tag green">● Resolved</span><h3>Incident Closed & Logged</h3><p>Incident sealed with complete timestamp trail. Staff availability resets. Ready for next emergency.</p></div></div>
  </div>
</section>

<section style={{'background': 'var(--surface)', 'borderTop': '1px solid var(--border)', 'paddingTop': '100px', 'paddingBottom': '100px'}}>
  <div className="test-header"><div className="section-tag">TESTIMONIALS</div><h2>Built for People Under Pressure</h2></div>
  <div className="test-track-wrap">
    <div className="test-track">
      <div className="test-card"><p>"Before CrisisSync, our security team had no shared view of each floor. Now every incident is color-coded and visible to everyone the moment it's reported."</p><div className="test-card-author"><div className="test-avatar av-b">MR</div><div><div className="test-name">Marcus R.</div><div className="test-role">Head of Security, Grand Meridian</div></div></div></div>
      <div className="test-card"><p>"Two taps and help was dispatched. The blue pending screen told me the system received my alert — that alone calmed me down in the moment."</p><div className="test-card-author"><div className="test-avatar av-y">AL</div><div><div className="test-name">Aisha L.</div><div className="test-role">Hotel Guest, Business Traveler</div></div></div></div>
      <div className="test-card"><p>"The color transitions are genius. Yellow means someone's responding. Green means it's handled. No words needed during an emergency."</p><div className="test-card-author"><div className="test-avatar av-g">JP</div><div><div className="test-name">James P.</div><div className="test-role">General Manager, Coastline Resort</div></div></div></div>
      <div className="test-card"><p>"The Gemini EMS brief triggered automatically on red flag. By the time paramedics arrived, the full summary was already in their hands."</p><div className="test-card-author"><div className="test-avatar av-b">SN</div><div><div className="test-name">Sofia N.</div><div className="test-role">Front Desk Supervisor, Palazzo Events</div></div></div></div>
      <div className="test-card"><p>"Staff stopped asking 'what do I do?' The system tells them — and the color tells me whether they're doing it. It changed our entire drill culture."</p><div className="test-card-author"><div className="test-avatar av-g">DK</div><div><div className="test-name">David K.</div><div className="test-role">Operations Director, The Harlow Collection</div></div></div></div>
      {/* duplicate for loop */}
      <div className="test-card"><p>"Before CrisisSync, our security team had no shared view of each floor. Now every incident is color-coded and visible to everyone the moment it's reported."</p><div className="test-card-author"><div className="test-avatar av-b">MR</div><div><div className="test-name">Marcus R.</div><div className="test-role">Head of Security, Grand Meridian</div></div></div></div>
      <div className="test-card"><p>"Two taps and help was dispatched. The blue pending screen told me the system received my alert — that alone calmed me down in the moment."</p><div className="test-card-author"><div className="test-avatar av-y">AL</div><div><div className="test-name">Aisha L.</div><div className="test-role">Hotel Guest, Business Traveler</div></div></div></div>
      <div className="test-card"><p>"The color transitions are genius. Yellow means someone's responding. Green means it's handled. No words needed during an emergency."</p><div className="test-card-author"><div className="test-avatar av-g">JP</div><div><div className="test-name">James P.</div><div className="test-role">General Manager, Coastline Resort</div></div></div></div>
      <div className="test-card"><p>"The Gemini EMS brief triggered automatically on red flag. By the time paramedics arrived, the full summary was already in their hands."</p><div className="test-card-author"><div className="test-avatar av-b">SN</div><div><div className="test-name">Sofia N.</div><div className="test-role">Front Desk Supervisor, Palazzo Events</div></div></div></div>
      <div className="test-card"><p>"Staff stopped asking 'what do I do?' The system tells them — and the color tells me whether they're doing it. It changed our entire drill culture."</p><div className="test-card-author"><div className="test-avatar av-g">DK</div><div><div className="test-name">David K.</div><div className="test-role">Operations Director, The Harlow Collection</div></div></div></div>
    </div>
  </div>
</section>

<section id="faq" style={{'background': 'var(--bg)', 'borderTop': '1px solid var(--border)'}}>
  <div className="faq-inner">
    <div className="faq-header"><div className="section-tag">FAQs</div><h2>Your Questions, Answered</h2></div>
    <div className="faq-item"><div className="faq-q">Does the guest need to log in to trigger an SOS? <span className="faq-icon">+</span></div><div className="faq-a">No. Zero authentication required. Select room number and emergency type — two taps. Status immediately shows Blue (Pending) as confirmation.</div></div>
    <div className="faq-item"><div className="faq-q">What do the colors mean in the dashboard? <span className="faq-icon">+</span></div><div className="faq-a">Blue = Starting/Pending. Yellow = In Progress (staff acknowledged). Green = Completed Successfully (resolved and logged). Red = Incomplete/Failed (escalation needed).</div></div>
    <div className="faq-item"><div className="faq-q">How fast does the alert reach staff? <span className="faq-icon">+</span></div><div className="faq-a">Incident creation in Firestore takes under 1 second. Dashboards update via onSnapshot with under 2 second delay. FCM push dispatched simultaneously. Color transitions Blue → Yellow the moment staff acknowledges.</div></div>
    <div className="faq-item"><div className="faq-q">What happens if the internet goes down? <span className="faq-icon">+</span></div><div className="faq-a">retryHandler.js retries Firestore writes up to 3 times. If all fail, incident is cached locally and syncs on reconnect. Status stays Blue until confirmed — no phantom completions.</div></div>
    <div className="faq-item"><div className="faq-q">Is this built entirely on free Google APIs? <span className="faq-icon">+</span></div><div className="faq-a">Yes. Firebase Firestore, Auth, FCM, Hosting, Google Maps JS API (within free credit), and Gemini API via Google AI Studio — all within free tier limits for hackathon scale.</div></div>
  </div>
</section>

<section className="footer-cta">
  <div className="footer-cta-inner">
    <div>
      <h2>Ready to See It in Action?</h2>
      <p>Watch Blue turn Yellow turn Green — a live demo incident from SOS to resolved in under 2 seconds.</p>
      <Link to="/signin" className="btn-primary">Launch Demo →</Link>
      <div className="footer-contact">Questions? <a href="mailto:team@crisissync.dev">team@crisissync.dev</a></div>
    </div>
    <div>
      <p style={{'color': 'var(--muted)', 'fontSize': '0.85rem', 'marginBottom': '14px'}}>Get notified when we go live</p>
      <div className="newsletter"><input type="email" placeholder="your@email.com" /><button>Notify Me</button></div>
      <p style={{'color': 'var(--muted)', 'fontSize': '0.78rem', 'marginTop': '12px'}}>No spam. We'll only reach out when it matters.</p>
    </div>
  </div>
</section>

<footer>
  <span className="footer-logo">⬤ CrisisSync</span>
  <ul className="footer-links"><li><a href="#about">About</a></li><li><a href="#how">How It Works</a></li><li><a href="#status">Status System</a></li><li><a href="#faq">FAQ</a></li></ul>
  <span className="footer-copy">© 2025 CrisisSync · Google Hackathon Project</span>
</footer>

    </div>
  );
};

export default HomePage;
