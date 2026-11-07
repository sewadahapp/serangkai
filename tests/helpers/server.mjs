/**
 * Integration tests run the built server with Bun by default, because Bun is
 * the primary runtime. Set SERANGKAI_TEST_RUNTIME=node to exercise the Node
 * fallback against the same build.
 */
export const serverRuntime = process.env.SERANGKAI_TEST_RUNTIME === 'node' ? 'node' : 'bun'
