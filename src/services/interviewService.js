const interviewRepository = require('../repositories/interviewRepository');
const { chatCompletion } = require('../config/openai');

class InterviewService {
  async getAll(userId) {
    return interviewRepository.findByUserId(userId);
  }

  async getById(id) {
    const interview = await interviewRepository.findById(id);
    if (!interview) throw new Error('Interview not found');
    if (interview.questions && typeof interview.questions === 'string') interview.questions = JSON.parse(interview.questions);
    if (interview.answers && typeof interview.answers === 'string') interview.answers = JSON.parse(interview.answers);
    return interview;
  }

  async startInterview(userId, data) {
    const prompt = `Generate 5 interview questions for a ${data.interviewType} interview for the role of ${data.jobRole || 'Software Engineer'}. Return as JSON array of strings.

Return ONLY a JSON array like: ["Question 1?", "Question 2?", ...]`;

    const response = await chatCompletion(
      `You are an expert interviewer conducting a ${data.interviewType} interview. Generate challenging but fair questions.`,
      prompt,
      { temperature: 0.7 }
    );

    let questions;
    try {
      questions = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      questions = [
        'Tell me about yourself.',
        'What are your strengths and weaknesses?',
        'Describe a challenging project you worked on.',
        'Where do you see yourself in 5 years?',
        'Do you have any questions for us?',
      ];
    }

    return interviewRepository.create({
      userId,
      interviewType: data.interviewType || 'behavioral',
      mode: data.mode || 'text',
      jobRole: data.jobRole,
      questions,
      answers: [],
    });
  }

  async submitAnswer(interviewId, questionIndex, answer) {
    const interview = await this.getById(interviewId);
    const answers = interview.answers || [];
    answers[questionIndex] = answer;
    await interviewRepository.update(interviewId, { answers });
    return { questionIndex, answer };
  }

  async completeInterview(interviewId) {
    await interviewRepository.update(interviewId, { status: 'completed' });
    return this.getById(interviewId);
  }

  async generateFeedback(interviewId, userId) {
    const interview = await this.getById(interviewId);

    const transcript = interview.questions.map((q, i) =>
      `Q: ${q}\nA: ${interview.answers[i] || 'No answer provided'}`
    ).join('\n\n');

    const prompt = `Evaluate this interview transcript and return JSON:
{
  "confidenceScore": (0-100),
  "communicationScore": (0-100),
  "technicalScore": (0-100),
  "starScore": (0-100),
  "overallScore": (0-100),
  "feedbackText": "detailed feedback paragraph",
  "suggestions": ["specific improvement suggestions"]
}

Interview Type: ${interview.interview_type}
Role: ${interview.job_role || 'General'}

TRANSCRIPT:
${transcript}

Return ONLY valid JSON.`;

    const response = await chatCompletion(
      'You are an expert interview coach. Evaluate responses and provide constructive, actionable feedback.',
      prompt,
      { temperature: 0.4 }
    );

    let feedback;
    try {
      feedback = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      feedback = {
        confidenceScore: 50, communicationScore: 50, technicalScore: 50,
        starScore: 50, overallScore: 50, feedbackText: 'Analysis could not be completed.',
        suggestions: ['Please try again.'],
      };
    }

    return interviewRepository.saveFeedback({
      interviewId,
      userId,
      ...feedback,
    });
  }

  async getFeedback(interviewId) {
    return interviewRepository.getFeedback(interviewId);
  }

  async getAllFeedback(userId) {
    return interviewRepository.getFeedbackByUserId(userId);
  }

  async getAverageScores(userId) {
    return interviewRepository.getAverageScores(userId);
  }
}

module.exports = new InterviewService();
