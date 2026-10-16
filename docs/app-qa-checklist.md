# Alpha app QA and approval checklist

Live preview: <http://127.0.0.1:5209/>. Product `8b3d1c3a`; agent `9e7a1553`. Updated October 15, 2026 (Pacific).

This is the ongoing acceptance ledger for the full requested app scope. The JSON companion is the editable source of truth. A prior preview pass remains a prior pass until repeated on the latest build. Native testing and your approval are separate. No rows are marked human-approved by the agent.

For every applicable row review light/dark theme, compact portrait, landscape, large text, keyboard and safe-area clearance, Back, reload/resume, and empty/loading/offline/error/denied states. Add newly discovered branches before declaring an area complete.

Immediate order: latest preview → deployed backend operations and prompt proof → packaged native/Seeker → view-by-view human review. Labels/categories remain deferred; Phone/Messages/Contacts require AOSP; Wallet is excluded.

## Shell and Home

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| shell-and-home-01 | Cold launch and saved connection restoration | Pending | Pending | Pending |
| shell-and-home-02 | Home cards and current calendar summary | Pending | Pending | Pending |
| shell-and-home-03 | App grid and All apps search | Pending | Pending | Pending |
| shell-and-home-04 | Full-height layout and chat-pill clearance | Prior preview pass; latest retest pending | Pending | Pending |
| shell-and-home-05 | Back gesture and cross-app return | Pending | Pending | Pending |
| shell-and-home-06 | Chat pill, half sheet and full conversation | Pending | Pending | Pending |
| shell-and-home-07 | Conversation history after reload | Prior preview pass; latest retest pending | Pending | Pending |
| shell-and-home-08 | Prompt cancellation and stale approval refusal | Pending | Pending | Pending |
| shell-and-home-09 | Voice start, interrupt, mute and stop | Pending | Pending | Pending |
| shell-and-home-10 | Keyboard opening, dismissal and focus | Pending | Pending | Pending |
| shell-and-home-11 | Notifications shade and ongoing activity | Pending | Pending | Pending |
| shell-and-home-12 | Lock, background, resume and secure camera | Pending | Pending | Pending |
| shell-and-home-13 | Loading, offline, denied, empty and recovery states | Pending | Pending | Pending |

## Inbox

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| inbox-01 | Inbox and unread rows | Pending | Pending | Pending |
| inbox-02 | Account and folder switching | Pending | Pending | Pending |
| inbox-03 | Search on Enter and mobile keyboard | Pending | Pending | Pending |
| inbox-04 | Themed folder menu and removal of More/Search clutter | Pending | Pending | Pending |
| inbox-05 | Sender images in list and detail | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-06 | Preview apostrophes, entities and charset decoding | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-07 | HTML email and default image loading | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-08 | Image-loading preference | Pending | Pending | Pending |
| inbox-09 | Long email scrolling and no repeated link chips | Pending | Pending | Pending |
| inbox-10 | Sender address disclosure: From/To/Cc/Reply-to/date | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-11 | Thread reading and attachments | Pending | Pending | Pending |
| inbox-12 | New compose alongside unfinished drafts | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-13 | Reply, Reply all and Forward | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-14 | Resume, discard and recover local drafts | Pending | Pending | Pending |
| inbox-15 | Provider drafts and attachments | Pending | Pending | Pending |
| inbox-16 | Spam, Archive, Sent, Starred and Trash reads | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-17 | Read/unread, star, archive, trash and restore writes | Pending | Pending | Pending |
| inbox-18 | Agent list/search/read full email | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-19 | Agent self-addressed send and delivery readback | Pending | Pending | Pending |
| inbox-20 | Send approval, cancellation, duplicate and uncertain outcome | Pending | Pending | Pending |
| inbox-21 | Account-scoped persistent cache and background refresh | Prior preview pass; latest retest pending | Pending | Pending |
| inbox-22 | Disconnect/reconnect without cross-account data | Pending | Pending | Pending |
| inbox-23 | Labels/categories | Outside current standalone QA | Not applicable | Scope recorded |

