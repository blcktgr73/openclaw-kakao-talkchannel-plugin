# Development Operating Model

This document adapts the shared project-working principles for the Kakao TalkChannel plugin repository.

It should be read together with:
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`

---

## 1. Development philosophy

This repository should be developed using a **transformation-centered** approach rather than ad-hoc feature shipping.

That means:
- make small, structurally meaningful changes
- compare options before implementation when the design is non-trivial
- preserve compatibility with OpenClaw plugin expectations
- keep documentation, tests, and code aligned
- treat relay/plugin/runtime boundaries as architectural decisions, not incidental implementation details

---

## 2. What counts as a Transformation here?

For this repository, a Transformation is a small but meaningful structural improvement such as:

- reducing hard dependency on the public relay default
- clarifying self-host relay setup for occloud
- introducing auto-session-hygiene behavior safely
- isolating pairing/session state more cleanly
- improving Kakao card response handling without breaking plain text behavior
- strengthening configuration schema, validation, or security boundaries

Non-trivial changes should be framed as:
- problem
- current context
- design options
- chosen path and rationale
- expected impact

---

## 3. Repository-specific design priorities

When making decisions, prioritize the following in order:

1. **OpenClaw compatibility**
   - preserve plugin contract and runtime expectations
2. **Operational clarity**
   - especially around relay / self-host deployment
3. **Session stability**
   - avoid brittle long-chat behavior
4. **Security boundaries**
   - especially tokens, pairing, relay routing, and user isolation
5. **Good Kakao UX**
   - cards, quick replies, safe defaults, understandable failure modes

---

## 4. Expected workflow for meaningful changes

### Step 1 — Load context
Review relevant files before changing code:
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- relevant adapter/config/runtime files
- docs related to relay, Kakao payloads, pairing, and setup

### Step 2 — Define one small change
Examples:
- "Replace shared public relay guidance with self-host-first guidance"
- "Add configurable auto-compact suggestion policy"
- "Separate relay health reporting from pairing status"

### Step 3 — Compare options
For non-trivial changes, compare 2-3 options briefly.

Examples of option dimensions:
- relay kept central vs moved closer to user VM
- suggest-only vs auto-compact behavior
- config-only solution vs runtime-driven behavior

### Step 4 — Implement in small units
Prefer narrow diffs affecting one concern at a time.

### Step 5 — Verify
At minimum:
- `pnpm typecheck`
- `pnpm lint`
- relevant unit/integration tests

### Step 6 — Update docs
If behavior, setup, architecture, or operator expectations changed, update docs in the same session.

### Step 7 — Sync issue state and push
Use `bd` if the work maps to an issue.
Then sync and push before ending the session.

---

## 5. Documentation expectations

When a change affects repository behavior, update the relevant documentation layer:

- `README.md`
  - user/operator facing setup and usage
- `docs/*`
  - architecture, relay model, card behavior, API details
- `AGENTS.md`
  - repository execution rules
- `CLAUDE.md`
  - higher-level guidance reference when needed

For this repo, relay-related changes should be especially well documented because deployment assumptions strongly affect adoption.

---

## 6. Current strategic direction for our fork

For the occloud-oriented fork, current working assumptions are:

- this plugin remains the baseline implementation
- public relay defaults should not be treated as the long-term operating default
- self-host relay should become a first-class documented path
- Kakao integration should fit an occloud architecture where user-specific OpenClaw VMs matter
- auto-session-hygiene is a legitimate product enhancement candidate

These assumptions may evolve, but changes should be explicit and documented.

---

## 7. Working checklist for future sessions

Before starting:
- [ ] Read `AGENTS.md`
- [ ] Read `CLAUDE.md`
- [ ] Run `bd onboard` if needed
- [ ] Identify the specific change being made

Before finishing:
- [ ] Update docs if needed
- [ ] Run quality gates
- [ ] Update `bd` issue status if applicable
- [ ] `bd sync`
- [ ] `git push`
- [ ] Confirm branch is up to date with origin

---

## 8. Practical interpretation

In this repository, "apply AGENTS and CLAUDE together" means:

- use `AGENTS.md` for execution discipline
- use `CLAUDE.md` for design discipline
- use docs to preserve product and architecture context

That combination is the default working model for the fork.
