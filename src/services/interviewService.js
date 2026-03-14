const interviewRepository = require('../repositories/interviewRepository');
const { chatCompletion } = require('../config/openai');

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'so', 'well', 'I mean', 'kind of', 'sort of'];
const MAX_QUESTIONS = 12;

class InterviewService {
  // --- CRUD ---
  async getAll(userId) {
    return interviewRepository.findByUserId(userId);
  }

  async getById(id) {
    return interviewRepository.findById(id);
  }

  async getQuestionById(questionId) {
    return interviewRepository.getQuestion(questionId);
  }

  async getAverageScores(userId) {
    return interviewRepository.getAverageScores(userId);
  }

  async getResultsByUserId(userId) {
    return interviewRepository.getResultsByUserId(userId);
  }

  // --- Interview Creation ---
  async createInterview(userId, data) {
    const interview = await interviewRepository.create({
      userId,
      jobRole: data.jobRole || 'Software Engineer',
      company: data.company || null,
      interviewType: data.interviewType || 'behavioral',
      difficulty: data.difficulty || 'medium',
    });
    return interview;
  }

  // --- Generate Initial Questions ---
  async generateQuestions(interviewId) {
    const interview = await interviewRepository.findById(interviewId);
    if (!interview) throw new Error('Interview not found');

    const questionCount = interview.difficulty === 'easy' ? 8 : interview.difficulty === 'hard' ? 12 : 10;

    let questions;
    try {
      const prompt = `Generate ${questionCount} interview questions for a ${interview.interview_type.replace('_', ' ')} interview.
Role: ${interview.job_role}
${interview.company ? 'Company: ' + interview.company : ''}
Difficulty: ${interview.difficulty}

Requirements:
- Start with an icebreaker question
- Gradually increase difficulty
- Mix different sub-topics relevant to the interview type
- For technical: include coding concepts, system design, and problem-solving
- For behavioral: use STAR method prompts
- For HR: include culture fit and motivation questions
- For case study: include analytical and strategic questions

Return ONLY a JSON array of question strings like: ["Question 1?", "Question 2?", ...]`;

      const response = await chatCompletion(
        `You are an expert interviewer at ${interview.company || 'a top tech company'} conducting a ${interview.difficulty} difficulty ${interview.interview_type} interview for a ${interview.job_role} position.`,
        prompt,
        { temperature: 0.7, maxTokens: 2000 }
      );
      questions = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      questions = this._getDefaultQuestions(interview.interview_type, interview.difficulty);
    }

    const saved = await interviewRepository.addQuestions(interviewId, questions);
    await interviewRepository.updateInterview(interviewId, {
      status: 'in_progress',
      total_questions: questions.length,
      started_at: new Date(),
    });

    return saved;
  }

  // --- Get Next Question ---
  async getNextQuestion(interviewId) {
    const questions = await interviewRepository.getQuestions(interviewId);
    const answers = await interviewRepository.getAnswers(interviewId);
    const answeredIds = new Set(answers.map(a => a.question_id));
    const next = questions.find(q => !answeredIds.has(q.id));
    return {
      question: next || null,
      progress: { answered: answers.length, total: questions.length },
      isComplete: !next,
    };
  }

  // --- Submit Answer & Generate Follow-up ---
  async submitAnswer(interviewId, questionId, answerText, answerDuration) {
    const interview = await interviewRepository.findById(interviewId);
    if (!interview) throw new Error('Interview not found');

    const question = await interviewRepository.getQuestion(questionId);
    if (!question) throw new Error('Question not found');

    // Analyze answer metrics
    const wordCount = answerText.trim().split(/\s+/).length;
    const fillerCount = this._countFillerWords(answerText);

    await interviewRepository.saveAnswer({
      questionId,
      interviewId,
      answerText,
      answerDuration: answerDuration || 0,
      fillerWordsCount: fillerCount,
      wordCount,
    });

    // Update answered count
    const answerCount = await interviewRepository.getAnswerCount(interviewId);
    await interviewRepository.updateInterview(interviewId, { total_answered: answerCount });

    // Get next question
    return this.getNextQuestion(interviewId);
  }

  // --- Complete Interview & Generate Report ---
  async completeInterview(interviewId, userId) {
    const interview = await interviewRepository.findById(interviewId);
    if (!interview) throw new Error('Interview not found');

    const answers = await interviewRepository.getAnswers(interviewId);
    const duration = interview.started_at
      ? Math.floor((Date.now() - new Date(interview.started_at).getTime()) / 1000)
      : 0;

    await interviewRepository.updateInterview(interviewId, {
      status: 'completed',
      completed_at: new Date(),
      duration_seconds: duration,
    });

    // Build transcript
    const transcript = answers.map((a, i) =>
      `Q${i + 1}: ${a.question}\nA${i + 1}: ${a.answer_text || 'No answer provided'}\n(Duration: ${a.answer_duration_seconds}s, Words: ${a.word_count}, Fillers: ${a.filler_words_count})`
    ).join('\n\n');

    const totalFillers = answers.reduce((s, a) => s + (a.filler_words_count || 0), 0);
    const avgWordCount = answers.length > 0 ? Math.round(answers.reduce((s, a) => s + (a.word_count || 0), 0) / answers.length) : 0;

    let result;
    try {
      const prompt = `Evaluate this ${interview.interview_type} interview for a ${interview.job_role} position (${interview.difficulty} difficulty).

TRANSCRIPT:
${transcript}

METRICS:
- Total questions answered: ${answers.length}
- Average word count per answer: ${avgWordCount}
- Total filler words used: ${totalFillers}
- Interview duration: ${Math.floor(duration / 60)} minutes

Return a JSON object with:
{
  "technicalScore": (0-100),
  "communicationScore": (0-100),
  "confidenceScore": (0-100),
  "problemSolvingScore": (0-100),
  "overallScore": (0-100),
  "strengths": ["list of 3-5 specific strengths"],
  "weaknesses": ["list of 3-5 specific areas to improve"],
  "suggestions": ["list of 5-7 actionable improvement tips"],
  "detailedFeedback": "A 3-4 paragraph comprehensive feedback covering performance, areas of improvement, and career advice",
  "questionFeedback": [
    {"questionIndex": 1, "rating": "good/average/needs_improvement", "comment": "brief feedback for this specific answer"}
  ]
}

Be specific and constructive. Reference actual answers in feedback. Return ONLY valid JSON.`;

      const response = await chatCompletion(
        'You are a senior interview coach and hiring manager. Provide detailed, constructive, and actionable feedback.',
        prompt,
        { temperature: 0.4, maxTokens: 3000 }
      );
      result = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      result = {
        technicalScore: 50, communicationScore: 50, confidenceScore: 50,
        problemSolvingScore: 50, overallScore: 50,
        strengths: ['Completed the interview'], weaknesses: ['AI analysis unavailable'],
        suggestions: ['Configure OPENAI_API_KEY for detailed AI feedback'],
        detailedFeedback: 'AI analysis is currently unavailable. Please configure the OpenAI API key for detailed feedback.',
        questionFeedback: [],
      };
    }

    return interviewRepository.saveResult({
      interviewId,
      userId,
      ...result,
    });
  }

