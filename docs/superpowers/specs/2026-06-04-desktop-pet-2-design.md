# Desktop Pet 2.0 Design

## Product Positioning

Desktop Pet 2.0 is a local-first Windows intelligent emotional pet platform.

It is not primarily an AI chat companion and not only an AI coding-agent monitor. Its core value is a trainable desktop pet that understands low-risk computer work states, expresses a configurable personality, remembers user preferences, and provides emotional companionship through controlled desktop behavior.

The product direction is:

- Trainable pet personality and behavior style
- User-imported character material, including text, `skill.md`, `persona.md`, `memories.md`, and chat records
- Original pet personality by default
- Optional real-person style recreation only when explicitly selected and backed by user-provided material
- Computer work-state awareness, including AI agent status
- AI high-level emotional and interruption decisions
- Local behavior engine for safety, frequency control, and animation execution
- Mini Mode, Do Not Disturb, system tray, custom assets, Pomodoro, memo reminders, and lightweight daily work assistance

The guiding principle is:

> AI decides how to understand and express. Local systems decide what is safe, allowed, timely, and performant.

## Confirmed Product Choices

- First design mode: AI makes high-level decisions only.
- Later expansion: hybrid mode where AI can choose more detailed low-risk behavior, while local safety rules still control execution.
- Main product route: intelligent emotional pet platform, not only developer-agent pet.
- Default character training: materials train preferences, tone, behavior, and personality, not real-person impersonation.
- Advanced character mode: real-person style recreation is available only when the user explicitly chooses it and provides chat records, `skill.md`, `persona.md`, `memories.md`, or sufficient speaking samples.
- Desktop Goose-style behavior is allowed, including high-intensity attention-seeking interaction, but only as an opt-in, rate-limited behavior.
- There must be two frontends: pet appearance frontend and control panel frontend.
- There must be a Windows system tray.
- The pet window must not be a full-screen transparent overlay.

## System Architecture

```text
User material / skill.md / chat records / character art
        ↓
Training Center
        ↓
Character Package
        ↓
System state + Agent events + Weather + Pomodoro + Memo
        ↓
Event Center
        ↓
Privacy Filter and Safe Summary
        ↓
DeepSeek Decision Layer
        ↓
Local Behavior Engine
        ↓
Pet Window / Control Panel / Tray
```

## Core Modules

1. Pet Window
2. Control Panel
3. System Tray
4. Character Package System
5. Training Center
6. Memory Store
7. Event Center
8. Privacy Filter
9. DeepSeek Decision Layer
10. Behavior Engine
11. Asset Library
12. Mini Mode and Do Not Disturb
13. Pomodoro
14. Memo
15. Agent Bridge
16. Performance Guard

## Pet Window

The pet appearance frontend is the visible desktop pet.

It is responsible for:

- Showing the current pet
- Playing animations
- Showing short speech bubbles
- Handling click, drag, and right-click menu interactions
- Showing Mini Mode edge states
- Rendering emotional feedback from the behavior engine

It must be a small transparent Electron window that only wraps the pet, bubble, and local menu. It must not be a full-screen transparent layer.

Window requirements:

- Does not cover the whole screen
- Does not block Windows taskbar, browser menus, Office menus, or tray popups
- Uses normal floating always-on-top behavior, not screen-saver level
- Does not intercept mouse events outside the pet window
- Moves the real Electron window when dragged
- Lowers animation frame rate under resource pressure

The Pet Window does not call AI directly and does not read system state directly. It only renders `PetAction` commands.

Example action:

```json
{
  "action": "peek_from_edge",
  "emotion": "happy",
  "animation": "wave",
  "bubble": "完成啦，我在旁边陪你验收一下。",
  "durationMs": 5000,
  "interruptLevel": "low"
}
```

## Control Panel

The control panel is the management and training surface.

Recommended sections:

- Dashboard
- Character Training
- Personality and Memory
- Behavior Style
- Asset Library
- Mini Mode and Do Not Disturb
- Pomodoro
- Memo
- Work-State Monitoring
- AI Agent Link
- DeepSeek Settings
- Privacy Center
- Performance Settings
- Import and Export

The control panel is where users create, train, edit, review, and recover their pet. It should explain what the pet can read, what it cannot read, and what was sent to AI.

## System Tray

The tray is required for background operation and quick control.

Menu items:

- Show or hide pet
- Open control panel
- Current status
- Mini Mode on/off
- Do Not Disturb on/off
- Pause proactive interactions for 1 hour
- Today's reminder count
- Current character
- Recent events
- Restart behavior engine
- Exit

