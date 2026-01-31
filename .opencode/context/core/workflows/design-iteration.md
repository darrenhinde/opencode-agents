<!-- Context: workflows/design-iteration | Priority: high | Version: 1.0 | Updated: 2025-12-09 -->
# Design Iteration Workflow

## Overview

A structured 4-stage workflow for creating and iterating on UI designs. This process ensures thoughtful design decisions with user approval at each stage.

## Quick Reference

**Stages**: Layout → Theme → Animation → Implementation
**Approval**: Required between each stage
**Output**: Single HTML file per design iteration
**Location**: `design_iterations/` folder

---

## When to Use This Workflow

### Delegate to OpenFrontendSpecialist When:

**✅ STRONGLY RECOMMENDED** to delegate for:
- **New UI/UX design work** - Landing pages, dashboards, app interfaces
- **Design system creation** - Component libraries, theme systems, style guides
- **Complex layouts** - Multi-column grids, responsive designs, intricate structures
- **Visual polish** - Animations, transitions, micro-interactions
- **Brand-focused work** - Marketing pages, product showcases, hero sections
- **Accessibility-critical UI** - Forms, navigation, interactive components

**Why delegate?**
- OpenFrontendSpecialist follows the 4-stage design workflow (Layout → Theme → Animation → Implementation)
- Ensures thoughtful design decisions with approval gates
- Produces polished, accessible, production-ready UI
- Handles responsive design, OKLCH colors, semantic HTML
- Creates single-file HTML prototypes for quick iteration

### Execute Directly When:

**⚠️ Simple cases only**:
- Minor text/content updates to existing UI
- Small CSS tweaks (colors, spacing, fonts)
- Adding simple utility classes
- Updating existing component props
- Bug fixes in existing UI code

### Delegation Pattern

```javascript
// For UI design work
task(
  subagent_type="OpenFrontendSpecialist",
  description="Design {feature} UI",
  prompt="Design a {feature} following the 4-stage workflow:
  
  Requirements:
  - {requirement 1}
  - {requirement 2}
  
  Context: {what this UI is for}
  
  Follow the design iteration workflow:
  1. Layout (ASCII wireframe)
  2. Theme (design system, colors)
  3. Animation (micro-interactions)
  4. Implementation (single HTML file)
  
  Request approval between each stage."
)
```

### Example Scenarios

| Scenario | Action | Why |
|----------|--------|-----|
| "Create a landing page for our SaaS product" | ✅ Delegate to OpenFrontendSpecialist | Complex UI design, needs 4-stage workflow |
| "Design a user dashboard with charts" | ✅ Delegate to OpenFrontendSpecialist | Complex layout, visual design, interactions |
| "Build a component library with our brand" | ✅ Delegate to OpenFrontendSpecialist | Design system work, requires theme expertise |
| "Fix button color from blue to green" | ⚠️ Execute directly | Simple CSS change |
| "Update hero text content" | ⚠️ Execute directly | Content update only |

---

## Design Plan File (MANDATORY)

**CRITICAL**: Before starting any design work, create a persistent design plan file.

**Location**: `.tmp/design-plans/{project-name}-{feature-name}.md`

**Purpose**: 
- Preserve design decisions across stages
- Allow user to review and edit the plan
- Maintain context for subagent calls
- Track design evolution and iterations

**When to Create**: 
- BEFORE Stage 1 (Layout Design)
- After understanding user requirements
- Before any design work begins