## Calendar

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| calendar-01 | Agenda, day/week and month switching | Pending | Pending | Pending |
| calendar-02 | Today, date picker and month header | Pending | Pending | Pending |
| calendar-03 | Event detail and location links | Pending | Pending | Pending |
| calendar-04 | Create local event | Pending | Pending | Pending |
| calendar-05 | Edit local event and recurrence | Pending | Pending | Pending |
| calendar-06 | Delete local event and Undo | Pending | Pending | Pending |
| calendar-07 | Reminders, alerts and notification delivery | Pending | Pending | Pending |
| calendar-08 | Google accounts and permissions in Settings | Pending | Pending | Pending |
| calendar-09 | Google calendars list and selected source | Pending | Pending | Pending |
| calendar-10 | Local-first use before Google connection | Pending | Pending | Pending |
| calendar-11 | Google linked sync enable, destination and status | Pending | Pending | Pending |
| calendar-12 | Persistent cache and background reconciliation | Prior preview pass; latest retest pending | Pending | Pending |
| calendar-13 | Agent calendar sources and agenda read | Prior preview pass; latest retest pending | Pending | Pending |
| calendar-14 | Agent Google event create and readback | Prior preview pass; latest retest pending | Pending | Pending |
| calendar-15 | Agent Google event update and replay protection | Prior preview pass; latest retest pending | Pending | Pending |
| calendar-16 | Agent Google event deletion and provider readback | Pending | Pending | Pending |
| calendar-17 | Uncertain deletion reconciliation without duplicate write | Pending | Pending | Pending |
| calendar-18 | Native consent and CalendarProvider writes | Pending | Pending | Pending |
| calendar-19 | Native linked sync, restart recovery and Undo | Pending | Pending | Pending |
| calendar-20 | Account switch, expired consent and offline recovery | Pending | Pending | Pending |

## Browser

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| browser-01 | Blank/new tab and address search | Pending | Pending | Pending |
| browser-02 | Real website rendering and navigation | Prior preview pass; latest retest pending | Pending | Pending |
| browser-03 | Back, Forward and same-URL reload | Pending | Pending | Pending |
| browser-04 | Tabs create, switch and close | Pending | Pending | Pending |
| browser-05 | Bookmarks and history | Pending | Pending | Pending |
| browser-06 | Downloads and selected-file handoff | Pending | Pending | Pending |
| browser-07 | Share page, selection and Ask Alpha | Pending | Pending | Pending |
| browser-08 | Permissions, popups, errors and recovery | Pending | Pending | Pending |
| browser-09 | Autofill and password-provider handoff | Pending | Pending | Pending |
| browser-10 | Read aloud and speech lifecycle | Pending | Pending | Pending |

## Camera

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| camera-01 | Photo mode and actual capture | Prior preview pass; latest retest pending | Pending | Pending |
| camera-02 | Video mode, recording clock and stop | Pending | Pending | Pending |
| camera-03 | Mode switching, front/back and zoom | Pending | Pending | Pending |
| camera-04 | Focus, exposure and supported flash controls | Pending | Pending | Pending |
| camera-05 | Permission denied, device busy and track termination | Prior preview pass; latest retest pending | Pending | Pending |
| camera-06 | Transient toast timeout and centered logo | Pending | Pending | Pending |
| camera-07 | Capture review and session gallery | Pending | Pending | Pending |
| camera-08 | Scan capture, add/reorder/remove pages | Pending | Pending | Pending |
| camera-09 | Scan draft save, load and explicit removal | Pending | Pending | Pending |
| camera-10 | Image PDF and searchable PDF export | Pending | Pending | Pending |
| camera-11 | Compact Ask Alpha review and OCR | Pending | Pending | Pending |
| camera-12 | Exit/background recording and save behavior | Pending | Pending | Pending |

