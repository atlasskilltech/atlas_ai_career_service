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
      const interview = await interviewService.startInterview(req.session.user.id, req.body);
      res.json({ success: true, interview });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async session(req, res) {
    try {
      const interview = await interviewService.getById(req.params.id);
      res.render('pages/interview/session', { title: 'Interview Session', layout: 'layouts/app', interview });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/interview');
    }
  }

  async submitAnswer(req, res) {
    try {
      const result = await interviewService.submitAnswer(req.params.id, req.body.questionIndex, req.body.answer);
      res.json({ success: true, result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async complete(req, res) {
    try {
      await interviewService.completeInterview(req.params.id);
      const feedback = await interviewService.generateFeedback(req.params.id, req.session.user.id);
      res.json({ success: true, feedback });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async feedback(req, res) {
    try {
      const interview = await interviewService.getById(req.params.id);
      const feedback = await interviewService.getFeedback(req.params.id);
      res.render('pages/interview/feedback', { title: 'Interview Feedback', layout: 'layouts/app', interview, feedback });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/interview');
    }
  }

  async allFeedback(req, res) {
    try {
      const feedbacks = await interviewService.getAllFeedback(req.session.user.id);
      const avgScores = await interviewService.getAverageScores(req.session.user.id);
      res.render('pages/interview/all-feedback', { title: 'Interview History', layout: 'layouts/app', feedbacks, avgScores });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/interview');
    }
  }
}

module.exports = new InterviewController();