**Template**:
```markdown
---
project: {project-name}
feature: {feature-name}
created: {ISO timestamp}
updated: {ISO timestamp}
status: in_progress
current_stage: layout
---

# Design Plan: {Feature Name}

## User Requirements
{What the user asked for - verbatim or close paraphrase}

## Design Goals
- {goal 1}
- {goal 2}
- {goal 3}

## Target Audience
{Who will use this UI}

## Technical Constraints
- Framework: {Next.js, React, etc.}
- Responsive: {Yes/No}
- Accessibility: {WCAG level}
- Browser support: {Modern, IE11+, etc.}

---

## Stage 1: Layout Design

### Status
- [ ] Layout planned
- [ ] ASCII wireframe created
- [ ] User approved

### Layout Structure
{ASCII wireframe will be added here}

### Component Breakdown
{Component list will be added here}

### User Feedback
{User comments and requested changes}

---

## Stage 2: Theme Design

### Status
- [ ] Design system selected
- [ ] Color palette chosen
- [ ] Typography defined
- [ ] User approved

### Theme Details
{Theme specifications will be added here}

### User Feedback
{User comments and requested changes}

---

## Stage 3: Animation Design

### Status
- [ ] Micro-interactions defined
- [ ] Animation timing set
- [ ] User approved

### Animation Details
{Animation specifications will be added here}

### User Feedback
{User comments and requested changes}

---

## Stage 4: Implementation

### Status
- [ ] HTML structure complete
- [ ] CSS applied
- [ ] Animations implemented
- [ ] User approved

### Output Files
- HTML: {file path}
- CSS: {file path}
- Assets: {file paths}

### User Feedback
{Final comments and requested changes}

---

## Design Evolution

### Iteration 1
- Date: {timestamp}
- Changes: {what changed}
- Reason: {why it changed}

### Iteration 2
- Date: {timestamp}
- Changes: {what changed}
- Reason: {why it changed}
```

**Workflow Integration**:
1. **Create plan file** → Write to `.tmp/design-plans/{name}.md`
2. **Each stage** → Update plan file with decisions and user feedback
3. **User approval** → Edit plan file with approved decisions
4. **User requests changes** → Edit plan file with feedback, iterate
5. **Subagent calls** → Pass plan file path for context preservation
6. **Completion** → Plan file contains full design history

**Benefits**:
- ✅ Context preserved across subagent calls
- ✅ User can review and edit plan directly
- ✅ Design decisions documented
- ✅ Easy to iterate and refine
- ✅ Full design history tracked

---

## Workflow Stages

### Stage 0: Create Design Plan (MANDATORY FIRST STEP)

**Purpose**: Create persistent plan file before any design work

**Process**:
1. Understand user requirements
2. Identify design goals and constraints
3. Create plan file at `.tmp/design-plans/{project-name}-{feature-name}.md`
4. Populate with user requirements and goals
5. Present plan file location to user
6. Proceed to Stage 1

**Deliverable**: Design plan file created and initialized

**Example**:
```
✅ Design plan created: .tmp/design-plans/saas-landing-page.md

You can review and edit this file at any time. All design decisions will be tracked here.

Ready to proceed to Stage 1 (Layout Design)?
```

**Approval Gate**: "Plan file created. Ready to start layout design?"

---

### Stage 1: Layout Design

**Purpose**: Define the structure and component hierarchy before visual design

**Process**:
1. Read design plan file from `.tmp/design-plans/{name}.md`
2. Analyze user requirements from plan
3. Identify core UI components
4. Plan layout structure and responsive behavior
5. Create ASCII wireframe
6. **Update plan file** with layout structure and component breakdown
7. Present to user for approval
8. **Update plan file** with user feedback and approval status

**Deliverable**: 
- ASCII wireframe with component breakdown
- Updated plan file with Stage 1 complete

**Example Output**:

