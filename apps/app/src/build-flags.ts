// Build-time switch for mock, fixture and developer surfaces. Off unless ELIZA_DEV_ALLOW_TEST_MOCKS=1.
export const testMocksEnabled: boolean = import.meta.env.VITE_ELIZA_DEV_ALLOW_TEST_MOCKS === '1';
export const devSurfacesEnabled: boolean = import.meta.env.DEV && testMocksEnabled;

// Explicit production deployment policy; independent of all developer/mock switches.
export const cloudRuntimeEnabled: boolean = import.meta.env.VITE_ELIZA_RUNTIME_PROFILE === 'cloud';
