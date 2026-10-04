import { test, expect } from '@playwright/test';

test('shared map renderer loads its real worker and draws host-styled route geometry', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Explicit synthetic tile transport; this does not qualify a real map provider.
  await page.route('https://maps-fixture.invalid/**', route => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto('/?mode=dev');
  await page.evaluate(async () => {
    const { MapPlane } = await import('/src/maps/map-plane.ts');
    const container = document.createElement('div');
    container.id = 'shared-map-test';
    container.style.cssText = 'position:fixed;inset:0;width:412px;height:915px;z-index:9999';
    document.body.append(container);
    const plane = new MapPlane(container, { base: 'https://maps-fixture.invalid', region: 'fixture', bounds: [7.40,43.72,7.45,43.76], attribution: 'Synthetic test' }, () => { container.dataset.failed = 'true'; }, { land:'#ffffff',water:'#ddddff',park:'#ddffdd',rwy:'#eeeeee',fwyE:'#cccccc',major:'#bbbbbb',label:'#111111' });
    const from = { latitude:43.738,longitude:7.424 }, to = { latitude:43.741,longitude:7.425 };
    plane.update(to, { providerId:'fixture',id:'fixture-route',from,to,mode:'walk',geometry:[from,to],distanceMeters:300,durationSeconds:200,steps:[],attribution:'Synthetic test',fetchedAt:Date.now(),traffic:'none' });
    (window as any).sharedPlane = plane;
  });
  const container = page.locator('#shared-map-test');
  await expect(container).toHaveAttribute('data-map-ready','true');
  await expect(container.locator('canvas')).toBeVisible();
  await expect(container.locator('.maplibregl-marker')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).sharedPlane.map.getPaintProperty('route-line','line-color'))).toBe('#1616d8');
  await expect(container).not.toHaveAttribute('data-failed','true');
  await page.evaluate(() => (window as any).sharedPlane.destroy());
  await expect(container.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});
