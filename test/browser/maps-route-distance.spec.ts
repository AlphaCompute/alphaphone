import { test, expect } from '@playwright/test';
test('route distances cover segment interiors, endpoints, repeated points and the date line', async ({page}) => {
 await page.goto('/?mode=dev');
 const actual = await page.evaluate(async () => {
  const {distanceToRoute:d}=await import('/src/maps/route-distance.ts');
  const p=(latitude:number,longitude:number)=>({latitude,longitude});
  return [d(p(0,1),[p(0,0),p(0,2)]), d(p(1,1),[p(0,0),p(0,2)]),
   d(p(0,3),[p(0,0),p(0,2)]), d(p(0,-1),[p(0,0),p(0,2)]),
   d(p(0,1),[p(0,0),p(0,0),p(0,2)]), d(p(0,180),[p(0,179),p(0,-179)]),
   d(p(0,0),[p(0,0)]), d(p(0,0),[])];
 });
 expect(actual[0]).toBeLessThan(.001);
 for(const i of [1,2,3]) expect(actual[i]).toBeCloseTo(111194.9266, 2);
 for(const i of [4,5,6]) expect(actual[i]).toBeLessThan(.001);
 expect(actual[7]).toBe(Infinity);
});
