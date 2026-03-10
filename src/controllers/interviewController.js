const interviewService = require('../services/interviewService');
const { textToSpeech, speechToText } = require('../config/openai');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const audioUpload = multer({
  dest: path.join(__dirname, '../../uploads/audio/'),
  limits: { fileSize: 25 * 1024 * 1024 },
});

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

  // TTS: Generate and serve audio for a question
  async questionAudio(req, res) {
    try {
      const questionId = req.params.qid;
      const audioDir = path.join(__dirname, '../../uploads/tts/');
      const audioPath = path.join(audioDir, `q_${questionId}.mp3`);

      // Serve cached audio if exists
      if (fs.existsSync(audioPath)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        return fs.createReadStream(audioPath).pipe(res);
      }

      // Generate TTS
      const question = await interviewService.getQuestionById(questionId);
      if (!question) return res.status(404).json({ error: 'Question not found' });

      await textToSpeech(question.question, audioPath);
      res.setHeader('Content-Type', 'audio/mpeg');
      fs.createReadStream(audioPath).pipe(res);
    } catch (err) {
      res.status(500).json({ error: 'TTS generation failed: ' + err.message });
    }
  }

  // Whisper: Transcribe uploaded audio
  async transcribe(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

      // Rename to .webm for Whisper compatibility
      const ext = '.webm';
      const newPath = req.file.path + ext;
      fs.renameSync(req.file.path, newPath);

      const text = await speechToText(newPath);

      // Cleanup temp file
      try { fs.unlinkSync(newPath); } catch {}

      res.json({ success: true, text });
    } catch (err) {
      // Cleanup on error
      if (req.file) try { fs.unlinkSync(req.file.path); fs.unlinkSync(req.file.path + '.webm'); } catch {}
      res.status(500).json({ error: 'Transcription failed: ' + err.message });
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

const controller = new InterviewController();
module.exports = { controller, audioUpload };