Tray requirements:

- Closing the control panel does not exit the app
- Hidden pet can be restored from the tray
- Exit must save config, stop event collection, stop local agent services, close all windows, destroy the tray, and quit
- Tray icon can show normal, working, Mini Mode, DND, permission waiting, or error states

## Character Package System

Each pet is a full character package, not only an image.

```text
pets/
  my-pet/
    character.json
    persona.md
    memories.md
    preferences.json
    behavior-style.json
    skill.md
    sprites/
    voice/
    history/
      versions/
```

### character.json

Stores basic character identity:

```json
{
  "id": "my-pet",
  "displayName": "小团子",
  "type": "original",
  "createdAt": "2026-06-04",
  "description": "一个温柔但有点调皮的工作陪伴桌宠",
  "avatarStyle": "2d-sprite",
  "defaultPersonality": "warm_playful",
  "safetyMode": "original_character"
}
```

Supported `type` values:

- `original`
- `inspired_by_materials`
- `real_person_style`

### persona.md

Defines role, tone, style, interaction rules, and boundaries.

### memories.md

Stores long-term memories in separated groups:

- Confirmed
- Candidate
- Sensitive Pending Confirmation

Sensitive memories require user confirmation before becoming long-term memory.

### preferences.json

Stores user preferences such as interruption level, quiet hours, liked scenes, disliked scenes, and privacy switches.

### behavior-style.json

Controls behavior style inputs:

```json
{
  "clinginess": 0.4,
  "playfulness": 0.6,
  "strictness": 0.2,
  "comforting": 0.8,
  "mischief": 0.3,
  "workSupervision": 0.5,
  "desktopGooseStyle": {
    "enabled": true,
    "maxPerDay": 3,
    "allowedActions": ["peek", "note", "follow_mouse_briefly"]
  }
}
```

### skill.md

Optional character-specific rule file. It can define role, interaction rules, memory rules, boundaries, and examples. It may be imported from external character-building workflows.

## Training Center

The training center turns user material into editable character data.

Supported first-version inputs:

- Pasted text
- TXT
- Markdown
- JSON character package
- `skill.md`
- `persona.md`
- `memories.md`
- Text-form chat records
- Images or character art for appearance reference only

Training flow:

```text
Import material
  ↓
Local parsing and privacy marking
  ↓
AI draft generation
  ↓
User preview
  ↓
User edits or deletes draft items
  ↓
User confirms
  ↓
Write character package
  ↓
Create version snapshot
```

AI must generate drafts only. It must not directly write long-term memory or overwrite character data without user preview.

Preview page must show:

- Personality
- Voice style
- Relationship style
- Long-term memory candidates
- Sensitive pending items
- Forbidden topics
- Behavior-style parameters
- Privacy risks
- Version diff

Chat records are sensitive. The app should support user-provided text-form records but should not automatically read WeChat databases or scan chat apps in the first version.

## Real-Person Style Mode

Real-person style recreation is an advanced mode.

Rules:

- User must explicitly choose it
- User must confirm material source and usage boundary
- User must provide enough material, such as chat records, `skill.md`, `persona.md`, `memories.md`, or speaking samples
- The pet must not default to claiming it is the real person
- User can convert the role back to original personality mode
- User can delete all related memories
- The app should show emotional-dependency and privacy warnings

Default wording:

```text
这个角色会参考材料中的说话方式和关系氛围，但不会自称为真实本人。
```

## Work-State Awareness and Privacy

The app should understand state, not content.

Allowed low-risk signals:

- System time
- App launch time
- Mouse active/inactive state
- Keyboard active/inactive state, without key contents
- Idle duration
- Foreground process name
- Foreground app category
- Safe window-title classification, not raw storage
- Full-screen state
- Meeting or presentation inference
- CPU and memory usage
- Battery status
- Network status
- IP-based city
- Weather
- AI agent events
- User feedback

Forbidden data:

- Keyboard contents
- Screenshots
- Screen recordings
- Chat message bodies
- Office document bodies
- Browser history
- Private file contents
- Automatic WeChat database reading
- Raw system logs uploaded to AI
- Hooks installed without user action

Privacy levels:

- P0: public or low-risk, such as time and weather
- P1: behavior summary, such as active duration and app category
- P2: sensitive inference, such as schedule, health, mood, or stress
- P3: forbidden data

