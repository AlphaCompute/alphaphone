/** Approved development proposals target the phone MVP, including explicit UI aliases.
 * Browser simulator navigation has its own intentional development profile.
 * MVP-DEFERRED: Phone/SMS/Contacts/Wallet; restore only after approved scope and
 * native permission, recipient, denied-role and return-to-HOME acceptance.
 * Assistant/apps/passwords have no approved execution route; use Settings for password providers. */
export const DEVELOPMENT_PROPOSAL_VIEWS = [
  'home', 'maps', 'camera', 'photos', 'notes', 'calendar', 'notifications',
  'reminders', 'workflows', 'files', 'inbox', 'browser', 'settings',
] as const;
