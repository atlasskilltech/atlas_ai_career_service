const { fetchLinkedInJobs } = require('./linkedinFetcher');
const { fetchNaukriJobs } = require('./naukriFetcher');
const jobAggregatorRepository = require('../repositories/jobAggregatorRepository');

/**
 * Job Scheduler - Automatically fetches jobs from LinkedIn & Naukri.
 *
 * Runs every 5 minutes, alternating between sources:
 *   Odd cycles:  LinkedIn
 *   Even cycles:  Naukri
 */

class JobScheduler {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.cycleIndex = 0;
    this.lastRun = null;
    this.lastResult = null;
    this.intervalMs = 5 * 60 * 1000; // 5 minutes
    this.totalImported = { added: 0, updated: 0, errors: 0 };
    this.runCount = 0;
  }

  /**
   * Start the auto-scheduler. Called once from app.js on startup.
   */
  start() {
    if (this.timer) return;
    console.log('[JobScheduler] Starting auto-fetch every 5 minutes (LinkedIn + Naukri)...');

    // Run first fetch after 30 seconds (let the app boot)
    setTimeout(() => this.runCycle(), 30000);

    // Then every 5 minutes
    this.timer = setInterval(() => this.runCycle(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[JobScheduler] Stopped.');
    }
  }

  async runCycle() {
    if (this.isRunning) {
      console.log('[JobScheduler] Previous cycle still running, skipping...');
      return;
    }

    this.isRunning = true;
    this.cycleIndex++;
    const isLinkedIn = this.cycleIndex % 2 === 1; // odd = LinkedIn, even = Naukri
    const source = isLinkedIn ? 'linkedin' : 'naukri';
    const startTime = Date.now();

    console.log(`[JobScheduler] ── Cycle #${this.cycleIndex} (${source}) starting ──`);

    try {
      let allJobs = [];

      try {
        allJobs = isLinkedIn ? await fetchLinkedInJobs() : await fetchNaukriJobs();
      } catch (err) {
        console.error(`[JobScheduler] ${source} failed:`, err.message);
      }

      // Import all collected jobs
      let added = 0;
      let updated = 0;
      let errors = 0;

      if (allJobs.length > 0) {
        const logId = await jobAggregatorRepository.createScraperLog(source);

        for (const job of allJobs) {
          try {
            const result = await jobAggregatorRepository.upsertByExternal(job);
            if (result.updated) updated++;
            else added++;
          } catch (err) {
            errors++;
          }
        }

        await jobAggregatorRepository.updateScraperLog(logId, {
          status: 'completed',
          jobsFound: allJobs.length,
          jobsAdded: added,
          jobsUpdated: updated,
          errorMessage: errors > 0 ? `${errors} jobs failed to import` : null,
        });
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.lastRun = new Date();
      this.lastResult = { sources: [source], found: allJobs.length, added, updated, errors, elapsed: `${elapsed}s` };
      this.totalImported.added += added;
      this.totalImported.updated += updated;
      this.totalImported.errors += errors;
      this.runCount++;

      console.log(`[JobScheduler] ── Cycle #${this.cycleIndex} complete: ${allJobs.length} found, ${added} added, ${updated} updated, ${errors} errors (${elapsed}s) ──`);
    } catch (err) {
      console.error('[JobScheduler] Cycle error:', err.message);
      this.lastResult = { error: err.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current scheduler status (for admin dashboard / API).
   */
  getStatus() {
    return {
      running: !!this.timer,
      currentlyFetching: this.isRunning,
      intervalMinutes: 5,
      cycleIndex: this.cycleIndex,
      runCount: this.runCount,
      lastRun: this.lastRun,
      lastResult: this.lastResult,
      totalImported: this.totalImported,
      nextSources: this.getNextSources(),
    };
  }

  getNextSources() {
    const next = (this.cycleIndex + 1) % 2;
    return next === 1 ? ['LinkedIn'] : ['Naukri'];
  }
}

// Singleton
const scheduler = new JobScheduler();
module.exports = scheduler;