P2 data can become candidate memory only and may require confirmation. P3 data is never collected.

## Event System

All signals become standardized events.

Example:

```json
{
  "id": "evt_001",
  "type": "work_focus_long",
  "source": "system_activity",
  "timestamp": "2026-06-04T14:30:00",
  "privacyLevel": "safe_summary",
  "summary": "用户连续在 coding 类应用中活跃 92 分钟",
  "rawDataStored": false
}
```

Core event types:

- `app_category_changed`
- `work_focus_started`
- `work_focus_long`
- `idle_short`
- `idle_long`
- `return_from_idle`
- `agent_task_started`
- `agent_task_completed`
- `agent_permission_waiting`
- `agent_error`
- `weather_changed`
- `cpu_high`
- `memory_high`
- `dnd_enabled`
- `mini_mode_enabled`
- `user_liked_action`
- `user_disliked_action`
- `pomodoro_started`
- `pomodoro_completed`
- `memo_due`

Events pass through:

```text
System signal
  ↓
Event normalization
  ↓
Privacy filtering
  ↓
Safe summary
  ↓
AI high-level decision
  ↓
Local behavior engine
  ↓
Pet feedback
```

## DeepSeek Decision Layer

DeepSeek receives safe summaries, not raw private data.

It decides:

- Whether interaction is appropriate
- Emotion
- Interruption strength
- Scene type
- Suggested speech intent
- Suggested action intent
- Candidate memory update

It must not directly control timers, windows, files, or raw actions.

Example output:

```json
{
  "scene": "agent_task_completed",
  "emotion": "开心、鼓励",
  "interruptLevel": "medium",
  "actionIntent": "celebrate_softly",
  "speechIntent": "短句鼓励",
  "suggestedText": "完成啦，我在旁边陪你验收一下。",
  "cooldownMinutes": 20,
  "memoryUpdate": {
    "type": "preference_signal",
    "content": "用户对任务完成庆祝类反馈接受度较高"
  }
}
```

## Local Behavior Engine

The behavior engine enforces hard rules.

It checks:

- Do Not Disturb
- Full-screen, meeting, presentation, or game state
- CPU and memory pressure
- Cooldowns
- Daily reminder limits
- User feedback history
- Mini Mode
- Whether the required animation exists
- Whether a bubble would block important UI

It can downgrade AI suggestions.

Example:

```text
AI suggests medium celebration.
User is in a meeting.
Actual behavior: edge peek only, no bubble.
```

Interruption levels:

- `silent`
- `ambient`
- `low`
- `medium`
- `high`

Default limits:

- Daily companionship is usually `ambient` or `low`
- Health reminders are at most `low` or `medium`
- Task completion can be `medium`
- Permission waiting can be `high`
- Meetings, presentations, games, and DND force downgrade

## Memory Update Rules

AI can suggest memories, but cannot directly write confirmed long-term memory.

Flow:

```text
AI suggests habit
  ↓
Candidate memory
  ↓
Evidence accumulates
  ↓
User confirmation if sensitive
  ↓
Confirmed memory
```

Examples:

- User usually starts work around 9:30
- User dislikes frequent water reminders
- User likes light celebration after agent tasks
- User accepts gentle rainy-day companionship

## Scenario Catalog

The app should support a broad catalog of inferred scenes.

Work rhythm:

- Usual work start
- Early work start
- Late work start
- Long focus session
- Night work
- Weekend work
- Work block completion
- End-of-day wind-down

Idle and return:

- Short idle
- Frequent short idle
- Long idle
- Return from long idle
- Lunch break return

Focus and distraction:

- Frequent social switching
- Entertainment drift during work time
- Long coding or document session
- User rejects reminders
- User pulls pet out of edge mode
- User moves pet to corner

AI agent:

- Session started
- Tool running
- Permission waiting
- Task completed
- Error
- Review needed
- Long-running task
- Multiple agents busy

Weather and time:

- Rain
- Heat
- Cold
- Poor air quality
- Night work
- Monday morning
- Friday afternoon

Emotional companionship:

- User says they are tired
- User asks for supervision
- User repeatedly ignores pet
- User clicks pet
- User asks pet to be quiet

Desktop Goose-style interactions:

- Peek from edge
- Short mouse-following
- Drag note
- Bring daily summary card
- Attention-seeking action
- Push video window as opt-in high-intensity behavior

## Mini Mode

Mini Mode states:

- `normal`
- `edge-peek`
- `edge-hidden`
- `pop-out`

