const https = require('https');

/**
 * Job Fetcher - Uses Remotive API (free, no API key needed).
 * Returns remote & hybrid jobs from real companies.
 * Replaces old Puppeteer-based LinkedIn scraper.
 */

const CATEGORIES = [
  'software-dev',
  'design',
  'data',
  'product',
  'devops-sysadmin',
  'qa',
  'marketing',
  'customer-support',
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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

async function fetchLinkedInJobs() {
  const category = getRandomItem(CATEGORIES);
  const jobs = [];

  try {
    const url = `https://remotive.com/api/remote-jobs?category=${category}&limit=25`;
    console.log(`[JobFetcher/Remotive] Fetching category: ${category}`);
    const data = await httpsGet(url);

    if (!data.jobs || !Array.isArray(data.jobs)) {
      console.log('[JobFetcher/Remotive] No jobs returned');
      return jobs;
    }

    for (const job of data.jobs) {
      if (!job.title || !job.company_name) continue;

      const externalId = `remotive-${job.id}`;
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

      const companyLogo = job.company_logo || getCompanyLogoUrl(job.company_name);

      // Map job type
      let jobType = 'full_time';
      if (job.job_type) {
        const jt = job.job_type.toLowerCase();
        if (jt.includes('part')) jobType = 'part_time';
        else if (jt.includes('intern')) jobType = 'internship';
        else if (jt.includes('contract')) jobType = 'contract';
        else if (jt.includes('freelance')) jobType = 'freelance';
      }

      // Detect work mode
      const locationText = (job.candidate_required_location || '').toLowerCase();
      let workMode = 'remote';
      if (/hybrid/.test(locationText)) workMode = 'hybrid';
      else if (/onsite|on-site|office/.test(locationText)) workMode = 'onsite';

      const allSkills = extractSkillsFromText(job.title + ' ' + description + ' ' + (job.tags || []).join(' '));

      // Parse salary if present
      let salaryMin = null;
      let salaryMax = null;
      if (job.salary) {
        const salMatch = job.salary.match(/([\d,]+)\s*[-–to]+\s*([\d,]+)/);
        if (salMatch) {
          salaryMin = parseInt(salMatch[1].replace(/,/g, ''));
          salaryMax = parseInt(salMatch[2].replace(/,/g, ''));
        }
      }

      jobs.push({
        externalId,
        title: job.title,
        company: job.company_name,
        location: job.candidate_required_location || 'Remote',
        description: description || `${job.title} position at ${job.company_name}.`,
        skills: allSkills,
        category: categorizeJob(job.title),
        jobType,
        workMode,
        salaryMin,
        salaryMax,
        source: 'linkedin',
        sourceUrl: job.url || `https://remotive.com/remote-jobs/${category}`,
        applyUrl: job.url || `https://remotive.com/remote-jobs/${category}`,
        companyLogo,
        postedDate: job.publication_date ? new Date(job.publication_date) : new Date(),
      });
    }

    console.log(`[JobFetcher/Remotive] Fetched ${jobs.length} jobs for category "${category}"`);
  } catch (err) {
    console.error('[JobFetcher/Remotive] Fetch error:', err.message);
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

module.exports = { fetchLinkedInJobs };
