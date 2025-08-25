import './style.css'

document.querySelector('#app').innerHTML = `
  <header class="header">
    <nav class="nav">
      <div class="nav-brand">
        <span class="nav-logo">🤖</span>
        <span class="nav-title">OpenCode Agents</span>
      </div>
      <ul class="nav-menu">
        <li><a href="#features">Features</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><a href="#docs">Docs</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
      <button class="nav-cta">Get Started</button>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">
          Supercharge Your Development<br>
          <span class="hero-highlight">with AI Agents</span>
        </h1>
        <p class="hero-subtitle">
          Transform your coding workflow with intelligent AI agents that understand your codebase,
          write tests, generate documentation, and accelerate development by 3x.
        </p>
        <div class="hero-stats">
          <div class="stat">
            <div class="stat-number">10K+</div>
            <div class="stat-label">Developers</div>
          </div>
          <div class="stat">
            <div class="stat-number">500K+</div>
            <div class="stat-label">Lines of Code</div>
          </div>
          <div class="stat">
            <div class="stat-number">99.9%</div>
            <div class="stat-label">Uptime</div>
          </div>
        </div>
        <div class="hero-actions">
          <button class="cta-button primary" id="get-started">Start Free Trial</button>
          <button class="cta-button secondary" id="watch-demo">Watch Demo</button>
        </div>
        <div class="hero-trust">
          <span class="trust-text">Trusted by teams at</span>
          <div class="trust-logos">
            <span class="trust-logo">🏢 TechCorp</span>
            <span class="trust-logo">🚀 StartupXYZ</span>
            <span class="trust-logo">💡 InnovateLab</span>
          </div>
        </div>
      </div>
      <div class="hero-visual">
        <div class="code-preview">
          <div class="code-line">function analyzeCode(codebase) {</div>
          <div class="code-line indent">  const patterns = AI.analyze(codebase);</div>
          <div class="code-line indent">  const suggestions = AI.optimize(patterns);</div>
          <div class="code-line indent">  return suggestions;</div>
          <div class="code-line">}</div>
        </div>
      </div>
    </section>

    <section id="features" class="features-section">
      <div class="section-header">
        <h2>Powerful Features for Modern Development</h2>
        <p>Everything you need to build better software, faster</p>
      </div>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🔍</div>
          <h3>Smart Code Analysis</h3>
          <p>Advanced AI analyzes your entire codebase to identify patterns, potential bugs, and optimization opportunities in real-time.</p>
          <ul class="feature-benefits">
            <li>Pattern recognition across languages</li>
            <li>Security vulnerability detection</li>
            <li>Performance bottleneck identification</li>
          </ul>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🧪</div>
          <h3>Automated Testing</h3>
          <p>Generate comprehensive test suites automatically with AI-powered test case creation and TDD workflow support.</p>
          <ul class="feature-benefits">
            <li>Unit, integration, and E2E tests</li>
            <li>Edge case coverage</li>
            <li>Test maintenance automation</li>
          </ul>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📝</div>
          <h3>Intelligent Documentation</h3>
          <p>Create, maintain, and update documentation automatically as your code evolves with contextual understanding.</p>
          <ul class="feature-benefits">
            <li>API documentation generation</li>
            <li>Code comment suggestions</li>
            <li>README and changelog updates</li>
          </ul>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3>Code Refactoring</h3>
          <p>AI-powered refactoring suggestions to improve code quality, maintainability, and follow best practices.</p>
          <ul class="feature-benefits">
            <li>Automated code improvements</li>
            <li>Design pattern suggestions</li>
            <li>Legacy code modernization</li>
          </ul>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🤝</div>
          <h3>Team Collaboration</h3>
          <p>Seamlessly integrate with your existing workflow and collaborate with team members through shared AI insights.</p>
          <ul class="feature-benefits">
            <li>Git integration</li>
            <li>Team code reviews</li>
            <li>Knowledge sharing</li>
          </ul>
        </div>

        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Performance Optimization</h3>
          <p>Identify and fix performance issues automatically with AI-driven optimization recommendations.</p>
          <ul class="feature-benefits">
            <li>Memory optimization</li>
            <li>Query optimization</li>
            <li>Load time improvements</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="testimonials">
      <div class="section-header">
        <h2>Loved by Developers Worldwide</h2>
        <p>See what our community is saying</p>
      </div>

      <div class="testimonials-grid">
        <div class="testimonial-card">
          <div class="testimonial-content">
            "OpenCode Agents reduced our development time by 60% and improved code quality dramatically."
          </div>
          <div class="testimonial-author">
            <div class="author-avatar">👨‍💻</div>
            <div class="author-info">
              <div class="author-name">Sarah Chen</div>
              <div class="author-role">Senior Developer, TechCorp</div>
            </div>
          </div>
        </div>

        <div class="testimonial-card">
          <div class="testimonial-content">
            "The AI suggestions are incredibly accurate. It's like having an expert pair programmer available 24/7."
          </div>
          <div class="testimonial-author">
            <div class="author-avatar">👩‍💼</div>
            <div class="author-info">
              <div class="author-name">Mike Rodriguez</div>
              <div class="author-role">Lead Engineer, StartupXYZ</div>
            </div>
          </div>
        </div>

        <div class="testimonial-card">
          <div class="testimonial-content">
            "Documentation that stays up-to-date automatically? Game changer for our open source projects."
          </div>
          <div class="testimonial-author">
            <div class="author-avatar">🧑‍🔬</div>
            <div class="author-info">
              <div class="author-name">Dr. Emily Watson</div>
              <div class="author-role">Research Scientist, InnovateLab</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="footer-content">
      <div class="footer-section">
        <h4>🤖 OpenCode Agents</h4>
        <p>Empowering developers with intelligent AI assistance for better software development.</p>
      </div>

      <div class="footer-section">
        <h4>Product</h4>
        <ul>
          <li><a href="#features">Features</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#docs">Documentation</a></li>
          <li><a href="#api">API</a></li>
        </ul>
      </div>

      <div class="footer-section">
        <h4>Company</h4>
        <ul>
          <li><a href="#about">About</a></li>
          <li><a href="#blog">Blog</a></li>
          <li><a href="#careers">Careers</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </div>

      <div class="footer-section">
        <h4>Support</h4>
        <ul>
          <li><a href="#help">Help Center</a></li>
          <li><a href="#community">Community</a></li>
          <li><a href="#status">Status</a></li>
          <li><a href="#feedback">Feedback</a></li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <p>&copy; 2024 OpenCode Agents. All rights reserved.</p>
      <div class="footer-links">
        <a href="#privacy">Privacy Policy</a>
        <a href="#terms">Terms of Service</a>
      </div>
    </div>
  </footer>
`

