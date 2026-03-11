const { fetch } = require('./httpClient');

/**
 * External API Job Fetchers - Fetches from free/freemium job APIs.
 *
 * Supported APIs:
 *  1. Adzuna API (free tier: 250 req/day)
 *  2. JSearch via RapidAPI (free tier: 200 req/month)
 *  3. Remotive API (completely free, no key needed)
 *  4. Arbeitnow API (completely free, no key needed)
 *
 * Configure API keys in .env:
 *   ADZUNA_APP_ID=xxx
 *   ADZUNA_APP_KEY=xxx
 *   RAPIDAPI_KEY=xxx
 */

// ─── Remotive.com (Free, no auth) ─────────────────────────────

async function fetchRemotiveJobs() {
  const jobs = [];
  try {
    const categories = ['software-dev', 'data', 'design', 'devops', 'product', 'qa'];
    const category = categories[Math.floor(Math.random() * categories.length)];

    const res = await fetch(`https://remotive.com/api/remote-jobs?category=${category}&limit=25`, { timeout: 15000 });
    if (res.status !== 200 || !res.data || !res.data.jobs) {
      console.log('[Remotive] No data returned');
      return jobs;
    }

    for (const job of res.data.jobs) {
      jobs.push({
        externalId: `remotive-${job.id}`,
        title: job.title,
        company: job.company_name,
        location: job.candidate_required_location || 'Remote',
        description: stripHtml(job.description || '').substring(0, 3000),
        skills: extractTags(job.tags || []),
        category: mapRemotiveCategory(job.category),
        jobType: mapJobType(job.job_type),
        workMode: 'remote',
        source: 'api',
        sourceUrl: job.url,
        applyUrl: job.url,
        companyLogo: job.company_logo || null,
        postedDate: job.publication_date ? new Date(job.publication_date) : new Date(),
        salaryMin: parseSalaryField(job.salary, 'min'),
        salaryMax: parseSalaryField(job.salary, 'max'),
      });
    }
    console.log(`[Remotive] Fetched ${jobs.length} remote jobs (${category})`);
  } catch (err) {
    console.error('[Remotive] Fetch error:', err.message);
  }
  return jobs;
}

// ─── Arbeitnow (Free, no auth) ────────────────────────────────

async function fetchArbeitnowJobs() {
  const jobs = [];
  try {
    const page = Math.floor(Math.random() * 3) + 1;
    const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?page=${page}`, { timeout: 15000 });
    if (res.status !== 200 || !res.data || !res.data.data) {
      console.log('[Arbeitnow] No data returned');
      return jobs;
    }

    for (const job of res.data.data.slice(0, 25)) {
      jobs.push({
        externalId: `arbeitnow-${job.slug}`,
        title: job.title,
        company: job.company_name,
        location: job.location || 'Remote',
        description: stripHtml(job.description || '').substring(0, 3000),
        skills: extractTags(job.tags || []),
        category: categorizeJob(job.title),
        jobType: job.job_types && job.job_types.includes('Part Time') ? 'part_time' : 'full_time',
        workMode: job.remote ? 'remote' : 'onsite',
        source: 'api',
        sourceUrl: job.url,
        applyUrl: job.url,
        postedDate: job.created_at ? new Date(job.created_at * 1000) : new Date(),
      });
    }
    console.log(`[Arbeitnow] Fetched ${jobs.length} jobs (page ${page})`);
  } catch (err) {
    console.error('[Arbeitnow] Fetch error:', err.message);
  }
  return jobs;
}

// ─── Adzuna API (requires free API key) ───────────────────────

async function fetchAdzunaJobs() {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    console.log('[Adzuna] Skipped - no API key configured (set ADZUNA_APP_ID & ADZUNA_APP_KEY)');
    return [];
  }

  const jobs = [];
  const queries = ['software developer', 'web developer', 'data analyst', 'tester', 'devops'];
  const query = queries[Math.floor(Math.random() * queries.length)];

  try {
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=25&what=${encodeURIComponent(query)}&content-type=application/json`,
      { timeout: 15000 }
    );
    if (res.status !== 200 || !res.data || !res.data.results) {
      console.log('[Adzuna] No data returned, status:', res.status);
      return jobs;
    }

    for (const job of res.data.results) {
      jobs.push({
        externalId: `adzuna-${job.id}`,
        title: job.title,
        company: (job.company && job.company.display_name) || 'Unknown',
        location: (job.location && job.location.display_name) || 'India',
        description: (job.description || '').substring(0, 3000),
        skills: extractSkillsFromText(job.title + ' ' + (job.description || '')),
        category: categorizeJob(job.title),
        jobType: job.contract_time === 'part_time' ? 'part_time' : 'full_time',
        workMode: detectWorkMode(job.title + ' ' + (job.description || '')),
        source: 'api',
        sourceUrl: job.redirect_url,
        applyUrl: job.redirect_url,
        salaryMin: job.salary_min ? Math.round(job.salary_min) : null,
        salaryMax: job.salary_max ? Math.round(job.salary_max) : null,
        salaryCurrency: 'INR',
        postedDate: job.created ? new Date(job.created) : new Date(),
      });
    }
    console.log(`[Adzuna] Fetched ${jobs.length} jobs for "${query}"`);
  } catch (err) {
    console.error('[Adzuna] Fetch error:', err.message);
  }
  return jobs;
}

// ─── JSearch via RapidAPI (requires free key) ─────────────────

