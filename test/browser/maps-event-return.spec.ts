// Maps "Back to event": shown only when Maps was opened from a calendar event's location, returns to
// exactly that event, never replays the hand-off and fails closed when the event is gone.
// Also: the travel-mode buttons expose their selected state (aria-pressed).
//
// Evidence boundary: browser build, development profile, synthetic Maps provider. Source/test only.
import {test, expect, type Page} from '@playwright/test';
import {returnToApps} from './app-navigation';

test.setTimeout(120_000);
const address = '12 Market Street, Test Town';
const LOG = 'maps-event-return';
const button = (page: Page, name: string | RegExp) => page.getByRole('button', {name, exact: true});
const back = (page: Page) => page.getByRole('button', {name: 'Back to event', exact: true});
async function installMaps(page: Page) {
  await page.evaluate(async ({address, LOG}) => {
    const log = (kind: 'queries' | 'routes', value: unknown) => { const v = JSON.parse(localStorage.getItem(LOG) || '{"queries":[],"routes":[]}'); v[kind].push(value); localStorage.setItem(LOG, JSON.stringify(v)); };
    const {configureMapsProvider} = await import('/src/maps/runtime.ts');
    const places = ['East entrance', 'West entrance'].map((name, i) => ({providerId: 'return-fixture', id: String(i), name, coordinate: {latitude: [43.739, 43.74][i], longitude: 7.425}, attribution: 'Return fixture', fetchedAt: Date.now()}));
    configureMapsProvider(
      {status: 'configured', providerId: 'return-fixture', connectionId: 'conn_return_fixture_123456', revision: 'fixture1', capabilities: {map: false, search: true, placeDetails: true, modes: ['drive', 'walk'], traffic: 'none', transit: 'none', offline: {map: false, search: false, routing: false}}},
      {providerId: 'return-fixture', connectionId: 'conn_return_fixture_123456',
        search: async (query: string) => { log('queries', query); return query === address ? places : []; },
        detail: async (id: string) => places[Number(id)],
        route: async (from: any, to: any, mode: any) => { log('routes', mode); return {providerId: 'return-fixture', id: 'route-' + mode, from, to, mode, geometry: [from, to], distanceMeters: 400, durationSeconds: mode === 'walk' ? 540 : 300, steps: [{instruction: 'Continue', coordinate: to, distanceMeters: 400}], attribution: 'Return fixture', fetchedAt: Date.now(), traffic: 'none'}; },
      } as any);
  }, {address, LOG});
}
const requests = (page: Page) => page.evaluate(LOG => JSON.parse(localStorage.getItem(LOG) || '{"queries":[],"routes":[]}') as {queries: string[]; routes: string[]}, LOG);
const view = (page: Page) => page.locator('html');
async function systemBack(page: Page) {
  await button(page, 'Device controls').click();
  const controls = page.getByRole('dialog', {name: 'Development device controls', exact: true});
  await controls.getByRole('button', {name: 'Back', exact: true}).click();
  const close = controls.getByRole('button', {name: 'Close device controls', exact: true});
  if (await close.isVisible()) await close.click();
  await expect(controls).toBeHidden();
}
/** Two events that share one location text, so a return to the wrong one would be visible. */
async function setup(page: Page) {
  await page.addInitScript(() => { if (!localStorage.getItem('alpha.connection.selection.v1')) localStorage.setItem('alpha.connection.selection.v1', JSON.stringify({kind: 'offline'})); });
  await page.goto('/?mode=dev&tools=1');
  await installMaps(page);
  await button(page, 'Calendar').click();
  for (const title of ['Harbour meeting', 'Dock meeting']) {
    await button(page, 'New event').click();
    await page.getByRole('textbox', {name: 'Title', exact: true}).fill(title);
    await page.getByRole('textbox', {name: 'Location', exact: true}).fill(address);
    await button(page, 'Save event').click();
    await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
    await button(page, 'Back to calendar').click();
  }
}
async function handOff(page: Page, title: string) {
  await page.getByRole('button', {name: new RegExp(`^${title},`)}).click();
  await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
  await button(page, address).click();
  await expect(page.getByRole('textbox', {name: 'Search places', exact: true})).toHaveValue(address);
  await expect(page.getByRole('button', {name: /^West entrance/}).first()).toBeVisible();
}