Triggers:

- User enables Mini Mode
- User drags pet to screen edge
- Meeting, full-screen, or high-focus state
- User closes reminders repeatedly
- AI decides low-disturbance companionship is appropriate
- CPU or memory pressure

Rules:

- Default no large bubbles
- Mouse near edge reveals pet
- Mouse leaves edge hides pet
- Meeting or presentation allows only very low presence
- Dragging pet out of edge restores normal mode

## Do Not Disturb

DND is a hard local rule.

Triggers:

- User enables it
- Meeting app foreground
- Full-screen presentation
- Full-screen game
- Quiet hours
- User repeatedly rejects reminders
- High CPU or memory pressure

Allowed in DND:

- Quiet idle
- Edge Mini Mode
- Event logging
- Response to explicit user click
- Important status in tray

Blocked in DND:

- Large proactive bubbles
- Desktop Goose-style actions
- Mouse following
- Drag notes
- Strong animation
- Sound
- Frequent edge pop-outs

## Desktop Goose-Style Interaction

The product should borrow Desktop Goose's sense of life, not uncontrolled disruption.

Allowed examples:

- Peek
- Briefly follow mouse
- Drag note
- Bring reminder card
- Walk near screen edge
- Rest on window edge
- Weather-based visual reactions
- Attention-seeking action

The high-intensity video-window interaction is allowed only if the user opts in.

Event:

```text
long_no_interaction_while_video
```

Behavior:

- Light: pet peeks near video
- Medium: pet drags a small note over one corner
- High: pet briefly pushes or moves the video window

Safety:

- Default off
- Max 1 or 2 times per day
- Not in meeting, presentation, game, coding focus, Office work, or DND
- Not on system windows, taskbar, permission dialogs, or active input surfaces
- Has a 1-2 second preview gesture
- User mouse movement or click cancels
- Right-click option: "Do not do this today"

## Event-Driven Asset Slots

The asset library is an event-effect material grid. Users fill each action slot with corresponding animation material.

Categories:

- Basic states
- Emotional feedback
- Work events
- Mini Mode
- Mischief interactions
- Weather and time
- Special reminders

Required first-version slots:

- `idle`
- `happy`
- `sad`
- `sleep`
- `working`
- `waiting`
- `failed`
- `remind`
- `peek-left`
- `peek-right`
- `pop-out`
- `attention`
- `celebrate`

Optional slots:

- `push-window`
- `drag-note`
- `follow-mouse`
- `rainy`
- `hot`
- `cold`
- `night`
- `review`
- `thinking`
- `carry-item`

Each asset card shows:

- Animation preview
- Action name
- Action ID
- Status
- Trigger scenes
- Emotion tags
- Interruption level
- Required or optional
- Replace
- Test playback
- View trigger rules

Internal animation metadata:

```json
{
  "animationId": "celebrate",
  "displayName": "开心庆祝",
  "category": "emotion",
  "file": "sprites/celebrate.webp",
  "frameCount": 10,
  "frameRate": 12,
  "loop": false,
  "required": true,
  "fallback": "happy",
  "emotionTags": ["happy", "proud"],
  "triggerScenes": ["agent_task_completed", "work_block_completed"],
  "interruptLevel": "medium"
}
```

Fallback examples:

- `celebrate` missing -> `happy`
- `happy` missing -> `idle` plus bubble
- `push-window` missing -> `attention`
- `attention` missing -> `peek-left` or `peek-right`
- `rainy` missing -> `quiet` plus rainy bubble
- `failed` missing -> `worried`

## Pomodoro

Pomodoro is a companionship work-rhythm feature.

Trigger modes:

- User right-clicks pet and starts focus
- Control panel starts Pomodoro
- Tray starts Pomodoro
- AI suggests Pomodoro after detecting work-start or distraction
- Agent task starts and user chooses to pair it with focus
- Habit-based suggestion near usual work time

States:

- `idle`
- `suggested`
- `focus_running`
- `focus_paused`
- `break_running`
- `completed`
- `cancelled`

Asset slots:

- `focus-start`
- `focus-working`
- `focus-halfway`
- `focus-ending`
- `focus-complete`
- `break-start`
- `break-rest`
- `break-end`
- `focus-paused`
- `focus-cancelled`

During focus:

- Pet becomes quiet
- Mischief is disabled
- No drag notes or mouse following
- Agent permission and high-priority reminders still allowed
- Click pet to show remaining time

## Memo

