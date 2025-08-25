import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="container">
    <div class="logo">🤖 OpenCode Agents</div>
    <div class="tagline">Intelligent AI Agents for Development</div>
    <div class="description">
      Powerful AI agents designed to assist with software development, code review, testing, and documentation. 
      Built to enhance developer productivity and streamline development workflows.
    </div>
    <button class="cta-button" id="get-started">Get Started</button>
    
    <div class="features">
      <div class="feature">
        <div class="feature-icon">🔍</div>
        <h3>Code Analysis</h3>
        <p>Advanced pattern analysis and codebase understanding to help you write better code.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🧪</div>
        <h3>Test Generation</h3>
        <p>Automated test creation and TDD support to ensure code quality and reliability.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📝</div>
        <h3>Documentation</h3>
        <p>Intelligent documentation generation and maintenance for your projects.</p>
      </div>
    </div>
  </div>
`

document.querySelector('#get-started').addEventListener('click', () => {
  alert('Welcome to OpenCode Agents! 🚀')
})