## Photos

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| photos-01 | Library groups and thumbnail loading | Pending | Pending | Pending |
| photos-02 | Stable top-bar layout across Photos/Albums | Pending | Pending | Pending |
| photos-03 | Albums list, contents, selection and batch actions | Pending | Pending | Pending |
| photos-04 | Search, favorites and empty results | Pending | Pending | Pending |
| photos-05 | Photo viewer, zoom and previous/next | Pending | Pending | Pending |
| photos-06 | Video playback and controls | Pending | Pending | Pending |
| photos-07 | Photo edits save as copy | Pending | Pending | Pending |
| photos-08 | Video trim timeline, rotate, crop and preview | Pending | Pending | Pending |
| photos-09 | Edited-video audio, original preservation and save-copy | Prior preview pass; latest retest pending | Pending | Pending |
| photos-10 | Info and metadata | Pending | Pending | Pending |
| photos-11 | Share/export actual result | Pending | Pending | Pending |
| photos-12 | Recently Deleted opens preview on tap | Prior preview pass; latest retest pending | Pending | Pending |
| photos-13 | Recover one or selected items | Prior preview pass; latest retest pending | Pending | Pending |
| photos-14 | Permanently delete only explicit selected items | Prior preview pass; latest retest pending | Pending | Pending |
| photos-15 | Selection cancel, empty selection and toolbar states | Pending | Pending | Pending |
| photos-16 | Native permitted library and consent updates | Pending | Pending | Pending |

## Maps

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| maps-01 | Real map tiles and rendering | Prior preview pass; latest retest pending | Pending | Pending |
| maps-02 | Location consent, fix and retry | Prior preview pass; latest retest pending | Pending | Pending |
| maps-03 | Manual origin and coordinate entry | Pending | Pending | Pending |
| maps-04 | Place search, results and empty state | Pending | Pending | Pending |
| maps-05 | Place details and saved places | Pending | Pending | Pending |
| maps-06 | Directions preview and mode selection | Pending | Pending | Pending |
| maps-07 | Navigation start, progress, arrival and stop | Pending | Pending | Pending |
| maps-08 | Location expiry, offline and provider errors | Pending | Pending | Pending |
| maps-09 | Theme, large text, landscape and regional renderer | Pending | Pending | Pending |
| maps-10 | Agent route request and allowance handling | Pending | Pending | Pending |

## Notes

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| notes-01 | List, pinned notes and search | Prior preview pass; latest retest pending | Pending | Pending |
| notes-02 | Create, edit and save text note | Prior preview pass; latest retest pending | Pending | Pending |
| notes-03 | Checklist conversion and item editing | Pending | Pending | Pending |
| notes-04 | Reload/restart persistence | Prior preview pass; latest retest pending | Pending | Pending |
| notes-05 | Recoverable trash and explicit restore | Prior preview pass; latest retest pending | Pending | Pending |
| notes-06 | Recording, dictation and interruption | Pending | Pending | Pending |
| notes-07 | Voice playback, transcript and summary | Pending | Pending | Pending |
| notes-08 | Share and selected note Ask Alpha | Pending | Pending | Pending |
| notes-09 | Conflict, full storage and retained damaged data | Pending | Pending | Pending |

## Files

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| files-01 | Root and actual storage usage | Prior preview pass; latest retest pending | Pending | Pending |
| files-02 | Folder create, open, rename and reload | Prior preview pass; latest retest pending | Pending | Pending |
| files-03 | Search, sorting and grid/list | Pending | Pending | Pending |
| files-04 | Native folder grant and revoked permission | Pending | Pending | Pending |
| files-05 | Selection and disabled empty-selection actions | Prior preview pass; latest retest pending | Pending | Pending |
| files-06 | Document, image, audio and video preview | Pending | Pending | Pending |
| files-07 | Rename, share and export | Pending | Pending | Pending |
| files-08 | Selected-file Ask Alpha and cancellation | Pending | Pending | Pending |
| files-09 | Empty, busy, unsupported, offline and error states | Pending | Pending | Pending |

