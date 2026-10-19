import {CapacitorException,ExceptionCode} from '@capacitor/core';

/** Keep Browser recovery guidance intact; native implementation names are not user instructions. */
export function browserErrorMessage(error:unknown):string {
 if(error instanceof CapacitorException && error.code===ExceptionCode.Unimplemented)return 'This feature isn’t available in this version of Alpha.';
 return error instanceof Error ? error.message : 'Browser unavailable';
}
