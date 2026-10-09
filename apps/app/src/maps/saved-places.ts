import { SavedPlaces as SharedSavedPlaces } from '../../../../.eliza/patched/plugins/plugin-maps/src/client/saved-places.ts';
export type { SavedPlace } from '../../../../.eliza/patched/plugins/plugin-maps/src/client/saved-places.ts';
/** Preserve the installed Alpha Phone data namespace. */
export class SavedPlaces extends SharedSavedPlaces {
 constructor(storage?: Pick<Storage, 'getItem' | 'setItem'>) { super('alpha.maps.saved-places.v1', storage); }
}