## Workflows

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| workflows-01 | List and enabled/disabled states | Pending | Pending | Pending |
| workflows-02 | Detail and trigger/action graph | Pending | Pending | Pending |
| workflows-03 | Create and edit workflow | Pending | Pending | Pending |
| workflows-04 | Reviewed activation and permission scope | Pending | Pending | Pending |
| workflows-05 | Run, cancel and duplicate prevention | Pending | Pending | Pending |
| workflows-06 | Run history, failed steps and retry | Pending | Pending | Pending |
| workflows-07 | Reminder list refresh and completion | Prior preview pass; latest retest pending | Pending | Pending |
| workflows-08 | Schedule timing and restart recovery | Pending | Pending | Pending |
| workflows-09 | Agent workflow creation and selected-run context | Pending | Pending | Pending |

## Settings

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| settings-01 | Top-level row alignment and text wrapping | Pending | Pending | Pending |
| settings-02 | Character and assistant preferences | Pending | Pending | Pending |
| settings-03 | Accounts and Google consent | Pending | Pending | Pending |
| settings-04 | Connections and exact access labels | Pending | Pending | Pending |
| settings-05 | Gmail image-loading preference | Pending | Pending | Pending |
| settings-06 | Calendar sync settings and status | Pending | Pending | Pending |
| settings-07 | Privacy, permissions and activity | Pending | Pending | Pending |
| settings-08 | Password provider and autofill | Pending | Pending | Pending |
| settings-09 | Display, theme and text size | Pending | Pending | Pending |
| settings-10 | Sound, vibration and Do Not Disturb | Pending | Pending | Pending |
| settings-11 | Notifications and channels | Pending | Pending | Pending |
| settings-12 | Wi-Fi, Bluetooth and mobile settings handoff | Pending | Pending | Pending |
| settings-13 | Battery and unavailable capability presentation | Pending | Pending | Pending |
| settings-14 | Models and local speech readiness | Pending | Pending | Pending |
| settings-15 | Subscription/plan and service status | Pending | Pending | Pending |
| settings-16 | Problems, diagnostics and licenses | Pending | Pending | Pending |
| settings-17 | About and actual installed version | Pending | Pending | Pending |
| settings-18 | Reset Alpha data scoped to disposable native qualification | Pending | Pending | Pending |

## Platform and release

| ID | View / flow | Preview evidence | Seeker | Your approval |
| --- | --- | --- | --- | --- |
| platform-and-release-01 | Standalone Android capability boundaries | Pending | Pending | Pending |
| platform-and-release-02 | Seeker signed update preserving app data | Pending | Pending | Pending |
| platform-and-release-03 | Native Calendar consent/sync/write/Undo acceptance | Pending | Pending | Pending |
| platform-and-release-04 | Native Gmail prompt read/send and delivery | Pending | Pending | Pending |
| platform-and-release-05 | Native Camera/Photos and permitted media | Pending | Pending | Pending |
| platform-and-release-06 | Native Maps/location and navigation | Pending | Pending | Pending |
| platform-and-release-07 | Native voice and lifecycle | Pending | Pending | Pending |
| platform-and-release-08 | AOSP-only Phone views | Outside current standalone QA | Not applicable | Scope recorded |
| platform-and-release-09 | AOSP-only Messages views | Outside current standalone QA | Not applicable | Scope recorded |
| platform-and-release-10 | AOSP-only Contacts views | Outside current standalone QA | Not applicable | Scope recorded |
| platform-and-release-11 | Wallet excluded from MVP | Outside current standalone QA | Not applicable | Scope recorded |
| platform-and-release-12 | Latest source/runtime/build/installed provenance | Pending | Pending | Pending |
| platform-and-release-13 | Host verification and production bundle audit | Prior preview pass; latest retest pending | Pending | Pending |
| platform-and-release-14 | Hosted CI at published head | Pending | Pending | Pending |
| platform-and-release-15 | Commits, upstream pins and PR reconciliation | Pending | Pending | Pending |
| platform-and-release-16 | Human per-view approval and final acceptance | Pending | Pending | Pending |
