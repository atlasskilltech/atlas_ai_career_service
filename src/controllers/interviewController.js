const interviewService = require('../services/interviewService');

class InterviewController {
  async index(req, res) {
    try {
      const interviews = await interviewService.getAll(req.session.user.id);
      const avgScores = await interviewService.getAverageScores(req.session.user.id);
      res.render('pages/interview/index', { title: 'Mock Interviews', layout: 'layouts/app', interviews, avgScores });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  getNew(req, res) {
    res.render('pages/interview/new', { title: 'Start Interview', layout: 'layouts/app' });
  }

  async start(req, res) {
    try {
      const interview = await interviewService.createInterview(req.session.user.id, req.body);
      await interviewService.generateQuestions(interview.id);
      res.json({ success: true, interviewId: interview.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async session(req, res) {
    try {
      const interview = await interviewService.getById(req.params.id);
      if (!interview) throw new Error('Interview not found');
      const { question, progress } = await interviewService.getNextQuestion(req.params.id);
      res.render('pages/interview/session', {
        title: 'Interview Session', layout: 'layouts/app',
        interview, currentQuestion: question, progress,
      });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/interview');
    }
  }

  async getQuestion(req, res) {
    try {
      const result = await interviewService.getNextQuestion(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async submitAnswer(req, res) {
    try {
      const { questionId, answerText, answerDuration } = req.body;
      const result = await interviewService.submitAnswer(req.params.id, questionId, answerText, answerDuration);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async end(req, res) {
    try {
      const result = await interviewService.completeInterview(req.params.id, req.session.user.id);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async report(req, res) {
    try {
      const data = await interviewService.getReport(req.params.id);
      if (!data.interview) throw new Error('Interview not found');
      res.render('pages/interview/report', {
        title: 'Interview Report', layout: 'layouts/app',
        ...data,
      });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/interview');
    }
  }

  async allFeedback(req, res) {
    try {
      const results = await interviewService.getResultsByUserId(req.session.user.id);
      const avgScores = await interviewService.getAverageScores(req.session.user.id);
      res.render('pages/interview/all-feedback', { title: 'Interview History', layout: 'layouts/app', results, avgScores });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/interview');
    }
  }
}

module.exports = new InterviewController();
