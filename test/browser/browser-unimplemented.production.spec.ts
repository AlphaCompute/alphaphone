import {test,expect} from '@playwright/test';
import {flagOffAndroid,fenceNetwork,residentHome} from './flag-off-android';
// The existing Android fixture has no AlphaBrowser implementation. Capacitor's real proxy
// throws CapacitorException(Unimplemented); this is renderer evidence, not a device failure.
test('missing Browser implementation reports plain language without the internal plugin name',async({page})=>{
 await fenceNetwork(page);await flagOffAndroid(page);await residentHome(page);await page.getByRole('button',{name:'Browser',exact:true}).click();
 await expect(page.getByText('This feature isn’t available in this version of Alpha.',{exact:true})).toBeVisible();
 await expect(page.getByText('"AlphaBrowser" plugin is not implemented on android',{exact:true})).toHaveCount(0);
});
