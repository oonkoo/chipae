# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Web browser — Next.js 16 (App Router) + React 19. No Godot/Unity/Unreal.
- **Language**: TypeScript (strict mode)
- **Rendering**: [TO BE DECIDED per game — Canvas 2D, WebGL/WebGPU (Three.js / PixiJS / Phaser), or DOM/CSS for UI-driven games]
- **Physics**: [TO BE DECIDED — e.g., custom, matter.js, rapier (WASM), or none]

## Input & Platform

<!-- Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Web (desktop + mobile browsers)
- **Input Methods**: Keyboard/Mouse, Touch
- **Primary Input**: [TO BE CONFIGURED — depends on the game]
- **Gamepad Support**: [TO BE CONFIGURED — Gamepad API available if wanted]
- **Touch Support**: Full (mobile browsers are a target)
- **Platform Notes**: Must run in the browser sandbox; assets served from `public/`; watch bundle size and initial-load time. Server-side logic (leaderboards, multiplayer) goes through Next.js route handlers.

## Naming Conventions

- **Classes**: PascalCase
- **Variables**: camelCase
- **Signals/Events**: camelCase, past-tense for emitted events (e.g., `playerDied`)
- **Files**: kebab-case for modules (`game-loop.ts`), PascalCase for React components is NOT used here — components are also kebab-case files exporting PascalCase components (see `components/ui/button.tsx`)
- **Scenes/Prefabs**: N/A (web) — game scenes are TypeScript modules under `lib/game/`
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase for config objects

## Performance Budgets

- **Target Framerate**: 60 fps
- **Frame Budget**: 16.6 ms (game update + render inside `requestAnimationFrame`)
- **Draw Calls**: [TO BE CONFIGURED once rendering approach is chosen]
- **Memory Ceiling**: [TO BE CONFIGURED — keep mobile browsers in mind]

## Testing

- **Framework**: [TO BE CONFIGURED — run /test-setup; Vitest is the natural fit for this stack]
- **Minimum Coverage**: [TO BE CONFIGURED]
- **Required Tests**: Balance formulas, gameplay systems, networking (if applicable)

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- Hardcoded gameplay values in logic code — all tunable values live in data files under `lib/game/data/`
- Game logic inside React components — components render; logic lives in `lib/game/`
- Importing `pusher` / `pusher-js` outside `lib/realtime/` — all realtime access goes through the abstraction (ADR-0001)
- Client-triggered realtime events — events are published server-side only, after the Postgres write succeeds (ADR-0001)

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- Already in the project: @base-ui/react, @remixicon/react, class-variance-authority, clsx, tailwind-merge, tw-animate-css
- Game libraries: [None approved yet — propose via /architecture-decision]

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- ADR-0001: Platform realtime = Pusher Channels behind `lib/realtime/` abstraction; DB is sole authority (`docs/architecture/adr-0001-platform-realtime-layer.md`)

## Engine Specialists

<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: gameplay-programmer (web/TypeScript — no engine-specialist set applies)
- **Language/Code Specialist**: gameplay-programmer
- **Shader Specialist**: technical-artist (WebGL/GLSL work, if any)
- **UI Specialist**: ui-programmer
- **Additional Specialists**: network-programmer (multiplayer via route handlers/WebSockets), performance-analyst
- **Routing Notes**: The Godot/Unity/Unreal specialist agents included with the template are NOT used in this project.

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (`lib/game/**/*.ts`) | gameplay-programmer |
| Shader / material files (`*.glsl`, `*.wgsl`) | technical-artist |
| UI / screen files (`components/**/*.tsx`, `app/**/*.tsx`) | ui-programmer |
| Scene / prefab / level files (`lib/game/data/**`) | systems-designer |
| Native extension / plugin files | N/A (web) |
| General architecture review | Primary |
