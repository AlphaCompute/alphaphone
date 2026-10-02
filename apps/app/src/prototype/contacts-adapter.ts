import { isMvpView } from "./mvp-features";
import { registerPlugin } from '../platform-plugins';
import { Capacitor } from '@capacitor/core';
import { DailyApps } from '../daily';

type Bag = Record<string, any>;
type Contact = { id: string; lookupKey: string; displayName: string; phoneNumbers: string[]; emailAddresses: string[]; starred: boolean };
const contacts = registerPlugin<{
  checkPermissions(): Promise<{ contacts: string }>;
  requestPermissions(): Promise<{ contacts: string }>;
  listContacts(): Promise<{ contacts: Contact[] }>;
  createContact(options: { displayName: string; phoneNumber?: string; emailAddress?: string }): Promise<{ id: string }>;
}>('ElizaContacts');

/** Install after native action guards. No contact content is persisted by the
 * renderer or included in agent context; Android ContactsProvider owns records. */
export function installPrototypeContactsAdapter(Component: any, views: Record<string, Bag>) {
  if (!isMvpView("contacts")) return; // Also guard direct installers and future entrypoints.
  const definition = views.contacts;
  if (!definition) return;
  definition.state = { ...definition.state, list: [], open: null, add: null, edit: null, form: null };
  definition.reply = () => null; // Never allow the prototype's canned directory mutations.
  let api: Bag | undefined, list: Bag[] = [], raw: Contact[] = [];
  let phase: 'idle' | 'loading' | 'ready' | 'denied' | 'error' = 'idle';
  let generation = 0, saving = false, uncertain = false;
  let status = 'Open Contacts to allow access';
  const originalRender = definition.render, originalLeave = definition.onLeave;
  const oldApi = Component.prototype.api;
  Component.prototype.api = function (key: string) {
    const result = oldApi.call(this, key);
    return { ...result, people: list, person: (id: string) => list.find(p => p.id === id) || { id, name: 'Unknown contact', first: 'Unknown', last: '', ini: '?', phone: '', email: '', note: '' } };
  };
  const publish = () => api?.setView('contacts', { list: list.slice(), nativeContactsStatus: status });
  const map = (c: Contact) => {
    const name = c.displayName || c.phoneNumbers[0] || 'Unnamed contact';
    const names = name.trim().split(/\s+/);
    return { id: c.id, name, first: names[0] || name, last: names.slice(1).join(' '), ini: names.slice(0, 2).map(n => n[0] || '').join('').toUpperCase(), phone: c.phoneNumbers[0] || '', email: c.emailAddresses[0] || '', fav: c.starred, address: '', birthday: '', note: '' };
  };
  async function load(prompt: boolean) {
    if (!api || phase === 'loading' || saving) return;
    const token = ++generation; phase = 'loading'; status = 'Loading Android contacts…'; list = []; raw = []; publish();
    try {
      if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('ElizaContacts')) throw new Error('unavailable');
      let permission = await contacts.checkPermissions();
      if (token !== generation) return;
      if (permission.contacts !== 'granted' && prompt) permission = await contacts.requestPermissions();
      if (token !== generation) return;
      if (permission.contacts !== 'granted') { phase = 'denied'; status = 'Contacts access denied. Tap to retry'; publish(); return; }
      const result = await contacts.listContacts();
      if (token !== generation) return;
      raw = result.contacts; list = raw.map(map); phase = 'ready'; status = list.length ? '' : 'No contacts. Add a contact'; publish();
    } catch { if (token === generation) { phase = 'error'; status = 'Contacts unavailable. Tap to retry'; publish(); } }
  }
  function newContact() {
    if (!api) return;
    if (phase !== 'ready') { void load(true); return; }
    uncertain = false;
    api.set({ add: true, edit: null, form: { first: '', last: '', phone: '', email: '', address: '', birthday: '', note: '' } });
  }
  async function save() {
    if (!api || saving) return;
    const owner = api, st = owner.get('contacts');
    if (st.edit) { await handoff(); return; }
    if (!st.add || uncertain) { if (uncertain) owner.toast('The prior save may have completed. Reopen Contacts to check before creating another.'); return; }
    const f = { ...(st.form || {}) };
    if (['address', 'birthday', 'note'].some(k => String(f[k] || '').trim())) { owner.toast('Address, birthday and notes require the Android Contacts app. These fields have not been saved.'); return; }
    const displayName = [String(f.first || '').trim(), String(f.last || '').trim()].filter(Boolean).join(' ');
    const phoneNumber = String(f.phone || '').trim(), emailAddress = String(f.email || '').trim();
    if (!displayName) { owner.toast('Enter a contact name.'); return; }
    if (displayName.length > 300 || phoneNumber.length > 80 || emailAddress.length > 320 || (emailAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress))) { owner.toast('Check the name, phone number and email address.'); return; }
    saving = true;
    let dispatched = false;
    try {
      const permission = await contacts.checkPermissions();
      if (permission.contacts !== 'granted') { owner.toast('Allow Contacts access before saving.'); return; }
      dispatched = true;
      const result = await contacts.createContact({ displayName, phoneNumber, emailAddress });
      uncertain = true; // Never repeat a successful write if readback fails.
      const readback = await contacts.listContacts();
      const saved = readback.contacts.find(c => c.id === result.id);
      if (!saved || saved.displayName !== displayName || (phoneNumber && !saved.phoneNumbers.includes(phoneNumber)) || (emailAddress && !saved.emailAddresses.includes(emailAddress))) throw new Error('readback');
      raw = readback.contacts; list = raw.map(map); phase = 'ready'; status = ''; publish(); uncertain = false;
      // A completed write does not force navigation if the user left the form.
      if (owner.isActive() && owner.get('contacts').add) owner.set({ add: null, form: null, open: result.id });
      owner.toast('Contact saved in Android Contacts.');
    } catch { uncertain = dispatched; owner.toast(dispatched ? 'Save could not be verified. Check Android Contacts before trying again.' : 'Contacts access unavailable. Nothing was submitted.'); }
    finally { saving = false; }
  }
  async function handoff() {
    try { const r = await DailyApps.perform({ action: 'contacts' }); api?.toast(r.message || 'Open Android Contacts to edit this contact.'); }
    catch { api?.toast('Android Contacts is unavailable.'); }
  }
  definition.render = (st: Bag, current: Bag) => {
    api = current;
    if (phase === 'idle' && current.isActive()) queueMicrotask(() => { void load(true); });
    const data = originalRender({ ...st, list }, current);
    data.addNew = newContact; data.save = () => { void save(); };
    data.cancelEdit = () => { if (saving) { current.toast('Saving contact…'); return; } uncertain = false; current.set({ add: null, edit: null, form: null }); };
    if (phase !== 'ready' || !list.length) {
      data.noHits = false; data.hasFavs = false; data.favs = [];
      data.groups = [{ letter: 'Contacts', rows: [{ ini: '', name: status, open: () => phase === 'ready' ? newContact() : void load(true) }] }];
    }
    if (data.d) {
      data.d.ctx = ''; data.d.hasCtx = false;
      data.d.edit = () => { void handoff(); }; data.d.del = () => { void handoff(); }; data.d.toggleFav = () => { void handoff(); };
      const record = raw.find(c => c.id === st.open);
      data.d.acts = (data.d.acts || []).map((action: Bag) => ({ ...action, go: async () => {
        if (!record) return;
        const options = action.label.startsWith('Call ') ? { action: 'phone' as const, query: record.phoneNumbers[0] || '' } : action.label.startsWith('Message ') ? { action: 'messages' as const, query: record.phoneNumbers[0] || '' } : { action: 'email' as const, query: record.emailAddresses[0] || '' };
        try { const result = await DailyApps.perform(options); current.toast(result.message || 'Review and complete in the Android app.'); } catch { current.toast('Native app unavailable.'); }
      } }));
    }
    if (saving) { data.cantSave = true; data.canSave = false; }
    return data;
  };
  definition.onLeave = (current: Bag) => { ++generation; if (!saving) phase = 'idle'; originalLeave?.(current); };
  // Refresh on reentry, including after editing in the native Contacts app.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && api?.isActive()) void load(false); });
}