```
## Core UI Components

**Header Area**
- Logo/brand (Top left)
- Navigation menu (Top center)
- User actions (Top right)

**Main Content Area**
- Hero section (Full width)
- Feature cards (3-column grid on desktop, stack on mobile)
- Call-to-action (Centered)

**Footer**
- Links (4-column grid)
- Social icons (Centered)
- Copyright (Bottom)

## Layout Structure

Desktop (1024px+):
┌─────────────────────────────────────────────────┐
│ [Logo]        Navigation        [User Menu]     │
├─────────────────────────────────────────────────┤
│                                                 │
│              HERO SECTION                       │
│         (Full width, centered text)             │
│                                                 │
├─────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │ Card 1  │  │ Card 2  │  │ Card 3  │         │
│  │         │  │         │  │         │         │
│  └─────────┘  └─────────┘  └─────────┘         │
├─────────────────────────────────────────────────┤
│              [Call to Action]                   │
├─────────────────────────────────────────────────┤
│  Links    Links    Links    Social              │
│                    Copyright                    │
└─────────────────────────────────────────────────┘

Mobile (< 768px):
┌─────────────────┐
│ ☰  Logo   [👤]  │
├─────────────────┤
│                 │
│  HERO SECTION   │
│                 │
├─────────────────┤
│  ┌───────────┐  │
│  │  Card 1   │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Card 2   │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │  Card 3   │  │
│  └───────────┘  │
├─────────────────┤
│      [CTA]      │
├─────────────────┤
│     Links       │
│     Social      │
│   Copyright     │
└─────────────────┘
```

**Approval Gate**: "Would you like to proceed with this layout or need modifications?"

---

### Stage 2: Theme Design

**Purpose**: Define colors, typography, spacing, and visual style

**Process**:
1. Read design plan file from `.tmp/design-plans/{name}.md`
2. Review approved layout from Stage 1
3. Choose design system (neo-brutalism, modern dark, custom)
4. Select color palette (avoid Bootstrap blue unless requested)
5. Choose typography (Google Fonts)
6. Define spacing and shadows
7. Generate theme CSS file
8. **Update plan file** with theme specifications
9. Present theme to user for approval
10. **Update plan file** with user feedback and approval status

**Deliverable**: 
- CSS theme file saved to `design_iterations/theme_N.css`
- Updated plan file with Stage 2 complete

**Theme Selection Criteria**:

| Style | Use When | Avoid When |
|-------|----------|------------|
| Neo-Brutalism | Creative/artistic projects, retro aesthetic | Enterprise apps, accessibility-critical |
| Modern Dark | SaaS, developer tools, professional dashboards | Playful consumer apps |
| Custom | Specific brand requirements | Time-constrained projects |

**Example Output**:

```
## Theme Design: Modern Professional

**Style Reference**: Vercel/Linear aesthetic
**Color Palette**: Monochromatic with accent
**Typography**: Inter (UI) + JetBrains Mono (code)
**Spacing**: 4px base unit
**Shadows**: Subtle, soft elevation

**Theme File**: design_iterations/theme_1.css

Key Design Decisions:
- Primary: Neutral gray for professional feel
- Accent: Subtle blue for interactive elements
- Radius: 0.625rem for modern, friendly feel
- Shadows: Soft, minimal elevation
- Fonts: System-like for familiarity
```

**File Naming**: `theme_1.css`, `theme_2.css`, etc.

**Approval Gate**: "Does this theme match your vision, or would you like adjustments?"

---

### Stage 3: Animation Design

**Purpose**: Define micro-interactions and transitions

**Process**:
1. Read design plan file from `.tmp/design-plans/{name}.md`
2. Review approved theme from Stage 2
3. Identify key interactions (hover, click, scroll)
4. Define animation timing and easing
5. Plan loading states and transitions
6. Document animations using micro-syntax
7. **Update plan file** with animation specifications
8. Present animation plan to user for approval
9. **Update plan file** with user feedback and approval status

**Deliverable**: 
- Animation specification in micro-syntax format
- Updated plan file with Stage 3 complete

**Example Output**:

