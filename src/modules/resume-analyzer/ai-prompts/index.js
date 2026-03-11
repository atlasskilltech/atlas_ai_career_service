/**
 * AI Prompts for Resume ATS Analyzer
 * Specialized prompts for each analysis type
 */

const systemPrompt = `You are an expert ATS (Applicant Tracking System) analyzer and career advisor for a university career platform. You analyze resumes against job descriptions with precision and provide actionable, specific feedback. Always return valid JSON. Never include markdown code blocks in your response.`;

const keywordMatchPrompt = (resumeText, jobDescription) => `Analyze and compare this resume against the job description for keyword matching.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Extract all important keywords, technical skills, tools, and technologies from the job description. Then check which ones are present in the resume.

Return ONLY valid JSON with this exact structure:
{
  "matched_keywords": [{"keyword": "string", "category": "technical|soft_skill|tool|certification|domain"}],
  "missing_keywords": [{"keyword": "string", "category": "technical|soft_skill|tool|certification|domain"}],
  "keyword_density": {
    "total_jd_keywords": 0,
    "matched_count": 0,
    "match_percentage": 0
  }
}`;

const skillGapPrompt = (resumeText, jobDescription) => `Analyze the following resume and job description to identify skill gaps.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Identify all skills required by the job description, categorize them, and determine which are present or missing in the resume.

Return ONLY valid JSON:
{
  "existing_skills": [{"skill": "string", "proficiency": "strong|moderate|basic"}],
  "missing_skills": [{"skill": "string", "importance": "critical|recommended|nice_to_have"}],
  "recommended_skills": [{"skill": "string", "reason": "string"}],
  "skills_match_percentage": 0
}`;

const formattingAnalysisPrompt = (resumeText) => `Analyze this resume for formatting and structure issues that could affect ATS parsing.

RESUME:
${resumeText}

Check for:
- Long paragraphs instead of bullet points
- Missing section headers (Summary, Experience, Education, Skills)
- Inconsistent formatting patterns
- Overly long resume (ideally 1-2 pages worth of content)
- Lack of measurable achievements/metrics
- Use of tables, columns, or complex formatting
- Missing contact information
- Inappropriate use of graphics/special characters references

Return ONLY valid JSON:
{
  "issues": [
    {"type": "string", "description": "string", "severity": "high|medium|low"}
  ],
  "sections_detected": ["string"],
  "has_bullet_points": true,
  "has_metrics": true,
  "estimated_length": "short|optimal|long",
  "formatting_score": 0
}`;

const contentQualityPrompt = (resumeText) => `Analyze the quality of content in this resume. Focus on the strength of language, use of action verbs, measurable impact, and overall professionalism.

RESUME:
${resumeText}

Identify:
- Weak verbs that should be replaced with strong action verbs
- Passive sentences that should be active
- Statements lacking measurable impact
- Generic phrases that could be more specific

Return ONLY valid JSON:
{
  "weak_statements": [
    {"original": "string", "improved": "string", "reason": "string"}
  ],
  "strong_verbs_used": ["string"],
  "missing_action_verbs": ["string"],
  "content_score": 0,
  "has_measurable_impact": true,
  "passive_sentence_count": 0
}`;

const resumeImprovementPrompt = (resumeText, jobDescription, analysisContext) => `Based on this comprehensive analysis context, provide specific, actionable improvement suggestions for this resume to maximize ATS compatibility.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

ANALYSIS CONTEXT:
${analysisContext}

Provide categorized, prioritized improvement suggestions.

Return ONLY valid JSON:
{
  "formatting_improvements": [{"suggestion": "string", "priority": "high|medium|low"}],
  "content_improvements": [{"suggestion": "string", "priority": "high|medium|low", "example": "string"}],
  "missing_sections": ["string"],
  "keyword_suggestions": [{"keyword": "string", "where_to_add": "string"}],
  "overall_recommendations": ["string"]
}`;

const experienceRelevancePrompt = (resumeText, jobDescription) => `Evaluate how relevant the experience described in this resume is to the job description.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON:
{
  "relevance_score": 0,
  "relevant_experiences": [{"experience": "string", "relevance": "high|medium|low"}],
  "irrelevant_experiences": [{"experience": "string", "suggestion": "string"}],
  "experience_gaps": ["string"]
}`;

module.exports = {
  systemPrompt,
  keywordMatchPrompt,
  skillGapPrompt,
  formattingAnalysisPrompt,
  contentQualityPrompt,
  resumeImprovementPrompt,
  experienceRelevancePrompt,
};
