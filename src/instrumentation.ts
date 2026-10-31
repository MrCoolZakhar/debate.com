// Runs once when a Next.js server starts. Today it only starts the dev-only
// memory restart (src/lib/devMemoryRestart.ts); production and `next build`
// do nothing here.
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NODE_ENV === 'development' &&
    process.env.__NEXT_DEV_SERVER === '1'
  ) {
    const { startDevMemoryRestart } = await import('./lib/devMemoryRestart');
    startDevMemoryRestart();
  }
}
