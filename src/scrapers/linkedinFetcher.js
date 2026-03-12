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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJobDescription(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    // Wait for the description section to load
    await page.waitForSelector('.show-more-less-html__markup, .description__text, .decorated-job-posting__details, [class*="description"], article', { timeout: 8000 }).catch(() => {});

    const details = await page.evaluate(() => {
      // Extract full description
      const descEl = document.querySelector('.show-more-less-html__markup') ||
                     document.querySelector('.description__text') ||
                     document.querySelector('.decorated-job-posting__details') ||
                     document.querySelector('[class*="description"] .show-more-less-html__markup') ||
                     document.querySelector('article .show-more-less-html__markup');

      let description = '';
      if (descEl) {
        // Get HTML content and convert to readable text
        description = descEl.innerHTML
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<li>/gi, '• ')
          .replace(/<\/h[1-6]>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }

      // Extract skills/criteria from the page
      const skillEls = document.querySelectorAll('.description__job-criteria-text, .job-criteria__text');
      const criteria = {};
      const criteriaLabels = document.querySelectorAll('.description__job-criteria-subheader');
      criteriaLabels.forEach((label, i) => {
        const key = (label.textContent || '').trim().toLowerCase();
        const val = skillEls[i] ? (skillEls[i].textContent || '').trim() : '';
        if (key && val) criteria[key] = val;
      });

      // Try to get employment type and seniority
      const jobType = criteria['employment type'] || '';
      const seniorityLevel = criteria['seniority level'] || '';

      return { description, jobType, seniorityLevel };
    });

    return details;
  } catch (err) {
    console.log(`[LinkedIn] Failed to fetch description from ${url}: ${err.message}`);
    return null;
  }
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

    // Visit each job detail page to get full description (limit to 15 to avoid rate limiting)
    const jobsToProcess = rawJobs.slice(0, 15);
    for (let i = 0; i < jobsToProcess.length; i++) {
      const raw = jobsToProcess[i];
      if (!raw.title || !raw.company) continue;
      const externalId = raw.url ? raw.url.split('?')[0].split('/').pop() : `li-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let description = `${raw.title} position at ${raw.company}.`;
      let detectedJobType = 'full_time';

      // Fetch full description from the job detail page
      if (raw.url) {
        const details = await fetchJobDescription(page, raw.url);
        if (details && details.description && details.description.length > 50) {
          description = details.description;

          // Map employment type
          if (details.jobType) {
            const jt = details.jobType.toLowerCase();
            if (jt.includes('part')) detectedJobType = 'part_time';
            else if (jt.includes('intern')) detectedJobType = 'internship';
            else if (jt.includes('contract')) detectedJobType = 'contract';
            else if (jt.includes('freelance') || jt.includes('temporary')) detectedJobType = 'freelance';
          }
        }
        // Small delay to avoid rate limiting
        await delay(1500 + Math.random() * 1500);
      }

      const allSkills = extractSkillsFromText(raw.title + ' ' + description);

      jobs.push({
        externalId,
        title: raw.title,
        company: raw.company,
        location: raw.location || location,
        description,
        skills: allSkills,
        category: categorizeJob(raw.title),
        jobType: detectedJobType,
        workMode: detectWorkMode(raw.title + ' ' + raw.location + ' ' + description),
        source: 'linkedin',
        sourceUrl: raw.url || searchUrl,
        applyUrl: raw.url || searchUrl,
        postedDate: raw.postedDate ? new Date(raw.postedDate) : new Date(),
      });
    }

    console.log(`[LinkedIn] Fetched ${jobs.length} jobs with full descriptions for "${query}" in ${location}`);
  } catch (err) {
    console.error('[LinkedIn] Fetch error:', err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return jobs;
}

function extractSkillsFromText(text) {
  const t = text.toLowerCase();
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
    'redis': 'Redis', 'kafka': 'Kafka', 'rabbitmq': 'RabbitMQ',
    'git': 'Git', 'ci/cd': 'CI/CD', 'jenkins': 'Jenkins',
    'pandas': 'Pandas', 'numpy': 'NumPy', 'tensorflow': 'TensorFlow', 'pytorch': 'PyTorch',
    'rest api': 'REST API', 'graphql': 'GraphQL', 'microservice': 'Microservices',
    'linux': 'Linux', 'nginx': 'Nginx', 'terraform': 'Terraform', 'ansible': 'Ansible',
    'html': 'HTML', 'css': 'CSS', 'sass': 'SASS', 'tailwind': 'Tailwind CSS',
    'next.js': 'Next.js', 'nextjs': 'Next.js', 'express': 'Express.js',
    'ruby': 'Ruby', 'rails': 'Ruby on Rails', 'scala': 'Scala',
    'elasticsearch': 'Elasticsearch', 'power bi': 'Power BI', 'tableau': 'Tableau',
  };
  const found = [];
  for (const [key, val] of Object.entries(skillMap)) {
    if (t.includes(key) && !found.includes(val)) found.push(val);
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