```
## Animation Design: Smooth & Professional

### Button Interactions
hover: 200ms ease-out [Y0→-2, shadow↗]
press: 100ms ease-in [S1→0.95]
ripple: 400ms ease-out [S0→2, α1→0]

### Card Interactions
cardHover: 300ms ease-out [Y0→-4, shadow↗]
cardClick: 200ms ease-out [S1→1.02]

### Page Transitions
pageEnter: 300ms ease-out [α0→1, Y+20→0]
pageExit: 200ms ease-in [α1→0]

### Loading States
spinner: 1000ms ∞ linear [R360°]
skeleton: 2000ms ∞ [bg: muted↔accent]

### Micro-Interactions
inputFocus: 200ms ease-out [S1→1.01, ring]
linkHover: 250ms ease-out [underline 0→100%]

**Philosophy**: Subtle, purposeful animations that enhance UX without distraction
**Performance**: All animations use transform/opacity for 60fps
**Accessibility**: Respects prefers-reduced-motion
```

**Approval Gate**: "Are these animations appropriate for your design, or should we adjust?"

---

### Stage 4: Implementation

**Purpose**: Generate complete HTML file with all components

**Process**:
1. Read design plan file from `.tmp/design-plans/{name}.md`
2. Review all approved decisions from Stages 1-3
3. Build individual UI components
4. Integrate theme CSS
5. Add animations and interactions
6. Combine into single HTML file
7. Test responsive behavior
8. Save to design_iterations folder
9. **Update plan file** with output file paths
10. Present to user for review
11. **Update plan file** with user feedback and final approval status

**Deliverable**: 
- Complete HTML file with embedded or linked CSS
- Updated plan file with Stage 4 complete and all output files documented

**File Organization**:

```
design_iterations/
├── theme_1.css              # Theme file from Stage 2
├── dashboard_1.html         # Initial design
├── dashboard_1_1.html       # First iteration
├── dashboard_1_2.html       # Second iteration
├── chat_ui_1.html           # Different design
└── chat_ui_1_1.html         # Iteration of chat UI
```

**Naming Conventions**:

| Type | Format | Example |
|------|--------|---------|
| Initial design | `{name}_1.html` | `table_1.html` |
| First iteration | `{name}_1_1.html` | `table_1_1.html` |
| Second iteration | `{name}_1_2.html` | `table_1_2.html` |
| New design | `{name}_2.html` | `table_2.html` |