  // --- Get Report ---
  async getReport(interviewId) {
    const interview = await interviewRepository.findById(interviewId);
    const result = await interviewRepository.getResult(interviewId);
    const answers = await interviewRepository.getAnswers(interviewId);
    const questions = await interviewRepository.getQuestions(interviewId);
    return { interview, result, answers, questions };
  }

  // --- Private: Generate Follow-up ---
  async _generateFollowUp(interview, question, answer, nextOrder) {
    try {
      const prompt = `The candidate gave a brief answer to an interview question. Generate ONE contextual follow-up question to probe deeper.

Original Question: ${question}
Candidate Answer: ${answer}
Interview Type: ${interview.interview_type}
Role: ${interview.job_role}

Return ONLY the follow-up question as a plain string, no quotes or JSON.`;

      const followUpText = await chatCompletion(
        'You are an expert interviewer. Ask probing follow-up questions to get deeper insights.',
        prompt,
        { temperature: 0.6, maxTokens: 200 }
      );

      if (followUpText && followUpText.trim().length > 10) {
        return interviewRepository.addQuestion({
          interviewId: interview.id,
          question: followUpText.trim().replace(/^["']|["']$/g, ''),
          questionOrder: nextOrder,
          isFollowUp: true,
          parentQuestionId: null,
        });
      }
    } catch {}
    return null;
  }

  // --- Private: Count Filler Words ---
  _countFillerWords(text) {
    const lower = text.toLowerCase();
    let count = 0;
    for (const word of FILLER_WORDS) {
      const regex = new RegExp('\\b' + word + '\\b', 'gi');
      const matches = lower.match(regex);
      if (matches) count += matches.length;
    }
    return count;
  }

  // --- Private: Default Questions ---
  _getDefaultQuestions(type, difficulty) {
    const defaults = {
      technical: [
        'Tell me about your technical background and experience.',
        'Explain REST API architecture and its core principles.',
        'What is the event loop in Node.js and how does it work?',
        'Compare SQL and NoSQL databases. When would you choose one over the other?',
        'Explain the concept of microservices architecture.',
        'How would you design a URL shortening service?',
        'What are SOLID principles? Give examples.',
        'Describe how you would optimize a slow database query.',
        'What is the difference between authentication and authorization?',
        'How do you handle error handling in production applications?',
      ],
      behavioral: [
        'Tell me about yourself and your career journey so far.',
        'Describe a challenging project you worked on. What was your role?',
        'Tell me about a time you had to deal with a difficult team member.',
        'Give an example of when you had to learn a new technology quickly.',
        'Describe a situation where you had to meet a tight deadline.',
        'Tell me about a time you failed. What did you learn?',
        'How do you prioritize tasks when you have multiple deadlines?',
        'Describe a situation where you showed leadership.',
        'Tell me about a time you received constructive criticism.',
        'Give an example of an innovative solution you proposed.',
      ],
      hr: [
        'Tell me about yourself.',
        'Why are you interested in this role?',
        'Where do you see yourself in 5 years?',
        'What are your greatest strengths?',
        'What is your biggest weakness and how are you working on it?',
        'Why should we hire you over other candidates?',
        'What salary range are you expecting?',
        'How do you handle work-life balance?',
        'What motivates you professionally?',
        'Do you have any questions about the company or role?',
      ],
      case_study: [
        'How would you approach designing a food delivery platform?',
        'A company is seeing declining user engagement. How would you diagnose the problem?',
        'How would you estimate the market size for electric vehicles in India?',
        'How would you improve the recommendation system for a streaming platform?',
        'Design a strategy to increase user retention for a mobile app.',
        'A startup needs to choose between two revenue models. Walk me through your framework.',
        'How would you prioritize features for a new product launch?',
        'Describe how you would measure the success of a new feature.',
        'A company wants to expand to a new market. What factors would you consider?',
        'How would you reduce customer churn by 20%?',
      ],
    };

    const count = difficulty === 'easy' ? 8 : difficulty === 'hard' ? 12 : 10;
    const questions = defaults[type] || defaults.behavioral;
    return questions.slice(0, count);
  }
}

module.exports = new InterviewService();
