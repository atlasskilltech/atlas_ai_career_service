const puppeteer = require('puppeteer');

/**
 * Naukri Job Fetcher - Scrapes public Naukri.com job listings.
 * No API key needed. Uses Puppeteer for headless browsing.
 */

const SEARCH_QUERIES = [
  'software-developer-jobs',
  'web-developer-jobs',
  'data-analyst-jobs',
  'software-testing-jobs',
  'frontend-developer-jobs',
  'backend-developer-jobs',
  'full-stack-developer-jobs',
  'devops-jobs',
  'ui-ux-designer-jobs',
  'product-manager-jobs',
  'python-developer-jobs',
  'java-developer-jobs',
  'react-developer-jobs',
  'machine-learning-jobs',
  'business-analyst-jobs',
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchNaukriJobs() {
  const query = getRandomItem(SEARCH_QUERIES);
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

    const searchUrl = `https://www.naukri.com/${query}?k=${query.replace(/-jobs$/, '').replace(/-/g, '+')}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for job cards
    await page.waitForSelector('.srp-jobtuple-wrapper, .jobTuple, article.jobTuple, .cust-job-tuple', { timeout: 10000 }).catch(() => {});

    const rawJobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('.srp-jobtuple-wrapper, .jobTuple, article.jobTuple, .cust-job-tuple, [class*="jobTuple"]');
      const results = [];
      cards.forEach((card, idx) => {
        if (idx >= 25) return;
        const titleEl = card.querySelector('.title, .row1 a, a.title, [class*="jobTitle"], h2 a');
        const companyEl = card.querySelector('.comp-name, .subTitle, .companyInfo a, [class*="companyName"]');
        const locationEl = card.querySelector('.locWdth, .loc, .location, [class*="location"], .ellipsis .loc');
        const expEl = card.querySelector('.expwdth, .exp, [class*="experience"]');
        const salaryEl = card.querySelector('.sal, .salary, [class*="salary"]');
        const linkEl = card.querySelector('a.title, a[class*="title"], h2 a, a');

        if (titleEl && companyEl) {
          results.push({
            title: (titleEl.textContent || '').trim(),
            company: (companyEl.textContent || '').trim(),
            location: locationEl ? (locationEl.textContent || '').trim() : '',
            experience: expEl ? (expEl.textContent || '').trim() : '',
            salary: salaryEl ? (salaryEl.textContent || '').trim() : '',
            url: linkEl ? linkEl.href : '',
          });
        }
      });
      return results;
    });

    for (const raw of rawJobs) {
      if (!raw.title || !raw.company) continue;
      const externalId = raw.url ? raw.url.split('?')[0].split('/').pop().replace(/\.html$/, '') : `nk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const { expMin, expMax } = parseExperience(raw.experience);
      const { salMin, salMax } = parseSalary(raw.salary);

      jobs.push({
        externalId,
        title: raw.title,
        company: raw.company,
        location: raw.location || 'India',
        description: `${raw.title} at ${raw.company}. ${raw.experience ? 'Experience: ' + raw.experience + '.' : ''} ${raw.salary ? 'Salary: ' + raw.salary + '.' : ''} Found on Naukri.`,
        skills: extractSkillsFromTitle(raw.title),
        category: categorizeJob(raw.title),
        jobType: 'full_time',
        workMode: detectWorkMode(raw.title + ' ' + raw.location),
        experienceMin: expMin,
        experienceMax: expMax,
        salaryMin: salMin,
        salaryMax: salMax,
        source: 'naukri',
        sourceUrl: raw.url || searchUrl,
        applyUrl: raw.url || searchUrl,
        postedDate: new Date(),
      });
    }

    console.log(`[Naukri] Fetched ${jobs.length} jobs for "${query}"`);
  } catch (err) {
    console.error('[Naukri] Fetch error:', err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return jobs;
}

function parseExperience(text) {
  if (!text) return { expMin: 0, expMax: null };
  const match = text.match(/(\d+)\s*[-–to]+\s*(\d+)/);
  if (match) return { expMin: parseInt(match[1]), expMax: parseInt(match[2]) };
  const single = text.match(/(\d+)/);
  if (single) return { expMin: parseInt(single[1]), expMax: parseInt(single[1]) + 2 };
  return { expMin: 0, expMax: null };
}

function parseSalary(text) {
  if (!text) return { salMin: null, salMax: null };
  // "8-12 Lacs PA" or "Not disclosed"
  const match = text.match(/([\d.]+)\s*[-–to]+\s*([\d.]+)\s*(lacs?|lakhs?)/i);
  if (match) return { salMin: Math.round(parseFloat(match[1]) * 100000), salMax: Math.round(parseFloat(match[2]) * 100000) };
  return { salMin: null, salMax: null };
}

function extractSkillsFromTitle(title) {
  const t = title.toLowerCase();
  const skillMap = {
    'react': 'React', 'angular': 'Angular', 'vue': 'Vue.js', 'node': 'Node.js',
    'python': 'Python', 'java ': 'Java', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
    'aws': 'AWS', 'azure': 'Azure', 'docker': 'Docker', 'kubernetes': 'Kubernetes',
    'sql': 'SQL', 'mongodb': 'MongoDB', 'postgres': 'PostgreSQL',
    'devops': 'DevOps', 'selenium': 'Selenium', 'automation': 'Test Automation',
    'php': 'PHP', 'laravel': 'Laravel', 'django': 'Django', 'spring': 'Spring Boot',
    'flutter': 'Flutter', 'android': 'Android', 'ios': 'iOS', '.net': '.NET',
    'figma': 'Figma', 'ml': 'Machine Learning', 'data': 'Data Analysis',
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
  if (/devops|sre|infra|cloud/.test(t)) return 'DevOps';
  if (/design|ui|ux/.test(t)) return 'Design';
  if (/market|seo|content/.test(t)) return 'Marketing';
  if (/product\s*manag/.test(t)) return 'Management';
  if (/front.?end|react|angular|vue/.test(t)) return 'Frontend Development';
  if (/back.?end|server|api/.test(t)) return 'Backend Development';
  if (/full.?stack/.test(t)) return 'Full Stack Development';
  if (/ml|machine|deep|ai/.test(t)) return 'AI/ML';
  if (/mobile|android|ios|flutter/.test(t)) return 'Mobile Development';
  return 'Engineering';
}

function detectWorkMode(text) {
  const t = text.toLowerCase();
  if (/remote/.test(t)) return 'remote';
  if (/hybrid/.test(t)) return 'hybrid';
  return 'onsite';
}

module.exports = { fetchNaukriJobs };
