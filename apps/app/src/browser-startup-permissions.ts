/** Browser consent adapters. Status reads never open a prompt or start capture. */
export function browserStartupPermissions(environment: {navigator: Navigator; Notification?: typeof Notification} = {navigator: globalThis.navigator, Notification: globalThis.Notification}) {
  const nav = environment.navigator;
  let microphoneGranted = false;
  return {
    notifications: {
      async status() {
        if (!environment.Notification) throw Error('Notifications are unavailable in this browser');
        const permission = environment.Notification.permission;
        return {granted: permission === 'granted', enabled: permission === 'granted', denied: permission === 'denied'};
      },
      async request() {
        if (!environment.Notification) throw Error('Notifications are unavailable in this browser');
        await environment.Notification.requestPermission();
      },
      async openSettings() { /* Browsers require users to open site settings themselves. */ },
    },
    microphone: {
      async status() {
        if (!nav?.mediaDevices?.getUserMedia) throw Error('Microphone access is unavailable in this browser');
        try {
          const permission = await nav.permissions.query({name: 'microphone' as PermissionName});
          return {granted: permission.state === 'granted', enabled: permission.state === 'granted', denied: permission.state === 'denied'};
        } catch { return {granted: microphoneGranted, enabled: microphoneGranted}; }
      },
      async request() {
        const stream = await nav.mediaDevices.getUserMedia({audio: true});
        try {
          microphoneGranted = stream.getAudioTracks().some(track => track.readyState === 'live');
          if (!microphoneGranted) throw Error('No live microphone track');
        } finally { for (const track of stream.getTracks()) track.stop(); }
      },
      async openSettings() { /* The checklist explains how to change browser site access. */ },
    },
  };
}