// Event listeners for interactive elements
document.querySelector('#get-started').addEventListener('click', () => {
  // Smooth scroll to features section
  document.querySelector('#features').scrollIntoView({
    behavior: 'smooth'
  });
});

document.querySelector('#watch-demo').addEventListener('click', () => {
  alert('🎬 Demo video coming soon! In the meantime, explore our features below.');
});

// Navigation smooth scrolling
document.querySelectorAll('.nav-menu a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('href');
    const targetSection = document.querySelector(targetId);
    if (targetSection) {
      targetSection.scrollIntoView({
        behavior: 'smooth'
      });
    }
  });
});

// Header scroll effect
let lastScrollTop = 0;
const header = document.querySelector('.header');

window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  if (scrollTop > lastScrollTop && scrollTop > 100) {
    // Scrolling down
    header.style.transform = 'translateY(-100%)';
  } else {
    // Scrolling up
    header.style.transform = 'translateY(0)';
  }

  lastScrollTop = scrollTop;
});

// Add intersection observer for animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Observe feature cards and testimonial cards
document.querySelectorAll('.feature-card, .testimonial-card').forEach(card => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(30px)';
  card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(card);
});

// Add loading animation for hero content
document.addEventListener('DOMContentLoaded', () => {
  const heroContent = document.querySelector('.hero-content');
  heroContent.style.opacity = '0';
  heroContent.style.transform = 'translateY(30px)';

  setTimeout(() => {
    heroContent.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    heroContent.style.opacity = '1';
    heroContent.style.transform = 'translateY(0)';
  }, 300);
});