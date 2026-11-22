/** Minimal types for the local S3 server used in tests. */
declare module 's3rver' {
  export default class S3rver {
    constructor(opts: { port?: number; address?: string; silent?: boolean; directory: string; configureBuckets?: { name: string; configs: unknown[] }[] })
    run(): Promise<{ address: string; port: number }>
    close(): Promise<void>
  }
}
