# Reviewed resident IPC recovery patch

This patch fixes the startup dead end after eight retained transport directories.
It adds an explicit, service-owned review and intact archive operation. It does
not delete records, increase the limit, change the runtime pin, or start work.

The base is `3d76ff5acacb369e2c58fc8512e69e59f53ce69b`. The upstream candidate is
`371763e735c3f1ce7a61bef09a5f44cab46dead2`; its production changes are identical
to `ade8fdeaf5daf76ae7b1246fe91b645192a6e544`. The separate resident manifest
binds the exact two source paths, patch digest, and before/after hashes. Native
staging authenticates the unchanged prepared source and records the patched
and generated identity-specific hashes. It never edits the vendor checkout.

The archive preserves complete directories and files. A durable pending archive
blocks later startup, including after process death. The last filesystem action
is the atomic pending-to-complete rename. All records and both parents were
synced while pending; the completed name itself is not guaranteed to survive
power loss. A restored pending name fails closed and needs review.

An isolated Android 14 normal-app probe passed eight cases with no ignored tests.
Android denied the hardlink fixture with `EACCES`: that proves platform protection,
not execution of the native archive link-count refusal. This does not prove the
full service, Alpha bridge, UI recovery, or installed user-record recovery. Those
require the integrated Android build and normal UI acceptance.
