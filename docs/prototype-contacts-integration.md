# Native contacts in the prototype renderer

The production Contacts view uses `ElizaContacts` from the pinned
`vendor/eliza/plugins/plugin-native-contacts/android` project, registered as
`ai.eliza.plugins.contacts.ContactsPlugin`. The project and app dependency are
wired in Gradle. `installPrototypeContactsAdapter` installs after native callback
guards and before the agent adapter. Fixture mode retains the reference data.

The production directory starts empty; only a successful native list populates
it. Entering Contacts requests the bridge's contacts permission when necessary.
No permission request runs at app launch or merely from an inactive module render.
The upstream alias groups READ_CONTACTS and WRITE_CONTACTS, so Android may grant
both from this feature-scoped prompt. Denial, provider failure and legitimate
empty directories have distinct text in the existing list-row layout. Tapping
the status row retries; New contact also retries when access is not ready.
Returning to Contacts or returning from a native app refreshes the directory.
Stale reads after leaving cannot repopulate the directory. The adapter does not
cache address-book data in localStorage or send it to the model.

Shared prototype `api.people` and `api.person` resolve from the actual directory.
Unknown fixture IDs return a clearly named Unknown contact with no contact
coordinates, avoiding fabricated native recipients and null-unsafe prototype
workflow references. Some prototype modules retain independent static fixture
content; this adapter is not a migration of messages, mail or calendar provider
data. Native contact records show their first phone/email in the existing detail
layout; all values remain in the native record. Search uses the loaded names,
first phone and first email. No list limit is supplied, so the upstream API
returns all available contacts rather than silently truncating the directory.

Only explicit Save in a newly opened contact form calls `createContact`.
The adapter validates name and email, blocks unsupported nonempty address,
birthday or note fields, prevents concurrent submissions, and reads the native
record back by the returned aggregated contact ID. It confirms success only
when name/phone/email match. Native insertion creates a local accountless raw
contact; it does not promise cloud sync. A failed or ambiguous write/readback
blocks repeat Save on that form and instructs the user to check Android Contacts.
It never blindly retries a contact write. Cancelling and intentionally opening
a new form is a new user operation.

Edit, delete and favorite actions open the Android Contacts app because this
pinned bridge has no update/delete API. Real detail Call, Message and Email use
native handoffs with actual record coordinates, with completion in the receiving
app. They do not claim that a call connected or a message was sent.

TypeScript compilation passes. No build or emulator test has been run for this
adapter yet. Required acceptance: first-entry permission grant/deny/retry;
empty provider vs provider error; genuine list/search/detail; explicit-create
exact provider readback; double-save prevention; leave during permission/read;
background native edit followed by refresh; unsupported field refusal; both
Android packaging variants. Preserve the existing camera/agent tests when adding
this native dependency. The upstream contact writer can throw after insertion
but before returning a linked aggregate ID; ambiguous outcomes require manual
provider inspection, not automatic replay.
