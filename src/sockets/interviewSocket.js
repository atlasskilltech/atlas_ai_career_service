const interviewService = require('../services/interviewService');
const { textToSpeech, speechToText } = require('../config/openai');
const path = require('path');
const fs = require('fs');

function setupInterviewSocket(io) {
  const interviewNs = io.of('/interview');

  interviewNs.on('connection', (socket) => {
    let interviewId = null;

    socket.on('join', async (data) => {
      interviewId = data.interviewId;
      socket.join(`interview:${interviewId}`);
      socket.emit('joined', { interviewId });
    });

    // Client requests to speak the current question
    socket.on('speak-question', async (data) => {
      try {
        const questionId = data.questionId;
        const audioDir = path.join(__dirname, '../../uploads/tts/');
        const audioPath = path.join(audioDir, `q_${questionId}.mp3`);

        // Generate TTS if not cached
        if (!fs.existsSync(audioPath)) {
          const question = await interviewService.getQuestionById(questionId);
          if (!question) {
            socket.emit('speak-error', { error: 'Question not found' });
            return;
          }
          socket.emit('avatar-state', { state: 'thinking' });
          await textToSpeech(question.question, audioPath);
        }

        // Send audio URL for the client to play
        socket.emit('avatar-state', { state: 'speaking' });
        socket.emit('question-audio-ready', {
          questionId,
          audioUrl: `/interview/${interviewId}/question/${questionId}/audio`,
        });
      } catch (err) {
        socket.emit('speak-error', { error: err.message });
        socket.emit('avatar-state', { state: 'idle' });
      }
    });

    // Audio speaking finished
    socket.on('speak-done', () => {
      socket.emit('avatar-state', { state: 'listening' });
    });

    // Client sends recorded audio for transcription
    socket.on('transcribe', async (data) => {
      let tmpPath = null;
      try {
        if (!data.audio || data.audio.byteLength < 1000) {
          socket.emit('transcribe-result', { success: false, error: 'Audio too short. Please speak louder or longer.' });
          socket.emit('avatar-state', { state: 'listening' });
          return;
        }

        socket.emit('avatar-state', { state: 'thinking' });
        socket.emit('transcribe-status', { status: 'processing' });

        // Save audio buffer to temp file
        const tmpDir = path.join(__dirname, '../../uploads/audio/');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        tmpPath = path.join(tmpDir, `ws_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`);
        fs.writeFileSync(tmpPath, Buffer.from(data.audio));

        const text = await speechToText(tmpPath);
        try { fs.unlinkSync(tmpPath); } catch {}
        tmpPath = null;

        if (!text || text.trim().length === 0) {
          socket.emit('transcribe-result', { success: false, error: 'No speech detected. Please speak clearly near the microphone.' });
          socket.emit('avatar-state', { state: 'listening' });
          return;
        }

        socket.emit('transcribe-result', { success: true, text });
        socket.emit('avatar-state', { state: 'listening' });
      } catch (err) {
        if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch {} }
        const userMsg = err.message && err.message.includes('timeout')
          ? 'Transcription timed out. Please try again.'
          : 'Transcription failed. Please try again or type your answer.';
        socket.emit('transcribe-result', { success: false, error: userMsg });
        socket.emit('avatar-state', { state: 'listening' });
      }
    });

    // Client submits answer
    socket.on('submit-answer', async (data) => {
      try {
        socket.emit('avatar-state', { state: 'thinking' });

        const result = await interviewService.submitAnswer(
          interviewId,
          data.questionId,
          data.answerText,
          data.answerDuration
        );

        if (result.isComplete || !result.question) {
          socket.emit('interview-complete', { progress: result.progress });
          socket.emit('avatar-state', { state: 'idle' });
        } else {
          socket.emit('next-question', {
            question: result.question,
            progress: result.progress,
          });
        }
      } catch (err) {
        socket.emit('answer-error', { error: err.message });
        socket.emit('avatar-state', { state: 'idle' });
      }
    });

    // Client ends interview
    socket.on('end-interview', async (data) => {
      try {
        socket.emit('avatar-state', { state: 'thinking' });
        const result = await interviewService.completeInterview(interviewId, data.userId);
        socket.emit('interview-ended', { success: true, result });
      } catch (err) {
        socket.emit('interview-ended', { success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      if (interviewId) socket.leave(`interview:${interviewId}`);
    });
  });
}

module.exports = setupInterviewSocket;
