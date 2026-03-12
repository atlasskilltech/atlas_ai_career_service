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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCompanyLogoUrl(companyName) {
  const domain = companyName
    .toLowerCase()
    .replace(/\s*(pvt|private|ltd|limited|inc|corp|corporation|llp|llc|co|company|technologies|tech|software|solutions|consulting|services|india|global)\s*/gi, '')
    .trim()
    .replace(/\s+/g, '')
    + '.com';
  return `https://logo.clearbit.com/${domain}`;
}

async function fetchJobDescription(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    // Wait for description to load
    await page.waitForSelector('.styles_JDC__dang-inner-html__h0K4t, .job-desc, .dang-inner-html, [class*="jd-header-comp-name"], [class*="JobDetail"]', { timeout: 8000 }).catch(() => {});

    const details = await page.evaluate(() => {
      // Extract full job description
      const descEl = document.querySelector('.styles_JDC__dang-inner-html__h0K4t') ||
                     document.querySelector('.dang-inner-html') ||
                     document.querySelector('.job-desc') ||
                     document.querySelector('[class*="job-desc"]') ||
                     document.querySelector('[class*="JobDetail"] [class*="description"]');

      let description = '';
      if (descEl) {
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

      // Extract key skills from the skills section
      const skillEls = document.querySelectorAll('.chip_chip__sBWWc, .chip, .key-skill, [class*="chip"] a, [class*="keyskill"], .tag-li');
      const skills = [];
      skillEls.forEach(el => {
        const skill = (el.textContent || '').trim();
        if (skill && skill.length < 40 && !skills.includes(skill)) {
          skills.push(skill);
        }
      });

      // Extract additional details (education, role category, industry, etc.)
      const otherDetails = {};
      const detailRows = document.querySelectorAll('.styles_details__Y424J .styles_detail-row__RGpyG, .details .detail-row, [class*="detail"] [class*="row"], .other-details .details-section');
      detailRows.forEach(row => {
        const label = row.querySelector('label, .label, [class*="label"]');
        const value = row.querySelector('span:not(label), .value, [class*="value"]');
        if (label && value) {
          otherDetails[(label.textContent || '').trim().toLowerCase()] = (value.textContent || '').trim();
        }
      });

      // Extract company logo
      const logoEl = document.querySelector('.styles_jhc__comp-logo__img__1jLjp img, [class*="comp-logo"] img, .company-logo img, img[alt*="company"], .jd-header-comp-logo img');
      let companyLogo = '';
      if (logoEl && logoEl.src && !logoEl.src.includes('data:image')) {
        companyLogo = logoEl.src;
      }

      return { description, skills, otherDetails, companyLogo };
    });

    return details;
  } catch (err) {
    console.log(`[Naukri] Failed to fetch description from ${url}: ${err.message}`);
    return null;
  }
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
          const logoEl = card.querySelector('[class*="comp-logo"] img, .company-logo img, img[class*="logo"]');
          let logo = '';
          if (logoEl && logoEl.src && !logoEl.src.includes('data:image')) {
            logo = logoEl.src;
          }
          results.push({
            title: (titleEl.textContent || '').trim(),
            company: (companyEl.textContent || '').trim(),
            location: locationEl ? (locationEl.textContent || '').trim() : '',
            experience: expEl ? (expEl.textContent || '').trim() : '',
            salary: salaryEl ? (salaryEl.textContent || '').trim() : '',
            url: linkEl ? linkEl.href : '',
            logo,
          });
        }
      });
      return results;
    });

    // Visit each job detail page to get full description (limit to 15)
    const jobsToProcess = rawJobs.slice(0, 15);
    for (let i = 0; i < jobsToProcess.length; i++) {
      const raw = jobsToProcess[i];
      if (!raw.title || !raw.company) continue;
      const externalId = raw.url ? raw.url.split('?')[0].split('/').pop().replace(/\.html$/, '') : `nk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const { expMin, expMax } = parseExperience(raw.experience);
      const { salMin, salMax } = parseSalary(raw.salary);

      let description = `${raw.title} at ${raw.company}.`;
      let pageSkills = [];
      let companyLogo = raw.logo || '';

      // Fetch full description from the job detail page
      if (raw.url) {
        const details = await fetchJobDescription(page, raw.url);
        if (details && details.description && details.description.length > 50) {
          description = details.description;
          if (details.skills && details.skills.length > 0) {
            pageSkills = details.skills;
          }
          if (!companyLogo && details.companyLogo) {
            companyLogo = details.companyLogo;
          }
        }
        // Small delay to avoid rate limiting
        await delay(1500 + Math.random() * 1500);
      }

      // Fallback: use Clearbit logo API based on company name
      if (!companyLogo) {
        companyLogo = getCompanyLogoUrl(raw.company);
      }

      // Combine skills: page skills + title-extracted skills
      const titleSkills = extractSkillsFromText(raw.title + ' ' + description);
      const allSkills = pageSkills.length > 0 ? [...new Set([...pageSkills, ...titleSkills])] : titleSkills;

      jobs.push({
        externalId,
        title: raw.title,
        company: raw.company,
        location: raw.location || 'India',
        description,
        skills: allSkills,
        category: categorizeJob(raw.title),
        jobType: 'full_time',
        workMode: detectWorkMode(raw.title + ' ' + raw.location + ' ' + description),
        experienceMin: expMin,
        experienceMax: expMax,
        salaryMin: salMin,
        salaryMax: salMax,
        source: 'naukri',
        sourceUrl: raw.url || searchUrl,
        applyUrl: raw.url || searchUrl,
        companyLogo,
        postedDate: new Date(),
      });
    }

    console.log(`[Naukri] Fetched ${jobs.length} jobs with full descriptions for "${query}"`);
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
  const match = text.match(/([\d.]+)\s*[-–to]+\s*([\d.]+)\s*(lacs?|lakhs?)/i);
  if (match) return { salMin: Math.round(parseFloat(match[1]) * 100000), salMax: Math.round(parseFloat(match[2]) * 100000) };
  return { salMin: null, salMax: null };
}

function extractSkillsFromText(text) {
  const t = text.toLowerCase();
  const skillMap = {
    'react': 'React', 'angular': 'Angular', 'vue': 'Vue.js', 'node': 'Node.js',
    'python': 'Python', 'java ': 'Java', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
    'aws': 'AWS', 'azure': 'Azure', 'docker': 'Docker', 'kubernetes': 'Kubernetes',
    'sql': 'SQL', 'mongodb': 'MongoDB', 'postgres': 'PostgreSQL', 'mysql': 'MySQL',
    'devops': 'DevOps', 'selenium': 'Selenium', 'automation': 'Test Automation',
    'php': 'PHP', 'laravel': 'Laravel', 'django': 'Django', 'spring': 'Spring Boot',
    'flutter': 'Flutter', 'android': 'Android', 'ios': 'iOS', '.net': '.NET',
    'figma': 'Figma', 'ml': 'Machine Learning', 'data': 'Data Analysis',
    'redis': 'Redis', 'kafka': 'Kafka', 'rabbitmq': 'RabbitMQ',
    'git': 'Git', 'ci/cd': 'CI/CD', 'jenkins': 'Jenkins',
    'pandas': 'Pandas', 'numpy': 'NumPy', 'tensorflow': 'TensorFlow', 'pytorch': 'PyTorch',
    'rest api': 'REST API', 'graphql': 'GraphQL', 'microservice': 'Microservices',
    'linux': 'Linux', 'nginx': 'Nginx', 'terraform': 'Terraform',
    'html': 'HTML', 'css': 'CSS', 'tailwind': 'Tailwind CSS',
    'next.js': 'Next.js', 'nextjs': 'Next.js', 'express': 'Express.js',
    'ruby': 'Ruby', 'scala': 'Scala', 'power bi': 'Power BI', 'tableau': 'Tableau',
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
