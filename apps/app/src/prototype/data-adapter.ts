type Bag = Record<string, any>;
const installed = new WeakSet<object>();

/** Production-only absence of provider data. Never install in visual fixtures.
 * Install after effect adapters, before mounting. Does not create user records,
 * clear native app data, or pretend disconnected sources are synchronized. */
export function installPrototypeDataAdapter(Component: any, views: Record<string, Bag>) {
  if (installed.has(views)) return;
  installed.add(views);
  const empty: Record<string, Bag> = {
    photos: { list: [], trash: [], albums: [], open: null, album: null, edit: null, sheet: null, filter: null, seq: null, sel: null },
    files: { files: [], folder: null, open: null, asked: {}, asking: null, sel: null, sheet: null },
    phone: { recents: [], vms: [], vmOpen: null, playing: null, call: null, callWho: null, incoming: null, ring: null },
    messages: { threads: {}, unread: {}, extra: [], botI: {}, thread: null, compose: null, typing: null },
    inbox: { mails: [], sent: [], acct: 'all', open: null, compose: null },
    workflows: { flows: [], open: null, run: null, build: null, create: false, running: null },
    wallet: { cards: [], open: null, pay: false, card: null, paid: null, add: null, transit: 0, trips: [], calAdded: {}, pays: 0 },
    settings: { accounts: [], conns: {}, acct: null, adding: false, addStep: null, addProv: null, addEmail: '', addPw: '', addServer: '', addLvl: null },
  };
  for (const [name, state] of Object.entries(empty)) {
    if (views[name]) views[name].state = { ...views[name].state, ...state };
  }
  const wrap = (name: string, patch: (out: Bag, state: Bag, api: Bag) => Bag) => {
    if (!views[name]?.render) return;
    const render = views[name].render;
    views[name].render = (state: Bag, api: Bag) => patch(render(state, ['phone', 'messages', 'inbox'].includes(name) ? { ...api, people: [] } : api), state, api);
  };
  // Native captures are owned by camera-adapter's closure and SAF previews by
  // selection-adapter. Keep their final render output; clear only model fixtures.
  wrap('photos', out => ({
    ...out,
    empty: !out.libraryLoading && !out.libraryError && !(out.groups || []).some((group: Bag) => (group.items || []).length > 0),
  }));
  wrap('files', out => ({
    ...out,
    locs: (out.locs || []).map((location: Bag) => ({
      ...location, sub: location.nativeTree ? location.sub : location.name === 'Photos' ? 'Choose a photo' : 'Choose a document',
    })),
    storageW: '0%', storageText: 'Storage usage unavailable',
  }));
  wrap('phone', out => ({ ...out, favs: [], hasFavs: false }));
  wrap('messages', out => ({ ...out, ...(out.empty ? { emptyText: 'Messages are not connected' } : {}) }));
  wrap('inbox', out => ({ ...out, emptyText: 'Inbox is not connected' }));
  wrap('wallet', (out, _state, api) => ({
    ...out, passes: [], ps: null, isPass: false,
    startAdd: () => api.toast('Wallet is not connected. No card details are collected.'),
    startPay: () => api.toast('Wallet is not connected. Nothing has been charged.'),
  }));
  const p = Component.prototype;
  const renderVals = p.renderVals;
  p.renderVals = function () {
    const out = renderVals.call(this);
    // Offer only connected operations. Reference suggestions name fictional
    // people and imply image analysis/mail/workflows that are not available yet.
    const view = this.S().view;
    const first = view === 'camera' ? 'Open Photos' : view === 'photos' ? 'Open Camera'
      : view === 'files' || view === 'browser' || view === 'inbox' ? 'Open Notes'
      : view === 'phone' || view === 'messages' ? 'Open Contacts' : 'Open Calendar';
    const suggestions = ['Create a note', 'Set a reminder', first];
    const now = Date.now();
    const agenda = (this.vget('calendar').events || [])
      .filter((event: Bag) => event.reminderStatus !== 'completed')
      .map((event: Bag) => {
        const instant=(value:number)=>{const date=new Date(value);return event.nativeEvent?.allDay?new Date(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()).getTime():Number(value);};
        return {event,begin:instant(event.nativeEvent?.begin??event.reminderAt),end:instant(event.nativeEvent?.end??event.reminderAt)};
      })
      .filter((item: Bag) => Number.isFinite(item.begin) && Number.isFinite(item.end) && (item.event.nativeEvent?.allDay?item.end>now:item.end>=now))
      .sort((a: Bag, b: Bag) => a.begin - b.begin)[0];
    const day = agenda ? new Date(agenda.begin) : null;
    const time = day ? (agenda.begin <= now ? (agenda.event.nativeEvent?.allDay?'All day':'Now') : day.toDateString() === new Date(now).toDateString()
      ? day.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : day.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })) : 'Calendar';
    return {
      ...out, shadeN: [], lockSum: [], showHeads: false,
      sugg: suggestions.map(label => ({ label, go: () => this.send(label) })),
      homeCalendarLabel: agenda ? `Open calendar event: ${agenda.event.title}` : 'Open your calendar',
      homeCalendarTime: time, homeCalendarTitle: agenda?.event.title || 'Your calendar',
      homeAttentionLabel: 'Accounts are not connected', homeAttentionCount: '—',
      homeWorkflowLabel: 'Open workflows', homeWorkflowTitle: 'Workflows', homeWorkflowTime: 'Review', homePeopleVisibility: 'hidden',
      goCalendar: () => this.openView('calendar', agenda ? {open:agenda.event.id, day:agenda.event.off, openDay:agenda.event.off} : undefined),
      goFlows: () => this.openView('workflows'),
      goTriage: () => this.toast('Connect your accounts to review what needs your attention.'),
      clearAll: () => this.setState({ shade: false }),
    };
  };
  // Prevent the fixture's delayed incoming-message banner from being scheduled
  // by unlock or its demo trigger in a production runtime.
  p.showHeads = function () {};
}

/** Call in both fixture and production before mounting; preserves original
 * fixture text byte-for-byte. Production data adapter overrides these values. */
export function installPrototypeHomeBindings(Component: any) {
  const p = Component.prototype;
  const render = p.renderVals;
  p.renderVals = function () {
    const out = render.call(this);
    return {
      homeCalendarLabel: 'Next: Design review at 3:00 PM', homeCalendarTime: '3:00 PM', homeCalendarTitle: 'Design review',
      homeAttentionLabel: '3 things need you', homeAttentionCount: '3',
      homeWorkflowLabel: 'Morning brief delivered at 7:02 AM', homeWorkflowTitle: 'Morning brief', homeWorkflowTime: '7:02 AM', homePeopleVisibility: 'visible',
      ...out,
      // Keep translated/collapsed layers painted for the reference animations,
      // but prevent their controls receiving focus or accessibility navigation.
      homeHidden: !!(out.isView || out.shadeY === '0' || out.panelPE === 'auto' || out.voiceOn),
      appHidden: !!(out.shadeY === '0' || out.panelPE === 'auto' || out.voiceOn),
      conversationHidden: out.panelPE !== 'auto' || out.shadeY === '0' || !!out.voiceOn,
      shadeHidden: out.shadeY !== '0' || !!out.voiceOn,
      dockHidden: out.shadeY === '0' || !!out.voiceOn,
      ...(out.files ? { files: { storageText: '218 GB free', ...out.files } } : {}),
    };
  };
}
