# AGENTS.md

## Architecture

Static frontend + two Netlify Functions, no build step, no framework.

- `public/index.html` — entire UI in one file (styles, markup, and a small vanilla-JS client). Handles
  login, session storage of the password token and current working directory, command history
  (up/down arrows), and rendering of stdout/stderr.
- `netlify/functions/login.mts` — `POST /api/login`, validates `{ password }` against
  `process.env.TERMINAL_PASSWORD` with a timing-safe comparison. Returns `{ ok: true }` or 401/500.
- `netlify/functions/terminal.mts` — `POST /api/terminal`, requires `Authorization: Bearer <password>`,
  runs `{ command }` via `child_process.exec` under `/bin/bash` with a 15s timeout and a max output buffer,
  starting from the client-supplied `{ cwd }`. Appends a sentinel `__CWD__<pwd>__CWD__` line to capture the
  resulting directory so the client can persist it for the next request, then strips that line before
  returning `{ stdout, stderr, cwd, exitCode }`.

Routes are pinned via each function's `config.path` export (`/api/login`, `/api/terminal`) rather than the
default `/.netlify/functions/*` paths.

## Key decisions

- **No persistent shell process.** Netlify Functions are stateless/ephemeral, so there is no long-lived pty
  or shell to attach to. Instead, each request is a self-contained `bash -c` invocation; only the working
  directory is threaded through client-side. Do not attempt to add a WebSocket-based pty without first
  confirming the hosting target supports long-lived connections — Netlify Functions do not.
- **Auth is a single shared password**, not per-user accounts. This is intentionally simple for a
  single-operator tool. If multi-user access control is ever needed, replace this with Netlify Identity
  (see the `netlify-identity` skill) rather than layering ad hoc logic on top.
- **No command allow/deny list.** The security boundary is authentication + Netlify's own function sandbox
  isolation, not command filtering. Don't add a blocklist as a false sense of security — it's trivially
  bypassed and gives a misleading impression of safety.

## Conventions

- Functions use `.mts` (TypeScript ES modules) per the `netlify-functions` skill's guidance.
- Keep the frontend as a single static HTML file; do not introduce a bundler/framework unless the feature
  set genuinely requires it.