Memo is a lightweight note and reminder feature.

Trigger modes:

- Right-click pet: remember this
- Tray: new memo
- Control panel: memo page
- User text: "帮我记一下..."
- AI suggestion when user says something that sounds like a task
- Agent error can become a pending memo

Memo types:

- Normal memo
- Timed reminder
- Later reminder
- Event-linked memo
- Daily idea
- Agent task memo

Asset slots:

- `memo-write`
- `memo-remind`
- `memo-found`
- `memo-done`
- `memo-snooze`
- `memo-list`

AI may identify likely memo intent, but local systems store, trigger, complete, snooze, and delete memos.

## Lightweight Work Assistance

First-version assistance:

- Long sitting reminder
- Water reminder
- Rest reminder
- Work-start companionship
- End-of-day wind-down
- Weather reminder
- Night-work reminder
- Task-completion celebration
- Memo reminders
- Pomodoro
- Daily summary as a later version

The app should not become a complex project-management tool.

## AI Agent Link

AI agent events are high-value sources but not the whole product.

First-version targets:

- Codex
- Claude Code

Possible later targets:

- Cursor
- Gemini CLI
- Copilot CLI

Unified agent events:

- `agent_session_started`
- `agent_task_started`
- `agent_thinking`
- `agent_tool_running`
- `agent_permission_waiting`
- `agent_task_completed`
- `agent_error`
- `agent_review_needed`
- `agent_idle`

The pet should not approve or reject permissions in the first version. It only reminds and visualizes status.

## Performance and Windows Safety

The app must prioritize low resource use.

Rules:

- No full-screen transparent overlay
- No keylogging
- No screenshot or screen recording
- No process injection
- No automatic chat database reading
- No hidden background behavior
- No unauthorized hook installation
- Local agent HTTP services bind to `127.0.0.1`
- User can see and disable all collection sources

Animation rules:

- Default 12-15 FPS
- Low-power mode 6-8 FPS
- Lower FPS in Mini Mode
- Avoid every-frame IPC
- Avoid large always-running GIFs
- Use small WebP or PNG sequence assets
- Reduce animation under CPU or memory pressure

Event polling:

- Mouse and keyboard: active/inactive state only
- Foreground app changes: event or low-frequency polling
- Idle detection: every 5-15 seconds
- Resource detection: every 10-30 seconds
- Weather: every 30-60 minutes
- Agent events: event-driven

Behavior queue priority:

```text
Permission waiting
  > user-set reminder
  > agent complete/error
  > Pomodoro
  > Memo
  > health reminder
  > weather
  > daily companionship
```

## Privacy Center

The control panel must show:

- What is currently read
- Recent generated events
- What was sent to AI
- What memories were written
- Candidate memories awaiting confirmation
- Switches for weather, agent hooks, foreground app category, and window-title classification
- One-click clear event logs
- One-click clear memory
- Export privacy report

## MVP Scope

First version should include:

- Small transparent pet window
- Control panel
- System tray
- Mini Mode
- Do Not Disturb
- Character package system
- Asset library
- Personality and memory editing
- `skill.md`, `persona.md`, and `memories.md` import
- Text-form material import
- DeepSeek high-level decision layer
- Local behavior engine
- Low-risk system state awareness
- Weather
- Pomodoro
- Memo
- Codex and Claude Code event link
- Privacy center
- Performance guard

Not first version:

- Automatic WeChat database reading
- Complex social media scraping
- Default real-person recreation
- Character marketplace
- Cloud sync
- Voice cloning
- Full calendar system
- Automatic permission approval
- Complex multi-agent dashboard

## MVP Success Criteria

The first version succeeds if the user feels:

- The pet accompanies their work
- The pet knows when to stay quiet
- The pet knows when to remind
- The pet remembers preferences
- The pet expresses with the selected character personality
- The pet does not spy on private content
- The pet does not slow down the computer
- The pet can be customized through character and asset packages

## First-Run Flow

```text
1. Open app
2. Choose or create pet character
3. Import persona.md, skill.md, memories.md, or fill personality
4. Upload basic animation assets
5. Configure DeepSeek
6. Choose privacy permissions
7. Enable Mini Mode and tray
8. Pet starts companionship
9. User feedback trains preferences
10. Control panel shows memories and events
```

## Open Implementation Notes

- The project directory was empty when this design was created.
- No implementation stack has been initialized yet.
- Git was not initialized, so this design document could not be committed.
- The next step after user review is to create an implementation plan.
