import {Capacitor} from '@capacitor/core';
import {registerPlugin} from '../platform-plugins';
import {browserHostedResults} from './hosted-results';
// Voice observes connection state, which imports the native background consumer.
// Claim the web implementation before evaluating that dependency tree.
if(!Capacitor.isNativePlatform())registerPlugin('AlphaHostedResults',{web:()=>browserHostedResults});
