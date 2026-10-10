import { test, expect } from '@playwright/test';
// Development lane. The development profile's inbox reports through the same attention summary a
// mail provider adapter uses, which exercises the connected Home state; the calendar failure is a
// real browser-calendar read failure. home-attention.production.spec.ts covers the flag-off build.

test('Home does not infer unread counts from a development summary before Inbox is loaded', async ({ page }) => {
  await page.goto('/?mode=dev');
  const home=page.getByRole('region',{name:'Home',exact:true});
  await expect(home.getByRole('button',{name:/^Open Inbox: \d+ unread emails?$/})).toHaveCount(0);
  await home.getByRole('button',{name:'Inbox',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-active-view','inbox');
});

test('a failed calendar read shows the retry state instead of neutral copy, then recovers', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('[data-alpha-layer="home"] .scr > button').first();
  await expect(card).toContainText('No upcoming events');
  await page.evaluate(async () => {
    const { BrowserCalendar } = await import('/src/browser/calendar.ts');
    const proto = BrowserCalendar.prototype as any;
    (window as any).__calendarList = proto.list;
    proto.list = () => Promise.reject(Error('Calendar storage unavailable'));
    window.dispatchEvent(new Event('alpha:calendar-preferences'));
  });
  await expect(card).toHaveAttribute('aria-label', 'Open your calendar');
  await expect(card).toContainText('Calendar unavailable');
  await expect(card).not.toContainText(/from this browser/);
  await page.evaluate(async () => {
    const { BrowserCalendar } = await import('/src/browser/calendar.ts');
    (BrowserCalendar.prototype as any).list = (window as any).__calendarList;
    window.dispatchEvent(new Event('alpha:calendar-preferences'));
  });
  await expect(card).toContainText('No upcoming events');
});
