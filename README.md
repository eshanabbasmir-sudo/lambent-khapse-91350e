# Web Terminal

A password-protected, real web-based terminal. Commands typed in the browser are sent to a
Netlify Function and executed with `bash` inside that function's isolated, ephemeral runtime
container — the same sandbox Netlify uses for every function invocation. Nothing runs in the
visitor's browser itself.

## How it works

- `public/index.html` — the terminal UI (login screen + command prompt), plain HTML/CSS/JS, no build step.
- `netlify/functions/login.mts` — verifies the password against the `TERMINAL_PASSWORD` environment variable.
- `netlify/functions/terminal.mts` — runs the submitted command with `child_process.exec` under `/bin/bash`,
  enforces a 15s timeout and output size cap, and returns stdout/stderr plus the resulting working directory
  so `cd` persists across commands within a browser session.

Each request to `/api/terminal` is a fresh, isolated function invocation. The working directory is tracked
client-side (in `sessionStorage`) and replayed on the next command (`cd <dir> && <command>`), which is what
makes multi-step shell sessions (e.g. `cd foo` then `ls`) feel continuous.

## Configuration

Set an environment variable on the Netlify site before using it:

- `TERMINAL_PASSWORD` — the password required to open a session. Without it, both `/api/login` and
  `/api/terminal` respond with a 500 telling you it's unset.

## Running locally

```bash
npm install
netlify dev
```

Then set `TERMINAL_PASSWORD` in a local `.env` file (not committed) or via `netlify env:set`, and open the
printed local URL.

## Security notes

- The password is checked with a constant-time comparison to resist timing attacks.
- Anyone who knows the password can run arbitrary commands inside the function's sandbox — treat the
  password like an SSH credential and rotate it if it leaks.
- The sandbox is Netlify's own ephemeral function container: it has no access to other sites' data, and its
  filesystem changes do not persist between deploys.
