# Folder, notification and capture context selection

Scope: inventory item MVP-13 (AP-04, AP-10). This records what the renderer implements.
It is not evidence of an APK build, an emulator run, real integrations or device acceptance;
those gates stay open (see [current status](mvp-current-status.md)).

## Two separate things

1. **Selected identity** travels in the agent context envelope
   (`apps/app/src/runtime/phone-context.ts`). It is an opaque kind, id and revision. It never
   contains a name, path, URI, text or image.
2. **Reviewed content** reaches the conversation only as an excerpt the owner saw and could
   edit in the "Ask about selected content" review, then sent themselves.

## Sources

| Source | Identity | Review scope | Ends when |
| --- | --- | --- | --- |
| Files folder (`files-tree-adapter.ts`) | `folder`, opaque tree id, session-local `listing-N` counter | Names and types of the loaded entries of that one folder. No file or subfolder contents | The folder is left, a file is opened, or access ends |
| Selected document (`selection-adapter.ts`) | `document`, picker capability, accept epoch plus rename count | The shown text or PDF page | Closed, forgotten, reselected or renamed |
| Alpha Phone notification (`notifications-adapter.ts`) | `notification`, id, revision, `accountId: own` | That notification's shown title and text | The shade closes, or the row is dismissed, updated or hidden |
| Saved photo or video (`camera-adapter.ts`) | `photo` or `video`, library id and revision | The open item, described or read locally (English OCR) | Another item opens, or it is edited, trashed or removed |
| Camera frame | none | One unsaved frame | The camera closes or a capture starts |
| Settings page (`context-selection.ts`) | `settings`, section slug only | none | The page changes. Credential pages have no identity |

The provider's own folder revision embeds the display name, so it is used only for local
comparison and never sent.

## Change during review

A folder is read again when the owner chooses "Use in conversation". A deleted, added,
renamed or replaced entry, a changed folder or ended access adds nothing to the conversation;
the folder is shown as it now is and must be reviewed again. A notification is listed again
the same way and must still be present with the reviewed revision and text. A neighbor never
stands in for the reviewed item. A draft that was already placed is still subject to the
existing dispatch check: a changed context revision returns the message to the composer.

## Visibly unavailable

- Other apps' mirrored notifications and hosted results offer no question (P-03).
- A notification hidden by the lock screen offers no question.
- Excerpts that look like credentials or verification codes are refused in the notification review.
- A typed Photos or Files search question is not a capture. Outside the browser development
  profile it reports that content analysis is not connected.
- A Photos viewer question with no saved item open, and a Camera question while the camera
  is not ready, report that nothing was sent.

## Tests

`test/context-selection.test.mjs` (rules) and `test/browser/context-selection.spec.ts`
(rendered flows in the browser build). The browser app-files store cannot lose a grant, so the
revoke case stubs the listing answer at the plugin boundary. Android folder grants, MediaStore
and the notification listener are not exercised by these tests.
