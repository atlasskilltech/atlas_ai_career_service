const https = require('https');

/**
 * Job Fetcher - Uses Arbeitnow API (free, no API key needed).
 * Returns real job listings from companies worldwide.
 * Replaces old Puppeteer-based Naukri scraper.
 */

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AtlasCareerService/1.0' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Failed to parse response')); }
      });
    }).on('error', reject);
  });
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

async function fetchNaukriJobs() {
  const jobs = [];
  const page = Math.floor(Math.random() * 5) + 1; // Random page 1-5 for variety

  try {
    const url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`;
    console.log(`[JobFetcher/Arbeitnow] Fetching page ${page}`);
    const data = await httpsGet(url);

    if (!data.data || !Array.isArray(data.data)) {
      console.log('[JobFetcher/Arbeitnow] No jobs returned');
      return jobs;
    }

    for (const job of data.data) {
      if (!job.title || !job.company_name) continue;

      const externalId = `arbeitnow-${job.slug || Date.now() + '-' + Math.random().toString(36).slice(2, 8)}`;

      // Clean HTML from description
      const description = (job.description || '')
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

      const companyLogo = getCompanyLogoUrl(job.company_name);

      // Detect work mode
      let workMode = 'onsite';
      if (job.remote === true) workMode = 'remote';
      else if ((job.location || '').toLowerCase().includes('remote')) workMode = 'remote';
      else if ((job.location || '').toLowerCase().includes('hybrid')) workMode = 'hybrid';

      // Detect job type from tags
      let jobType = 'full_time';
      const tags = (job.tags || []).map(t => t.toLowerCase());
      if (tags.some(t => t.includes('part'))) jobType = 'part_time';
      else if (tags.some(t => t.includes('intern'))) jobType = 'internship';
      else if (tags.some(t => t.includes('contract') || t.includes('freelance'))) jobType = 'contract';

      const allSkills = extractSkillsFromText(job.title + ' ' + description + ' ' + (job.tags || []).join(' '));

      jobs.push({
        externalId,
        title: job.title,
        company: job.company_name,
        location: job.location || 'Remote',
        description: description || `${job.title} position at ${job.company_name}.`,
        skills: allSkills,
        category: categorizeJob(job.title),
        jobType,
        workMode,
        source: 'naukri',
        sourceUrl: job.url || `https://www.arbeitnow.com/view/${job.slug}`,
        applyUrl: job.url || `https://www.arbeitnow.com/view/${job.slug}`,
        companyLogo,
        postedDate: job.created_at ? new Date(job.created_at * 1000) : new Date(),
      });
    }

    console.log(`[JobFetcher/Arbeitnow] Fetched ${jobs.length} jobs from page ${page}`);
  } catch (err) {
    console.error('[JobFetcher/Arbeitnow] Fetch error:', err.message);
  }

  return jobs;
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
    'golang': 'Go', ' go ': 'Go', 'rust': 'Rust', 'c++': 'C++', 'c#': 'C#',
    'swift': 'Swift', 'kotlin': 'Kotlin',
    'sass': 'SASS', 'ansible': 'Ansible', 'elasticsearch': 'Elasticsearch',
    'rails': 'Ruby on Rails',
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

module.exports = { fetchNaukriJobs };
