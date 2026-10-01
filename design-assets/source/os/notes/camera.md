# Camera — notes

## Review (before building)
- The old build had no camera: the lock-screen and home buttons only showed a toast ("Camera opens the AOSP app"). So there was nothing to reuse, and the lock-screen camera button went nowhere.
- The brief risked clutter: flash, zoom, modes, flip, thumbnail, an Alpha button and scan actions all on one black screen. I kept the usual camera layout (flash on the left, α on the right, zoom chips over the bottom of the viewfinder, mode words, then the shutter row) and gave every control an icon with no labels. Mode names stay as text because that is the one place text is clearer than icons.
- "Ask Alpha" had no obvious gesture. It now has two: the α button, and holding on the viewfinder. Both send a real chat message, so the question and the answer appear in the conversation. Tap to focus and swiping between modes also work on the viewfinder.
- Scan mode needed the agent to *read* the page, not just take a picture. It first shows "Looking for a page". About a second later it outlines the page, and Alpha's reading appears as a caption ("Open Studio · Fri 6 PM") with the actions Add event, Save to Files and Open link.

## Implemented
- Viewfinder: a CSS park scene on the back camera and a selfie silhouette on the front. The frame drifts slightly, like a handheld shot (one 1 s tick while the app is open, cleared on leave). Tap to focus shows a ring. Switching cameras blurs the frame briefly.
- Modes: Video, Photo and Scan. Switch by tapping the mode word or by swiping left or right on the viewfinder. Deep link `{mode}`, plus presets `camera:video` and `camera:scan`.
- Zoom chips .5, 1×, 2 and 5 scale the scene. The chosen zoom is saved with the photo as `z`, so the Photos thumbnail matches what the viewfinder showed. The chips are hidden on the front camera and in Scan mode.
- Flash toggle (bolt / bolt with a slash). The shutter flashes white on capture, brighter when flash is on.
- Video: the red shutter turns into a red square while recording and a red timer pill appears at the top. Stop, back or leaving the app all save a video with its real length.
- Scan: the shutter saves the scan. Save to Files saves it and shows a toast. Add event shows a toast. Open link goes to browser `{url}`. In chat, Alpha returns an event card.
- Every capture is added to the front of `photos.list` with `api.setView`, and appears in Photos right away. The thumbnail opens the photo with `photos {open, from: "camera"}`, and back from that photo returns to Camera.
- reply(), when Camera is open: "what am I looking at / what does it say" describes the photo or scan (scan includes an event card with a `camera.addEvent` action), "take a photo", "take a selfie", "add it to my calendar" and "save it to Files". From anywhere: "take a photo/selfie", "record a video" and "scan a document" open Camera in the right mode.
- Immersive `{dark, noPill}`. Home uses the shell bar. Back stops a recording first, otherwise it goes Home. The lock-screen camera button works.

## Shell requests
- **build.py**: `node -e <whole script>` now fails with `E2BIG` because all modules together are over 128 KB. Pipe the probe through stdin instead: `subprocess.run(["node"], input=probe, …)`. I used a private patched copy at `/tmp/agC/build.py` and did not change the shared file.
- Lock-screen camera currently calls `unlock()` first. A real phone opens the camera without unlocking and blocks the library. That could be a `secure` flag passed to the module, but it is low priority.
- The shell toast (top 54px) sits on top of immersive headers. Offer a `toast(msg, {action})` variant that shows at the bottom.

## Round 2 (SPEC.md)
- **Secure mode** (opened from the lock screen):
  - The thumbnail, and the Photos viewer it opens, only show photos taken in this camera session. No thumbnail appears until the first capture.
  - α and holding the viewfinder answer in a caption over the viewfinder (tap to dismiss, gone after 7 s) instead of opening chat, so no history is shown.
  - Open link goes through the shell, which sends you back to the lock screen.
  - Going Home returns to the lock screen, and a recording in progress is stopped and saved.
- **Background recording**: `ongoing` returns a red "● 0:12" chip (video icon, red). The timer runs on `api.everyBg` from the moment recording starts, and `api.stopBg()` is called when it stops. Leaving the app no longer stops the recording (except in secure mode). Opening Camera from the chip, or from Home while recording, keeps its state.
- **Back stack**: the thumbnail opens `photos {open, from: "camera"}` with `api.open`. Back from the viewer returns to Camera with its state intact through the shell stack.
- The record button stays red. No sparkle icons are used; the only Alpha mark is α.
