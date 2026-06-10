/* ============================================================
   HOOP FRENS — SCRIPT.JS
   Handles: Navbar, Mobile Menu, Tabs, Counters, Form, Animations
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* --------------------------------------------------
     NAVBAR — scroll behavior
     -------------------------------------------------- */
  const navbar = document.getElementById('navbar');
  const heroBg = document.getElementById('heroBg');

  // Animate hero background on load
  setTimeout(() => {
    if (heroBg) heroBg.classList.add('loaded');
  }, 100);

  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  /* --------------------------------------------------
     MOBILE MENU
     -------------------------------------------------- */
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileMenu   = document.getElementById('mobileMenu');
  const mobileClose  = document.getElementById('mobileClose');
  const mobileLinks  = document.querySelectorAll('.mobile-nav-link');

  function openMenu() {
    mobileMenu.classList.add('open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    mobileMenu.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  hamburgerBtn?.addEventListener('click', openMenu);
  mobileClose?.addEventListener('click', closeMenu);
  mobileLinks.forEach(link => link.addEventListener('click', closeMenu));

  /* --------------------------------------------------
     SMOOTH SCROLL — anchor links
     -------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* --------------------------------------------------
     INTERSECTION OBSERVER — fade-up animations
     -------------------------------------------------- */
  const fadeElements = document.querySelectorAll('.fade-up');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  fadeElements.forEach(el => observer.observe(el));

  /* --------------------------------------------------
     CATEGORY PILLS — story filtering
     -------------------------------------------------- */
  const pills = document.querySelectorAll('.pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => { p.classList.remove('active'); p.setAttribute('aria-selected', 'false'); });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');
    });
  });

  /* --------------------------------------------------
     SPOTLIGHT TABS — Players vs Coaches
     -------------------------------------------------- */
  const tabBtns    = document.querySelectorAll('.tab-btn');
  const playersTab = document.getElementById('playersTab');
  const coachesTab = document.getElementById('coachesTab');
  const schoolsTab = document.getElementById('schoolsTab');

  const tabPanels = { players: playersTab, coaches: coachesTab, schools: schoolsTab };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      // Hide all panels
      Object.values(tabPanels).forEach(panel => { if (panel) panel.style.display = 'none'; });

      // Show selected panel
      const activePanel = tabPanels[btn.dataset.tab];
      if (activePanel) {
        activePanel.style.display = 'grid';

        // Re-trigger fade animations on the newly shown cards
        const cards = activePanel.querySelectorAll('.spotlight-card');
        cards.forEach((card, i) => {
          card.style.opacity = '0';
          card.style.transform = 'translateY(24px)';
          setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, i * 80);
        });
      }
    });
  });

  /* --------------------------------------------------
     ANIMATED COUNTERS — community stats
     -------------------------------------------------- */
  function animateCounter(el, target, duration = 1800) {
    let start = 0;
    const startTime = performance.now();
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value = Math.round(easeOutQuart(progress) * target);
      el.textContent = value.toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const statsSection  = document.getElementById('community');
  const statSchools   = document.getElementById('statSchools');
  const statAthletes  = document.getElementById('statAthletes');
  const statCoaches   = document.getElementById('statCoaches');
  const statArticles  = document.getElementById('statArticles');
  let countersStarted = false;

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !countersStarted) {
        countersStarted = true;
        animateCounter(statSchools,  1275);
        animateCounter(statAthletes, 3400);
        animateCounter(statCoaches,  680);
        animateCounter(statArticles, 2100);
        counterObserver.disconnect();
      }
    });
  }, { threshold: 0.3 });

  if (statsSection) counterObserver.observe(statsSection);

  /* --------------------------------------------------
     NEWSLETTER FORM — validation & success state
     -------------------------------------------------- */
  const form        = document.getElementById('newsletterForm');
  const inputName   = document.getElementById('inputName');
  const inputEmail  = document.getElementById('inputEmail');
  const formSuccess = document.getElementById('formSuccess');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    // Simple validation
    const nameVal  = inputName.value.trim();
    const emailVal = inputEmail.value.trim();
    const emailRe  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nameVal) {
      inputName.focus();
      inputName.style.borderColor = 'var(--red)';
      setTimeout(() => { inputName.style.borderColor = ''; }, 2000);
      return;
    }
    if (!emailRe.test(emailVal)) {
      inputEmail.focus();
      inputEmail.style.borderColor = 'var(--red)';
      setTimeout(() => { inputEmail.style.borderColor = ''; }, 2000);
      return;
    }

    // Success state
    form.style.display = 'none';
    formSuccess.classList.add('show');
  });

  /* --------------------------------------------------
     VIDEO CARD — hover interaction hints
     -------------------------------------------------- */
  const videoEl = document.getElementById('featuredVideo');
  videoEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Placeholder: would launch modal or navigate to video
      videoEl.style.outline = '2px solid var(--yellow)';
      setTimeout(() => { videoEl.style.outline = ''; }, 1000);
    }
  });

  /* --------------------------------------------------
     EPISODE ITEMS — keyboard support
     -------------------------------------------------- */
  document.querySelectorAll('.episode-item').forEach(item => {
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const playBtn = item.querySelector('.episode-play');
        if (playBtn) {
          playBtn.style.background = 'var(--red)';
          playBtn.style.color = 'white';
          setTimeout(() => {
            playBtn.style.background = '';
            playBtn.style.color = '';
          }, 800);
        }
      }
    });
  });

  /* --------------------------------------------------
     DIVISION CARDS — keyboard support
     -------------------------------------------------- */
  document.querySelectorAll('.division-card').forEach(card => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  /* --------------------------------------------------
     TICKER — pause on hover for accessibility
     -------------------------------------------------- */
  const tickerTrack = document.getElementById('tickerTrack');
  tickerTrack?.addEventListener('mouseenter', () => {
    tickerTrack.style.animationPlayState = 'paused';
  });
  tickerTrack?.addEventListener('mouseleave', () => {
    tickerTrack.style.animationPlayState = 'running';
  });

});
