import path from 'node:path';
import {stageNativePlugin} from './upstream-native-source.mjs';
stageNativePlugin(path.resolve(import.meta.dirname,'..'),'calendar');
