# Desktop Pet 2.0 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first runnable Windows Electron MVP that demonstrates Desktop Pet 2.0's pet window, control panel, tray, Mini Mode, local behavior engine, character package editing, asset slots, Pomodoro, memo reminders, and safe event-driven companionship.

**Architecture:** Use Electron main process for system windows, tray, persistence, and local behavior simulation. Use React/Vite for two renderer entry points: a small transparent pet window and a control panel. Keep DeepSeek and Agent bridges as configured interfaces with local simulated decisions in the MVP.

**Tech Stack:** Electron, React, Vite, JavaScript, CSS, local JSON persistence.

---

### Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `pet.html`
- Create: `vite.config.js`
- Create: `src/main/main.js`
- Create: `src/preload/panelPreload.js`
- Create: `src/preload/petPreload.js`
- Create: `src/panel/PanelApp.jsx`
- Create: `src/pet/PetApp.jsx`
- Create: `src/shared/defaultState.js`
- Create: `src/shared/behaviorEngine.js`

- [ ] Add package scripts for `dev`, `build`, and `start`.
- [ ] Configure Vite with two HTML entry points.
- [ ] Create Electron main process with `panelWindow`, `petWindow`, and tray.
- [ ] Create preload APIs for panel and pet renderers.

### Task 2: Local State and Behavior Engine

**Files:**
- Modify: `src/shared/defaultState.js`
- Modify: `src/shared/behaviorEngine.js`
- Modify: `src/main/main.js`

- [ ] Define default character, memories, preferences, asset slots, Pomodoro, memos, events, and runtime state.
- [ ] Implement event-to-action local behavior decisions.
- [ ] Persist app state under Electron `userData`.
- [ ] Add IPC channels for reading state and updating preferences.

### Task 3: Pet Window

**Files:**
- Modify: `src/pet/PetApp.jsx`
- Create: `src/pet/PetApp.css`

- [ ] Render the pet as a compact animated character.
- [ ] Render emotion state, speech bubble, Mini Mode edge state, and click reactions.
- [ ] Support window dragging through preload IPC.
- [ ] Keep pet window small and transparent-friendly.

### Task 4: Control Panel

**Files:**
- Modify: `src/panel/PanelApp.jsx`
- Create: `src/panel/PanelApp.css`

- [ ] Add dashboard with current pet state, recent events, and quick controls.
- [ ] Add character training import preview for text, `skill.md`, `persona.md`, and `memories.md`.
- [ ] Add personality and memory editor.
- [ ] Add event-driven asset slot grid like the supplied reference image.
- [ ] Add Pomodoro and memo pages.
- [ ] Add privacy, DeepSeek, Agent, Mini Mode, DND, and performance sections.

### Task 5: Tray and Runtime Simulation

**Files:**
- Modify: `src/main/main.js`
- Modify: `src/shared/behaviorEngine.js`

- [ ] Add tray menu actions: show/hide pet, open panel, Mini Mode, DND, pause interactions, restart engine, exit.
- [ ] Add simulated work-state and agent events so the MVP can be watched without external integrations.
- [ ] Show tray status changes for DND, Mini Mode, and attention states.

### Task 6: Verification

**Commands:**
- Run: `npm install`
- Run: `npm run build`
- Run: `npm run dev`

- [ ] Verify build succeeds.
- [ ] Verify Electron opens the control panel and pet window.
- [ ] Verify Mini Mode and DND controls update pet behavior.
- [ ] Verify asset slot grid, character import preview, Pomodoro, memo, tray, and event log are visible.
- [ ] Verify no full-screen transparent overlay is used.
