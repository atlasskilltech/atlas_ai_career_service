const repo = require('../repositories/skillGapRepo');
const { chatCompletion } = require('../config/openai');

class SkillGapAnalysisService {
  // ─── Recompute all demand + gap data ─────────────────────

  async recompute(filters = {}) {
    await repo.computeDemand();
    await repo.computeGap(filters);
    await repo.clearCache();
    return { success: true };
  }

  // ─── Dashboard data (all in one call) ────────────────────

  async getDashboardData(filters = {}) {
    const [summary, topDemanded, topGaps, demandVsSupply, emerging, filterOptions] = await Promise.all([
      repo.getSummary(),
      repo.getTopDemanded(10),
      repo.getTopGaps(10, filters),
      repo.getDemandVsSupply(15),
      repo.getEmergingSkills(),
      repo.getFilterOptions()
    ]);
    return { summary, topDemanded, topGaps, demandVsSupply, emerging, filterOptions };
  }

  async getTrends() {
    return repo.getTrends(5);
  }

  async getHeatmapData() {
    const raw = await repo.getHeatmapData();
    // Transform: { departments: [...], skills: [...], matrix: [[]] }
    const deptSet = new Set();
    const skillSet = new Set();
    const gapMap = {};

    raw.forEach(r => {
      deptSet.add(r.department);
      skillSet.add(r.skill_name);
      const key = `${r.department}||${r.skill_name}`;
      const gap = r.demand > 0 ? Math.max(0, Math.round(((r.demand - r.supply) / r.demand) * 100)) : 0;
      gapMap[key] = gap;
    });

    const departments = Array.from(deptSet).sort();
    // Limit to top 20 most-demanded skills
    const skillDemand = {};
    raw.forEach(r => { skillDemand[r.skill_name] = (skillDemand[r.skill_name] || 0) + r.demand; });
    const skills = Object.entries(skillDemand)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(e => e[0]);

    const matrix = departments.map(dept =>
      skills.map(skill => gapMap[`${dept}||${skill}`] || 0)
    );

    return { departments, skills, matrix };
  }

  // ─── AI Insights (cached 24hrs) ──────────────────────────

  async getAIInsights(forceRefresh = false) {
    const cacheKey = 'ai_skill_gap_insights';

    if (!forceRefresh) {
      const cached = await repo.getCache(cacheKey);
      if (cached) return cached;
    }

    // Gather data for prompt
    const [topGaps, topDemanded, emerging, summary] = await Promise.all([
      repo.getTopGaps(15),
      repo.getTopDemanded(10),
      repo.getEmergingSkills(),
      repo.getSummary()
    ]);

    const gapData = topGaps.map(g => `${g.skill_name}: demand=${g.demand_count}, supply=${g.supply_count}, gap=${g.gap_score}%, priority=${g.priority}`).join('\n');
    const demandData = topDemanded.map(d => `${d.skill_name}: demand=${d.demand_count}, supply=${d.supply_count}`).join('\n');
    const emergingData = emerging.map(e => `${e.skill_name}: demand=${e.demand_count}, first seen ${new Date(e.first_seen_at).toLocaleDateString()}`).join('\n');

    const systemPrompt = `You are an expert education and career advisor at a university placement cell. Analyze skill gap data and provide actionable insights. Respond ONLY in valid JSON format.`;

    const userPrompt = `Analyze this skill gap data for our university:

SUMMARY: ${summary.total_skills} skills tracked, ${summary.critical_gaps} critical gaps, avg gap ${summary.avg_gap}%

TOP SKILL GAPS:
${gapData}

TOP DEMANDED SKILLS:
${demandData}

EMERGING SKILLS (new in last 30 days):
${emergingData}

Respond in this exact JSON format:
{
  "landscape_summary": "3 paragraphs analyzing the overall skill gap landscape, trends, and implications for the university",
  "training_recommendations": [
    { "title": "recommendation title", "skill": "target skill", "justification": "why this is important", "urgency": "critical|high|medium" }
  ],
  "course_mapping": [
    { "skill": "skill name", "platform": "Coursera|Udemy|edX|etc", "course_name": "specific course", "url": "course URL" }
  ]
}

Provide exactly 5 training recommendations and 8-10 course mappings. Focus on practical, actionable advice.`;

    try {
      const response = await chatCompletion(systemPrompt, userPrompt, {
        model: 'gpt-4o-mini',
        temperature: 0.6,
        maxTokens: 3000,
        timeout: 40000
      });

      let insights;
      try {
        const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        insights = JSON.parse(cleaned);
      } catch (parseErr) {
        insights = {
          landscape_summary: response,
          training_recommendations: [],
          course_mapping: []
        };
      }

      // Cache for 24 hours
      await repo.setCache(cacheKey, insights, 24);
      return insights;
    } catch (err) {
      console.error('AI Insights error:', err.message);
      // Return a fallback
      return {
        landscape_summary: 'AI insights are temporarily unavailable. Please try again later or click "Refresh Insights".',
        training_recommendations: [],
        course_mapping: [],
        error: err.message
      };
    }
  }

  // ─── Export data ─────────────────────────────────────────

  async exportGapReport(filters = {}) {
    const ExcelJS = require('exceljs');
    const gaps = await repo.getAllGaps(filters);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Skill Gap Report');

    ws.columns = [
      { header: 'Skill', key: 'skill_name', width: 25 },
      { header: 'Demand Count', key: 'demand_count', width: 15 },
      { header: 'Supply Count', key: 'supply_count', width: 15 },
      { header: 'Gap Score (%)', key: 'gap_score', width: 15 },
      { header: 'Priority', key: 'priority', width: 12 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Program', key: 'program', width: 20 },
      { header: 'Grad Year', key: 'graduation_year', width: 12 },
      { header: 'Computed At', key: 'computed_at', width: 20 }
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };

    gaps.forEach(g => {
      const row = ws.addRow(g);
      // Color priority cell
      const prCell = row.getCell('priority');
      const colorMap = { critical: 'FFDC2626', high: 'FFCA8A04', medium: 'FF2563EB', low: 'FF16A34A' };
      prCell.font = { color: { argb: colorMap[g.priority] || 'FF000000' }, bold: true };
    });

    return wb;
  }

  // ─── Filter options ──────────────────────────────────────

  async getFilterOptions() {
    return repo.getFilterOptions();
  }
}

module.exports = new SkillGapAnalysisService();
