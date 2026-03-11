const puppeteer = require('puppeteer');

/**
 * LinkedIn Job Fetcher - Scrapes public LinkedIn job search pages.
 * No API key needed. Uses Puppeteer for headless browsing.
 */

const SEARCH_QUERIES = [
  'software engineer',
  'web developer',
  'data analyst',
  'software tester',
  'frontend developer',
  'backend developer',
  'full stack developer',
  'devops engineer',
  'ui ux designer',
  'product manager',
  'business analyst',
  'machine learning engineer',
  'python developer',
  'java developer',
  'react developer',
];

const LOCATIONS = ['India', 'Mumbai', 'Bangalore', 'Delhi', 'Pune', 'Hyderabad'];

function getRandomItems(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function fetchLinkedInJobs() {
  const query = getRandomItems(SEARCH_QUERIES, 1)[0];
  const location = getRandomItems(LOCATIONS, 1)[0];
  const jobs = [];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      timeout: 30000,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&f_TPR=r86400&position=1&pageNum=0`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for job cards to load
    await page.waitForSelector('.base-card, .job-search-card, .jobs-search__results-list li', { timeout: 10000 }).catch(() => {});

    // Extract job listings
    const rawJobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('.base-card, .job-search-card, .jobs-search__results-list li');
      const results = [];
      cards.forEach((card, idx) => {
        if (idx >= 25) return; // max 25 per run
        const titleEl = card.querySelector('.base-search-card__title, .base-card__full-link, h3');
        const companyEl = card.querySelector('.base-search-card__subtitle, h4, .hidden-nested-link');
        const locationEl = card.querySelector('.job-search-card__location, .base-search-card__metadata span');
        const linkEl = card.querySelector('a.base-card__full-link, a');
        const dateEl = card.querySelector('time');

        if (titleEl && companyEl) {
          results.push({
            title: (titleEl.textContent || '').trim(),
            company: (companyEl.textContent || '').trim(),
            location: locationEl ? (locationEl.textContent || '').trim() : '',
            url: linkEl ? linkEl.href : '',
            postedDate: dateEl ? dateEl.getAttribute('datetime') : null,
          });
        }
      });
      return results;
    });

    for (const raw of rawJobs) {
      if (!raw.title || !raw.company) continue;
      const externalId = raw.url ? raw.url.split('?')[0].split('/').pop() : `li-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      jobs.push({
        externalId,
        title: raw.title,
        company: raw.company,
        location: raw.location || location,
        description: `${raw.title} position at ${raw.company}. Found on LinkedIn for ${query} in ${location}.`,
        skills: extractSkillsFromTitle(raw.title),
        category: categorizeJob(raw.title),
        jobType: 'full_time',
        workMode: detectWorkMode(raw.title + ' ' + raw.location),
        source: 'linkedin',
        sourceUrl: raw.url || searchUrl,
        applyUrl: raw.url || searchUrl,
        postedDate: raw.postedDate ? new Date(raw.postedDate) : new Date(),
      });
    }

    console.log(`[LinkedIn] Fetched ${jobs.length} jobs for "${query}" in ${location}`);
  } catch (err) {
    console.error('[LinkedIn] Fetch error:', err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return jobs;
}

function extractSkillsFromTitle(title) {
  const t = title.toLowerCase();
  const skillMap = {
    'react': 'React', 'angular': 'Angular', 'vue': 'Vue.js', 'node': 'Node.js',
    'python': 'Python', 'java ': 'Java', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
    'golang': 'Go', ' go ': 'Go', 'rust': 'Rust', 'c++': 'C++', 'c#': 'C#', '.net': '.NET',
    'aws': 'AWS', 'azure': 'Azure', 'gcp': 'GCP', 'docker': 'Docker', 'kubernetes': 'Kubernetes',
    'sql': 'SQL', 'mongodb': 'MongoDB', 'postgres': 'PostgreSQL', 'mysql': 'MySQL',
    'devops': 'DevOps', 'ml': 'Machine Learning', 'ai': 'AI', 'data': 'Data Analysis',
    'flutter': 'Flutter', 'swift': 'Swift', 'kotlin': 'Kotlin', 'android': 'Android', 'ios': 'iOS',
    'php': 'PHP', 'laravel': 'Laravel', 'django': 'Django', 'spring': 'Spring Boot',
    'selenium': 'Selenium', 'automation': 'Test Automation', 'manual testing': 'Manual Testing',
    'figma': 'Figma', 'ui': 'UI Design', 'ux': 'UX Design',
  };
  const found = [];
  for (const [key, val] of Object.entries(skillMap)) {
    if (t.includes(key)) found.push(val);
  }
  return found.length > 0 ? found : ['General'];
}

function categorizeJob(title) {
  const t = title.toLowerCase();
  if (/test|qa|quality|sdet/.test(t)) return 'Testing';
  if (/data\s*(scien|analy|engineer)/.test(t)) return 'Data Science';
  if (/devops|sre|infra|cloud|platform/.test(t)) return 'DevOps';
  if (/design|ui|ux|graphic/.test(t)) return 'Design';
  if (/market|seo|content|growth/.test(t)) return 'Marketing';
  if (/sales|business dev/.test(t)) return 'Sales';
  if (/product\s*manag/.test(t)) return 'Management';
  if (/hr|recruit|talent/.test(t)) return 'HR';
  if (/finance|account/.test(t)) return 'Finance';
  if (/mobile|android|ios|flutter/.test(t)) return 'Mobile Development';
  if (/front.?end|react|angular|vue|ui dev/.test(t)) return 'Frontend Development';
  if (/back.?end|server|api/.test(t)) return 'Backend Development';
  if (/full.?stack/.test(t)) return 'Full Stack Development';
  if (/ml|machine|deep|nlp|ai/.test(t)) return 'AI/ML';
  return 'Engineering';
}

function detectWorkMode(text) {
  const t = text.toLowerCase();
  if (/remote/.test(t)) return 'remote';
  if (/hybrid/.test(t)) return 'hybrid';
  return 'onsite';
}

module.exports = { fetchLinkedInJobs };