async function fetchJSearchJobs() {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.log('[JSearch] Skipped - no RAPIDAPI_KEY configured');
    return [];
  }

  const jobs = [];
  const queries = ['developer in India', 'software engineer India', 'tester India', 'web developer Mumbai', 'data analyst Bangalore'];
  const query = queries[Math.floor(Math.random() * queries.length)];

  try {
    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1`,
      {
        timeout: 15000,
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      }
    );
    if (res.status !== 200 || !res.data || !res.data.data) {
      console.log('[JSearch] No data returned, status:', res.status);
      return jobs;
    }

    for (const job of res.data.data.slice(0, 25)) {
      jobs.push({
        externalId: `jsearch-${job.job_id}`,
        title: job.job_title,
        company: job.employer_name,
        location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', ') || 'India',
        description: (job.job_description || '').substring(0, 3000),
        skills: extractSkillsFromText(job.job_title + ' ' + (job.job_description || '')),
        category: categorizeJob(job.job_title),
        jobType: mapJSearchType(job.job_employment_type),
        workMode: job.job_is_remote ? 'remote' : 'onsite',
        source: 'api',
        sourceUrl: job.job_apply_link || job.job_google_link,
        applyUrl: job.job_apply_link || job.job_google_link,
        companyLogo: job.employer_logo || null,
        salaryMin: job.job_min_salary ? Math.round(job.job_min_salary) : null,
        salaryMax: job.job_max_salary ? Math.round(job.job_max_salary) : null,
        postedDate: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : new Date(),
      });
    }
    console.log(`[JSearch] Fetched ${jobs.length} jobs for "${query}"`);
  } catch (err) {
    console.error('[JSearch] Fetch error:', err.message);
  }
  return jobs;
}

// ─── Helpers ──────────────────────────────────────────────────

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTags(tags) {
  if (!tags || !Array.isArray(tags)) return [];
  return tags.filter(t => typeof t === 'string').slice(0, 10);
}

function parseSalaryField(salary, type) {
  if (!salary || typeof salary !== 'string') return null;
  const nums = salary.match(/[\d,]+/g);
  if (!nums) return null;
  const values = nums.map(n => parseInt(n.replace(/,/g, '')));
  if (type === 'min') return values[0] || null;
  if (type === 'max') return values[1] || values[0] || null;
  return null;
}

function mapRemotiveCategory(cat) {
  const map = {
    'Software Development': 'Engineering', 'Data': 'Data Science', 'Design': 'Design',
    'DevOps / Sysadmin': 'DevOps', 'Product': 'Management', 'QA': 'Testing',
    'Marketing': 'Marketing', 'Sales': 'Sales', 'Finance / Legal': 'Finance',
    'HR': 'HR', 'Customer Service': 'Operations',
  };
  return map[cat] || 'Engineering';
}

function mapJobType(type) {
  if (!type) return 'full_time';
  const t = type.toLowerCase();
  if (t.includes('part')) return 'part_time';
  if (t.includes('contract') || t.includes('freelance')) return 'contract';
  if (t.includes('intern')) return 'internship';
  return 'full_time';
}

function mapJSearchType(type) {
  if (!type) return 'full_time';
  const t = type.toUpperCase();
  if (t === 'PARTTIME') return 'part_time';
  if (t === 'CONTRACTOR') return 'contract';
  if (t === 'INTERN') return 'internship';
  return 'full_time';
}

function extractSkillsFromText(text) {
  const t = text.toLowerCase();
  const skillMap = {
    'react': 'React', 'angular': 'Angular', 'vue': 'Vue.js', 'node': 'Node.js',
    'python': 'Python', 'java': 'Java', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
    'aws': 'AWS', 'azure': 'Azure', 'docker': 'Docker', 'kubernetes': 'Kubernetes',
    'sql': 'SQL', 'mongodb': 'MongoDB', 'postgres': 'PostgreSQL',
    'devops': 'DevOps', 'selenium': 'Selenium', 'git': 'Git',
    'php': 'PHP', 'laravel': 'Laravel', 'django': 'Django', 'spring': 'Spring',
    'flutter': 'Flutter', 'android': 'Android', 'swift': 'Swift',
    'machine learning': 'Machine Learning', 'deep learning': 'Deep Learning',
  };
  const found = [];
  for (const [key, val] of Object.entries(skillMap)) {
    if (t.includes(key) && !found.includes(val)) found.push(val);
  }
  return found.length > 0 ? found.slice(0, 10) : ['General'];
}

function categorizeJob(title) {
  const t = title.toLowerCase();
  if (/test|qa|quality|sdet/.test(t)) return 'Testing';
  if (/data\s*(scien|analy|engineer)/.test(t)) return 'Data Science';
  if (/devops|sre|infra|cloud/.test(t)) return 'DevOps';
  if (/design|ui|ux/.test(t)) return 'Design';
  if (/market|seo|content/.test(t)) return 'Marketing';
  if (/product\s*manag/.test(t)) return 'Management';
  if (/front.?end|react|angular|vue/.test(t)) return 'Frontend Development';
  if (/back.?end|server|api/.test(t)) return 'Backend Development';
  if (/full.?stack/.test(t)) return 'Full Stack Development';
  if (/ml|machine|deep|ai/.test(t)) return 'AI/ML';
  if (/mobile|android|ios/.test(t)) return 'Mobile Development';
  return 'Engineering';
}

function detectWorkMode(text) {
  const t = text.toLowerCase();
  if (/remote/.test(t)) return 'remote';
  if (/hybrid/.test(t)) return 'hybrid';
  return 'onsite';
}

module.exports = { fetchRemotiveJobs, fetchArbeitnowJobs, fetchAdzunaJobs, fetchJSearchJobs };