test('Back to event returns to exactly the originating event from every Maps layer, once, without a new search', async ({page}) => {
  await setup(page);
  await handOff(page, 'Dock meeting');
  await expect(back(page)).toHaveCount(1);
  expect(await requests(page)).toEqual({queries: [address], routes: []});
  // Results -> place -> directions: the control stays available and the modes expose their state.
  await page.getByRole('button', {name: /^West entrance/}).first().click();
  await expect(back(page)).toHaveCount(1);
  await button(page, 'Directions').click();
  await expect(back(page)).toHaveCount(1);
  const pressed = async () => Object.fromEntries(await Promise.all(['Drive', 'Walk', 'Bike', 'Transit'].map(async mode => [mode, await button(page, mode).getAttribute('aria-pressed')])));
  expect(await pressed()).toEqual({Drive: 'true', Walk: 'false', Bike: 'false', Transit: 'false'});
  await button(page, 'Walk').click();
  await expect(button(page, 'Walk')).toHaveAttribute('aria-pressed', 'true');
  expect(await pressed()).toEqual({Drive: 'false', Walk: 'true', Bike: 'false', Transit: 'false'});
  // A refused mode is not shown as selected.
  await button(page, 'Transit').click();
  await expect(page.getByRole('region', {name: 'Maps'}).getByRole('status')).toHaveText('Transit schedules are not available for this region.');
  expect(await pressed()).toEqual({Drive: 'false', Walk: 'true', Bike: 'false', Transit: 'false'});

  await back(page).click();
  await expect(page.getByRole('heading', {name: 'Dock meeting', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Harbour meeting', exact: true})).toHaveCount(0);
  await expect(button(page, address)).toBeVisible();
  await expect(view(page)).toHaveAttribute('data-active-view', 'calendar');
  expect((await requests(page)).queries).toEqual([address]);
  // The return consumed the cross-app step: system Back now leaves Calendar, it does not reopen Maps.
  await button(page, 'Back to calendar').click();
  await systemBack(page);
  await expect(view(page)).toHaveAttribute('data-active-view', 'home');
  // Maps opened from the launcher has no event to return to and replays nothing.
  await button(page, 'Maps').click();
  await expect(page.getByRole('textbox', {name: 'Search places', exact: true})).toHaveValue('');
  await expect(back(page)).toHaveCount(0);
  expect((await requests(page)).queries).toEqual([address]);

  // The other event with the same location returns to itself.
  await returnToApps(page);
  await button(page, 'Calendar').click();
  await handOff(page, 'Harbour meeting');
  await back(page).click();
  await expect(page.getByRole('heading', {name: 'Harbour meeting', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Dock meeting', exact: true})).toHaveCount(0);
  expect((await requests(page)).queries).toEqual([address, address]);
});

test('a deleted or moved event fails closed: Maps stays open and the control is withdrawn', async ({page}) => {
  await setup(page);
  for (const change of ['moved', 'deleted'] as const) {
    await handOff(page, 'Harbour meeting');
    // Another window changes the event while Maps is open.
    await page.evaluate(async change => {
      const {calendarDocument} = await import('/src/browser/calendar-store.ts');
      await calendarDocument.edit(() => ({sourceRevision: '', events: []}) as any, (data: any) => {
        const row = data.events.find((event: any) => event.title === 'Harbour meeting');
        if (change === 'moved') { row.begin += 3_600_000; row.end += 3_600_000; row.revision = 'moved-elsewhere'; } else data.events = data.events.filter((event: any) => event !== row);
      });
    }, change);
    await back(page).click();
    await expect(page.getByText('That event was deleted or moved. Maps stays open; nothing else changed.', {exact: true})).toBeVisible();
    await expect(view(page)).toHaveAttribute('data-active-view', 'maps');
    await expect(back(page)).toHaveCount(0);
    await expect(page.getByRole('textbox', {name: 'Search places', exact: true})).toHaveValue(address);
    // The other event is never opened in its place.
    await expect(page.getByRole('heading', {name: 'Dock meeting', exact: true})).toHaveCount(0);
    if (change === 'moved') { await returnToApps(page); await button(page, 'Calendar').click(); }
  }
  const titles = await page.evaluate(async () => JSON.parse((await (await import('/src/browser/calendar-store.ts')).calendarDocument.readRaw())!).events.map((event: any) => event.title));
  expect(titles).toEqual(['Dock meeting']);
});

test('double activation returns once; a reload in Maps drops the return and replays nothing', async ({page}) => {
  await setup(page);
  await handOff(page, 'Harbour meeting');
  await back(page).evaluate((el: HTMLElement) => { el.click(); el.click(); });
  await expect(page.getByRole('heading', {name: 'Harbour meeting', exact: true})).toBeVisible();
  await button(page, 'Back to calendar').click();
  await systemBack(page);
  await expect(view(page)).toHaveAttribute('data-active-view', 'home');

  await button(page, 'Calendar').click();
  await handOff(page, 'Harbour meeting');
  expect((await requests(page)).queries).toEqual([address, address]);
  await page.reload();
  await installMaps(page);
  await button(page, 'Maps').click();
  await expect(page.getByRole('textbox', {name: 'Search places', exact: true})).toHaveValue('');
  await expect(back(page)).toHaveCount(0);
  expect((await requests(page)).queries).toEqual([address, address]);
  // Leaving through Home also drops it: Maps reopened later has no control.
  await returnToApps(page);
  await button(page, 'Calendar').click();
  await handOff(page, 'Dock meeting');
  await returnToApps(page);
  await button(page, 'Maps').click();
  await expect(back(page)).toHaveCount(0);
  expect((await requests(page)).queries).toEqual([address, address, address]);
});
