import type { ComponentType } from 'react';
export const Component: ComponentType<any>;
export const VIEWS: Record<string, any>;
export const ORDER: string[];
/** Attention rows from fixtures.js (empty when fixtures are swapped out), MVP views only. */
export function mockAttentionRows(): Array<{ ini: string; who: string; text: string; icon: string; go: { view: string; patch?: Record<string, unknown> } }>;
/** Reference Home card values from fixtures.js; null when fixtures are swapped out. */
export const HOME_DEFAULTS: Record<string, string> | null;