**Implementation Checklist**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design Name</title>
  
  <!-- ✅ Preconnect to external resources -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  
  <!-- ✅ Load fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- ✅ Load Tailwind (script tag, not stylesheet) -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- ✅ Load Flowbite if needed -->
  <link href="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.css" rel="stylesheet">
  
  <!-- ✅ Load icons -->
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
  
  <!-- ✅ Link theme CSS -->
  <link rel="stylesheet" href="theme_1.css">
  
  <!-- ✅ Custom styles with !important for overrides -->
  <style>
    body {
      font-family: 'Inter', sans-serif !important;
      color: var(--foreground) !important;
    }
    
    h1, h2, h3, h4, h5, h6 {
      font-weight: 600 !important;
    }
    
    /* Custom animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .animate-fade-in {
      animation: fadeIn 300ms ease-out;
    }
  </style>
</head>
<body>
  <!-- ✅ Semantic HTML structure -->
  <header>
    <!-- Header content -->
  </header>
  
  <main>
    <!-- Main content -->
  </main>
  
  <footer>
    <!-- Footer content -->
  </footer>
  
  <!-- ✅ Load Flowbite JS if needed -->
  <script src="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.js"></script>
  
  <!-- ✅ Initialize icons -->
  <script>
    lucide.createIcons();
  </script>
  
  <!-- ✅ Custom JavaScript -->
  <script>
    // Interactive functionality
  </script>
</body>
</html>
```

**Approval Gate**: "Please review the design. Would you like any changes or iterations?"

---

## Visual Content Generation

### When to Use Image Specialist

Delegate to **Image Specialist** subagent when users request:

- **Diagrams & Visualizations**: Architecture diagrams, flowcharts, system visualizations
- **UI Mockups & Wireframes**: Visual mockups, design concepts, interface previews
- **Graphics & Assets**: Social media graphics, promotional images, icons, illustrations
- **Image Editing**: Photo enhancement, image modifications, visual adjustments

### Invocation Pattern

```javascript
task(
  subagent_type="Image Specialist",
  description="Generate/edit visual content",
  prompt="Context to load:
          - .opencode/context/core/visual-development.md
          
          Task: [Specific visual requirement]
          
          Requirements:
          - [Visual style/aesthetic]
          - [Dimensions/format]
          - [Key elements to include]
          - [Color scheme/branding]
          
          Output: [Expected deliverable]"
)
```

### Example Use Cases

**Architecture Diagram**:
```javascript
task(
  subagent_type="Image Specialist",
  description="Generate microservices architecture diagram",
  prompt="Create a diagram showing:
          - 5 microservices (API Gateway, Auth, Orders, Payments, Notifications)
          - Database connections
          - Message queue (RabbitMQ)
          - External services (Stripe, SendGrid)
          
          Style: Clean, professional, modern
          Format: PNG, 1920x1080"
)
```

**UI Mockup**:
```javascript
task(
  subagent_type="Image Specialist",
  description="Generate dashboard mockup",
  prompt="Create a mockup for an analytics dashboard:
          - Header with navigation
          - 4 metric cards (Users, Revenue, Conversion, Retention)
          - Line chart showing trends
          - Data table below
          
          Style: Modern, dark theme, professional
          Format: PNG, 1440x900"
)
```

**Social Media Graphic**:
```javascript
task(
  subagent_type="Image Specialist",
  description="Generate product launch graphic",
  prompt="Create a social media graphic announcing new feature:
          - Bold headline: 'Introducing Real-Time Collaboration'
          - Subtext: 'Work together, ship faster'
          - Brand colors: #6366f1 (primary), #1e293b (dark)
          - Include abstract collaboration visual
          
          Format: PNG, 1200x630 (Twitter/LinkedIn)"
)
```

### Tools Required

- **tool:gemini** - Gemini Nano Banana AI for image generation/editing
- Automatically available in Developer profile

### When NOT to Delegate

**Use design-iteration workflow instead** when:
- Creating interactive HTML/CSS designs
- Building complete UI implementations
- Iterating on existing HTML files
- Need responsive, production-ready code

**Use image-specialist** when:
- Need static visual assets
- Creating diagrams or illustrations
- Generating mockups for presentation
- Quick visual concepts without code

---

## Iteration Process

### When to Create Iterations

**Create new iteration** (`{name}_1_1.html`) when:
- User requests changes to existing design
- Refining based on feedback
- A/B testing variations
- Progressive enhancement

**Create new design** (`{name}_2.html`) when:
- Complete redesign requested
- Different approach/style
- Alternative layout structure

### Iteration Workflow

```
User: "Can you make the buttons larger and change the color?"

1. Read current file: dashboard_1.html
2. Make requested changes
3. Save as: dashboard_1_1.html
4. Present changes to user

User: "Perfect! Now can we add a sidebar?"

1. Read current file: dashboard_1_1.html
2. Add sidebar component
3. Save as: dashboard_1_2.html
4. Present changes to user
```

---

## Best Practices

### Layout Stage

✅ **Do**:
- Use ASCII wireframes for clarity
- Break down into component hierarchy
- Plan responsive behavior upfront
- Consider mobile-first approach
- Get approval before proceeding

❌ **Don't**:
- Skip wireframing and jump to code
- Ignore responsive considerations
- Proceed without user approval
- Over-complicate initial layout

### Theme Stage

✅ **Do**:
- Reference design system context files
- Use CSS custom properties
- Save theme to separate file
- Consider accessibility (contrast ratios)
- Avoid Bootstrap blue unless requested

❌ **Don't**:
- Hardcode colors in HTML
- Use generic/overused color schemes
- Skip contrast testing
- Mix color formats (stick to OKLCH)

### Animation Stage

✅ **Do**:
- Use micro-syntax for documentation
- Keep animations under 400ms
- Use transform/opacity for performance
- Respect prefers-reduced-motion
- Make animations purposeful

❌ **Don't**:
- Animate width/height (use scale)
- Create distracting animations
- Ignore performance implications
- Skip accessibility considerations

### Implementation Stage

✅ **Do**:
- Use single HTML file per design
- Load Tailwind via script tag
- Reference theme CSS file
- Use !important for framework overrides
- Test responsive behavior
- Provide alt text for images
- Use semantic HTML

❌ **Don't**:
- Split into multiple files
- Load Tailwind as stylesheet
- Inline all styles
- Skip accessibility attributes
- Use made-up image URLs
- Use div soup (non-semantic HTML)

---

## File Management

### Folder Structure

```
design_iterations/
├── theme_1.css
├── theme_2.css
├── landing_1.html
├── landing_1_1.html
├── landing_1_2.html
├── dashboard_1.html
├── dashboard_1_1.html
└── README.md (optional: design notes)
```

### Version Control

**Track iterations**:
- Initial: `design_1.html`
- Iteration 1: `design_1_1.html`
- Iteration 2: `design_1_2.html`
- Iteration 3: `design_1_3.html`

**New major version**:
- Complete redesign: `design_2.html`
- Then iterate: `design_2_1.html`, `design_2_2.html`

---

## Communication Patterns

### Stage Transitions

**After Layout**:
```
"Here's the proposed layout structure. The design uses a [description].
Would you like to proceed with this layout, or should we make adjustments?"
```

**After Theme**:
```
"I've created a [style] theme with [key features]. The theme file is saved as theme_N.css.
Does this match your vision, or would you like to adjust colors/typography?"
```

**After Animation**:
```
"Here's the animation plan using [timing/style]. All animations are optimized for performance.
Are these animations appropriate, or should we adjust the timing/effects?"
```

**After Implementation**:
```
"I've created the complete design as {filename}.html. The design includes [key features].
Please review and let me know if you'd like any changes or iterations."
```

### Iteration Requests

**User requests change**:
```
"I'll update the design with [changes] and save it as {filename}_N.html.
This preserves the previous version for reference."
```

---

## Handling Plan File Edits and Iterations

### User Edits Plan File Directly

**Scenario**: User opens `.tmp/design-plans/{name}.md` and makes changes

**Process**:
1. User edits plan file (changes requirements, adds constraints, modifies goals)
2. User notifies agent: "I've updated the plan file"
3. Agent reads updated plan file
4. Agent identifies what changed
5. Agent proposes how to incorporate changes
6. Agent updates affected stages

**Example**:
```
User: "I've updated the plan file - changed the color scheme to dark mode"

Agent: 
✅ Read updated plan: .tmp/design-plans/saas-landing-page.md

Changes detected:
- Color scheme: Light → Dark mode
- Primary color: Blue → Purple

This affects:
- Stage 2 (Theme) - needs regeneration
- Stage 4 (Implementation) - needs CSS update

Would you like me to:
1. Regenerate theme with dark mode
2. Update implementation with new theme
```

### Iteration Within a Stage

**Scenario**: User requests changes during a stage

**Process**:
1. Agent presents stage output (e.g., layout wireframe)
2. User requests changes: "Make the hero section taller"
3. Agent updates plan file with feedback
4. Agent makes changes
5. Agent updates plan file with new iteration
6. Agent presents updated output

**Example**:
```
Stage 1 - Layout Design

Agent: [presents wireframe]

User: "Make the hero section taller and move CTA above the fold"

Agent:
✅ Updated plan file with feedback
✅ Revised layout wireframe
✅ Updated plan file with Iteration 2

[presents updated wireframe]
```

### Tracking Iterations in Plan File

**Format**:
```markdown
## Design Evolution

### Iteration 1 - Initial Layout
- Date: 2026-01-30T10:00:00Z
- Stage: Layout
- Changes: Initial wireframe created
- User feedback: "Hero section too short, CTA below fold"

### Iteration 2 - Revised Layout
- Date: 2026-01-30T10:15:00Z
- Stage: Layout
- Changes: Increased hero height from 400px to 600px, moved CTA above fold
- User feedback: "Perfect! Approved."
- Status: ✅ Approved

### Iteration 3 - Theme Adjustment
- Date: 2026-01-30T10:30:00Z
- Stage: Theme
- Changes: Changed from light to dark mode, primary color blue → purple
- User feedback: "Love the dark mode!"
- Status: ✅ Approved
```

### Subagent Context Preservation

**Problem**: Subagents lose context between calls

**Solution**: Always pass plan file path

**Pattern**:
```javascript
// When delegating to subagent
task(
  subagent_type="OpenFrontendSpecialist",
  description="Implement Stage 4",
  prompt="Load design plan from .tmp/design-plans/saas-landing-page.md
  
  Read the plan file for:
  - All approved decisions from Stages 1-3
  - User requirements and constraints
  - Design evolution and iterations
  
  Implement Stage 4 (Implementation) following all approved decisions.
  
  Update the plan file with:
  - Output file paths
  - Implementation status
  - Any issues encountered"
)
```

### Plan File as Single Source of Truth

**Benefits**:
- ✅ All design decisions in one place
- ✅ User can review and edit anytime
- ✅ Subagents have full context
- ✅ Design history preserved
- ✅ Easy to iterate and refine
- ✅ No context loss between stages

**Best Practices**:
- Always read plan file at start of each stage
- Update plan file after every user interaction
- Track all iterations with timestamps
- Document user feedback verbatim
- Mark approved decisions clearly
- Pass plan file path to all subagents

---

## Quality Checklist

Before presenting each stage:

**Layout Stage**:
- [ ] ASCII wireframe is clear and detailed
- [ ] Components are well-organized
- [ ] Responsive behavior is planned
- [ ] User approval requested

**Theme Stage**:
- [ ] Theme file created and saved
- [ ] Colors use OKLCH format
- [ ] Fonts loaded from Google Fonts
- [ ] Contrast ratios meet WCAG AA
- [ ] User approval requested

**Animation Stage**:
- [ ] Animations documented in micro-syntax
- [ ] Timing is appropriate (< 400ms)
- [ ] Performance optimized (transform/opacity)
- [ ] Accessibility considered
- [ ] User approval requested

**Implementation Stage**:
- [ ] Single HTML file created
- [ ] Theme CSS referenced
- [ ] Tailwind loaded via script tag
- [ ] Icons initialized
- [ ] Responsive design tested
- [ ] Accessibility attributes added
- [ ] Images use valid placeholder URLs
- [ ] Semantic HTML used
- [ ] User review requested

---

## Troubleshooting

### Common Issues

**Issue**: User wants to skip stages
**Solution**: Explain benefits of structured approach, but accommodate if insisted

**Issue**: Theme doesn't match user vision
**Solution**: Iterate on theme file, create theme_2.css with adjustments

**Issue**: Animations feel too slow/fast
**Solution**: Adjust timing in micro-syntax, regenerate with new values

**Issue**: Design doesn't work on mobile
**Solution**: Review responsive breakpoints, add mobile-specific styles

**Issue**: Colors have poor contrast
**Solution**: Use WCAG contrast checker, adjust OKLCH lightness values

---

## References

- [Design Systems Context](../ui/web/design-systems.md)
- [UI Styling Standards](../ui/web/ui-styling-standards.md)
- [Animation Patterns](../ui/web/animation-patterns.md)
- [Design Assets](../ui/web/design-assets.md)
- [ASCII Art Generator](https://www.asciiart.eu/)
- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
