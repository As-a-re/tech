/** Runs once when the app server starts: begins the background jobs (scheduled posts, event reminders). */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.JOBS !== '0') {
    const { startJobs } = await import('./server/jobs')
    startJobs()
  }
}
