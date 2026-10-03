import {isMvpView} from './mvp-features';

/** Shared Home/digest fixture; deferred sources remain excluded in both places. */
export function mockAttentionRows() {
  return [
    {ini: 'MC', who: 'Maya Chen', text: 'Still on for 3? I can bring the prototype.', icon: 'bubble', go: {view: 'messages', patch: {thread: 'maya'}}},
    {ini: 'JP', who: 'Jordan Park', text: 'Revised term sheet attached.', icon: 'mail', go: {view: 'inbox', patch: {open: 2}}},
    {ini: 'PN', who: 'Priya Nair', text: 'Sent you the photos from Saturday', icon: 'bubble', go: {view: 'messages', patch: {thread: 'priya'}}},
  ].filter(row => isMvpView(row.go.view));
}
