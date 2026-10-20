import test from 'node:test';
import assert from 'node:assert/strict';
import {cuttlefishOptions} from '../scripts/aosp-cuttlefish.mjs';

test('explicit Cuttlefish target requires source and cannot consume Pixel factory authority', () => {
  assert.equal(cuttlefishOptions({target:'cuttlefish', source:'/reviewed/aosp'}), true);
  assert.throws(() => cuttlefishOptions({target:'cuttlefish'}), /aosp-source/);
  assert.throws(() => cuttlefishOptions({target:'cuttlefish', source:'/reviewed/aosp', factory:'/pixel.zip'}), /pixel10a/);
  assert.equal(cuttlefishOptions({target:'pixel10a', source:'/reviewed/aosp', factory:'/pixel.zip'}), false);
  assert.equal(cuttlefishOptions({}), false);
});
