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
    const defaultQuestions = {
      technical: [
        'Explain the difference between a stack and a queue. When would you use each?',
        'How would you design a URL shortening service?',
        'What is the time complexity of common sorting algorithms? Which would you choose for a nearly sorted array?',
        'Describe how you would debug a production issue that only occurs intermittently.',
        'What are SOLID principles? Can you give an example of each?',
      ],
      behavioral: [
        'Tell me about yourself and your career journey.',
        'Describe a time you faced a significant challenge at work and how you overcame it.',
        'Tell me about a time you had a conflict with a team member. How did you resolve it?',
        'Give an example of a goal you set and how you achieved it.',
        'Where do you see yourself in 5 years?',
      ],
      hr: [
        'Why are you interested in this role and our company?',
        'What are your salary expectations?',
        'How do you handle work-life balance?',
        'What motivates you in your professional life?',
        'Do you have any questions for us about the company culture?',
      ],
      case_study: [
        'A company is seeing declining user engagement. How would you approach diagnosing the problem?',
        'How would you estimate the market size for electric vehicles in India?',
        'A startup needs to decide between two revenue models. Walk me through your decision framework.',
        'How would you prioritize features for a new product launch with limited resources?',
        'Describe how you would measure the success of a new feature after launch.',
      ],
    };

    let questions;
    try {
      const prompt = `Generate 5 interview questions for a ${data.interviewType} interview for the role of ${data.jobRole || 'Software Engineer'}. Return as JSON array of strings.

Return ONLY a JSON array like: ["Question 1?", "Question 2?", ...]`;

      const response = await chatCompletion(
        `You are an expert interviewer conducting a ${data.interviewType} interview. Generate challenging but fair questions.`,
        prompt,
        { temperature: 0.7 }
      );

      questions = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      questions = defaultQuestions[data.interviewType] || defaultQuestions.behavioral;
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

    let feedback;
    try {
      const response = await chatCompletion(
        'You are an expert interview coach. Evaluate responses and provide constructive, actionable feedback.',
        prompt,
        { temperature: 0.4 }
      );

      feedback = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      feedback = {
        confidenceScore: 50, communicationScore: 50, technicalScore: 50,
        starScore: 50, overallScore: 50,
        feedbackText: 'AI analysis is currently unavailable. Please ensure the OpenAI API key is configured.',
        suggestions: ['Configure the OPENAI_API_KEY in your .env file for AI-powered feedback.'],
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
