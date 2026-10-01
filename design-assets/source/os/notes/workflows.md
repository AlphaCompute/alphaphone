# Workflows — review notes

## What didn't work in the old version
- "Change" and "+" only opened chat with a half sentence, so there was no way to build or edit by touch.
- "Run" only toasted. Nothing recorded that it ran, and there was no history. You couldn't see *what the agent did*,
  which is the core trust question for automations.
- No sense of what data a workflow touches, and no delete.
- Steps were free-form `[kind, text]` pairs ("Then" meant anything). I kept the diagram but gave steps a small typed palette.

## What I changed
- **List:** name + one sentence + toggle (unchanged). If the last run failed, the sentence becomes "Last run failed · reason"
  with an info glyph, and the home icon gets a badge. No icon chains.
- **Detail:** title, summary paragraph, **app chips** (Mail, Calendar, Messages… derived from trigger + steps),
  step diagram (When / Read / If / Write / Send / Notify / Speak / Do, vertically connected), last run, **Change**,
  **Run** (animates through the nodes, then appends a real run), header delete (undo bar) and on/off toggle (instant).
- **Run history** under the diagram: status disc (✓ succeeded / – skipped / ✕ failed), when, one-line outcome.
  **Run detail** sub-page: when, status, then a per-step log in plain language ("Read 14 new emails and 6 events today."),
  the output the agent produced (for example, the spoken brief text), a suggested fix on failures, **Ask Alpha** and **Run again**.
  Seeds cover all three statuses (Receipts to Files failed on a password-protected PDF).
- **Builder (create + edit, same sub-page):** name, trigger node (tap → sheet with Time / Event / Message / Place / Email;
  config = day chips + time stepper, event options, person picker, place options, or match text), steps added from a
  7-button palette (Read, If, Write, Send, Notify, Speak, Do). Tapping a step opens a sheet with presets, free text,
  move up/down and delete. Live app chips. Save generates the summary and short sentence; new workflows are on and open in detail.
  When the builder is empty, "Describe it to Alpha" hands off to chat. The pill is hidden while a builder sheet is open.
- **Agent:** "every weekday at 6, wrap up my day" / "whenever Maya texts, check my calendar" / "when I get home, remind me to…"
  → flow card with the full summary and **Turn on** (`act: {mod: "workflows", fn: "enable"}` adds it, persisted);
  "turn off/on X", "pause/enable X"; "why did X run/fail/skip" → explanation + card that opens that run; "run X now"; "delete the X workflow".

## Flows implemented (all walked in /tmp/agF/flow.js)
open → run now → new run in history → run detail → back · Change → trigger to "Maya texts me" → add Notify → reorder → save ·
delete → undo · manual builder (place trigger, Read, Speak added then deleted, custom Send text) → save → detail → list ·
toggle from list · chat create → Turn on → in list · chat turn off / why failed → card opens run detail ·
back order: sheet → builder → run → detail → list · home card "Morning brief" → detail `{open: 1}`.
Presets: `workflows`, `workflows:flow`, `workflows:run`, `workflows:failed`, `workflows:new`. Deep links `{open: id}`, `{open, run: runId}`, `{create: true}`.

## Shell requests
- The `flow` chat card only shows `name` + `short`. It would help to also show the app chips (what it will touch)
  before "Turn on", since that's the permission moment. Fields available on the card: `card.flow.steps[].apps`.
- See calendar notes for the build.py argv limit and test.js page-width issues.

## Round 2
- **Step diagram:** no WHEN/READ/… labels. Each node is a 32px circle with the step's icon (trigger icon by kind: clock, calendar, bubble, pin, mail; eye = read, diamond = if, pencil = write, arrow = send, bell = notify, wave = speak, bolt = do), then the step text only. The trigger node is filled `--acct`. The same applies in the builder.
- **Run log:**
  - Status disc (`--acct` ✓ / – / ✕), then a small step icon and the plain-language line. No mono labels.
  - The delivered output (or the suggested fix, marked with α) now comes first.
- **α chips:** "α Explain" on a run and "α Describe it" in an empty builder. No sparkles anywhere.
- **Deep links:** `{open: id, run: "latest"}` opens that workflow's newest run (Home's Morning brief card lands on the delivered brief), and back goes to the workflow. The preset `workflows:run` uses it.
- **Snackbar:** deleting uses `api.toast(label, {undo})`, which restores the workflow at its old position. The hand-rolled bar is removed.
- **Copy:**
  - List sentences are shortened to avoid orphans (plus `text-wrap: pretty`), and a failed run reads "Failed · PDF was password-protected".
  - Detail summaries are one sentence.
- **Builder:**
  - The Save pill is 36px and disabled until there's at least one step.
  - Sheets have a 28px radius and a serif 26px title.
  - The step sheet has Delete (`--s2`, trash) and Done (accent) side by side, and a filled 56px text field.
