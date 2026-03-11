const { fetchLinkedInJobs } = require('./linkedinFetcher');
const { fetchNaukriJobs } = require('./naukriFetcher');
const { fetchRemotiveJobs, fetchArbeitnowJobs, fetchAdzunaJobs, fetchJSearchJobs } = require('./apiFetcher');
const jobAggregatorRepository = require('../repositories/jobAggregatorRepository');

/**
 * Job Scheduler - Automatically fetches jobs from all sources.
 *
 * Runs every 5 minutes with rotating sources:
 *   Cycle 1: Free APIs (Remotive + Arbeitnow)          — always works
 *   Cycle 2: LinkedIn scraper                           — needs Puppeteer
 *   Cycle 3: Free APIs (Remotive + Arbeitnow)           — always works
 *   Cycle 4: Naukri scraper                              — needs Puppeteer
 *   Cycle 5: Paid APIs (Adzuna + JSearch) if configured  — needs API keys
 *
 * This rotation avoids hammering any single source and spreads load.
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
    console.log('[JobScheduler] Starting auto-fetch every 5 minutes...');

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
    const cycleNum = this.cycleIndex % 5;
    const startTime = Date.now();

    console.log(`[JobScheduler] ── Cycle #${this.cycleIndex} (type ${cycleNum}) starting ──`);

    try {
      let allJobs = [];
      let sources = [];

      switch (cycleNum) {
        case 1: // Free APIs
        case 3:
          sources = ['remotive', 'arbeitnow'];
          const [remotiveJobs, arbeitnowJobs] = await Promise.allSettled([
            fetchRemotiveJobs(),
            fetchArbeitnowJobs(),
          ]);
          if (remotiveJobs.status === 'fulfilled') allJobs.push(...remotiveJobs.value);
          if (arbeitnowJobs.status === 'fulfilled') allJobs.push(...arbeitnowJobs.value);
          break;

        case 2: // LinkedIn
          sources = ['linkedin'];
          try {
            const linkedinJobs = await fetchLinkedInJobs();
            allJobs.push(...linkedinJobs);
          } catch (err) {
            console.error('[JobScheduler] LinkedIn failed:', err.message);
          }
          break;

        case 4: // Naukri
          sources = ['naukri'];
          try {
            const naukriJobs = await fetchNaukriJobs();
            allJobs.push(...naukriJobs);
          } catch (err) {
            console.error('[JobScheduler] Naukri failed:', err.message);
          }
          break;

        case 0: // Paid APIs (if configured)
          sources = ['adzuna', 'jsearch'];
          const [adzunaJobs, jsearchJobs] = await Promise.allSettled([
            fetchAdzunaJobs(),
            fetchJSearchJobs(),
          ]);
          if (adzunaJobs.status === 'fulfilled') allJobs.push(...adzunaJobs.value);
          if (jsearchJobs.status === 'fulfilled') allJobs.push(...jsearchJobs.value);

          // If no paid APIs configured, fall back to free APIs
          if (allJobs.length === 0) {
            sources = ['remotive', 'arbeitnow'];
            const [rJobs, aJobs] = await Promise.allSettled([fetchRemotiveJobs(), fetchArbeitnowJobs()]);
            if (rJobs.status === 'fulfilled') allJobs.push(...rJobs.value);
            if (aJobs.status === 'fulfilled') allJobs.push(...aJobs.value);
          }
          break;
      }

      // Import all collected jobs
      let added = 0;
      let updated = 0;
      let errors = 0;

      if (allJobs.length > 0) {
        // Create scraper log
        const sourceLabel = sources.join('+');
        const logId = await jobAggregatorRepository.createScraperLog(sourceLabel);

        for (const job of allJobs) {
          try {
            const result = await jobAggregatorRepository.upsertByExternal(job);
            if (result.updated) updated++;
            else added++;
          } catch (err) {
            errors++;
            // Duplicate key or other DB error - skip silently
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
      this.lastResult = { sources, found: allJobs.length, added, updated, errors, elapsed: `${elapsed}s` };
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
    const next = (this.cycleIndex + 1) % 5;
    switch (next) {
      case 1: case 3: return ['Remotive', 'Arbeitnow'];
      case 2: return ['LinkedIn'];
      case 4: return ['Naukri'];
      case 0: return ['Adzuna', 'JSearch'];
      default: return ['Free APIs'];
    }
  }
}

// Singleton
const scheduler = new JobScheduler();
module.exports = scheduler;
