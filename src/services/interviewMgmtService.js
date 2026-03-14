const { v4: uuidv4 } = require('uuid');
const interviewRepo = require('../repositories/interviewMgmtRepo');
const calendarService = require('./calendarService');
const { sendMail } = require('../config/email');
const { chatCompletion } = require('../config/openai');

class InterviewMgmtService {
  // ─── Schedule interviews ───────────────────────────────
  async scheduleInterviews(data, createdBy) {
    const studentIds = Array.isArray(data.student_ids) ? data.student_ids : [data.student_ids];
    const results = [];

    for (const studentId of studentIds) {
      const feedbackToken = uuidv4();
      const tokenExpiry = new Date();
      tokenExpiry.setDate(tokenExpiry.getDate() + 30);

      const id = await interviewRepo.create({
        job_id: data.job_id,
        application_id: data.application_id || null,
        student_id: studentId,
        recruiter_id: data.recruiter_id || null,
        interview_type: data.interview_type,
        round_number: data.round_number || 1,
        round_name: data.round_name || null,
        scheduled_date: data.scheduled_date,
        scheduled_time: data.scheduled_time,
        duration_minutes: data.duration_minutes || 60,
        mode: data.mode,
        meet_link: data.meet_link || null,
        venue: data.venue || null,
        notes: data.notes || null,
        feedback_token: feedbackToken,
        feedback_token_expires: tokenExpiry,
        created_by: createdBy,
      });

      const interview = await interviewRepo.findById(id);
      results.push(interview);

      // Send confirmation emails (non-blocking)
      this.sendConfirmationEmails(interview).catch(err =>
        console.error('Interview confirmation email error:', err.message)
      );
    }

    return results;
  }

  // ─── Send confirmation emails + ICS ────────────────────
  async sendConfirmationEmails(interview) {
    const icsContent = calendarService.generateICS(interview);
    const dateStr = new Date(interview.scheduled_date).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const timeStr = interview.scheduled_time.substring(0, 5);

    // Student email
    if (interview.student_email) {
      try {
        await sendMail({
          to: interview.student_email,
          subject: `Interview Scheduled: ${interview.role_title} at ${interview.company_name}`,
          html: this.buildInterviewEmailHtml({
            recipientName: interview.student_name,
            roleTitle: interview.role_title,
            companyName: interview.company_name,
            dateStr,
            timeStr,
            duration: interview.duration_minutes,
            mode: interview.mode,
            meetLink: interview.meet_link,
            venue: interview.venue,
            interviewType: interview.interview_type,
            roundNumber: interview.round_number,
            roundName: interview.round_name,
            notes: interview.notes,
            type: 'confirmation',
          }),
          attachments: [{
            filename: 'interview.ics',
            content: icsContent,
            contentType: 'text/calendar; method=REQUEST',
          }],
        });
        await interviewRepo.logNotification({
          interview_id: interview.id,
          notification_type: 'confirmation',
          recipient_email: interview.student_email,
          recipient_type: 'student',
          status: 'sent',
        });
      } catch (err) {
        await interviewRepo.logNotification({
          interview_id: interview.id,
          notification_type: 'confirmation',
          recipient_email: interview.student_email,
          recipient_type: 'student',
          status: 'failed',
          error_message: err.message,
        });
      }
    }

    // Recruiter email
    if (interview.recruiter_email) {
      try {
        await sendMail({
          to: interview.recruiter_email,
          subject: `Interview Scheduled: ${interview.student_name} for ${interview.role_title}`,
          html: this.buildInterviewEmailHtml({
            recipientName: interview.recruiter_contact || 'Hiring Manager',
            roleTitle: interview.role_title,
            companyName: interview.company_name,
            studentName: interview.student_name,
            dateStr,
            timeStr,
            duration: interview.duration_minutes,
            mode: interview.mode,
            meetLink: interview.meet_link,
            venue: interview.venue,
            interviewType: interview.interview_type,
            roundNumber: interview.round_number,
            roundName: interview.round_name,
            notes: interview.notes,
            type: 'confirmation',
            isRecruiter: true,
            feedbackLink: `${process.env.BASE_URL || 'https://careerconnect.atlasskilltech.app'}/admin/interviews/feedback/${interview.feedback_token}`,
          }),
          attachments: [{
            filename: 'interview.ics',
            content: icsContent,
            contentType: 'text/calendar; method=REQUEST',
          }],
        });
        await interviewRepo.logNotification({
          interview_id: interview.id,
          notification_type: 'confirmation',
          recipient_email: interview.recruiter_email,
          recipient_type: 'recruiter',
          status: 'sent',
        });
      } catch (err) {
        await interviewRepo.logNotification({
          interview_id: interview.id,
          notification_type: 'confirmation',
          recipient_email: interview.recruiter_email,
          recipient_type: 'recruiter',
          status: 'failed',
          error_message: err.message,
        });
      }
    }
  }

  // ─── Reschedule ────────────────────────────────────────
  async reschedule(id, data) {
    const old = await interviewRepo.findById(id);
    if (!old) throw new Error('Interview not found');

    // Cancel old
    await interviewRepo.updateStatus(id, 'rescheduled', 'Rescheduled to new date/time');

    // Send cancellation ICS
    if (old.student_email) {
      const cancelICS = calendarService.generateCancellationICS(old);
      sendMail({
        to: old.student_email,
        subject: `Interview Rescheduled: ${old.role_title} at ${old.company_name}`,
        html: this.buildInterviewEmailHtml({
          recipientName: old.student_name,
          roleTitle: old.role_title,
          companyName: old.company_name,
          type: 'reschedule',
          newDate: data.scheduled_date,
          newTime: data.scheduled_time,
        }),
        attachments: [{
          filename: 'cancel.ics',
          content: cancelICS,
          contentType: 'text/calendar; method=CANCEL',
        }],
      }).catch(err => console.error('Reschedule cancel email error:', err.message));
    }

    // Create new interview
    const newData = {
      job_id: old.job_id,
      application_id: old.application_id,
      student_id: old.student_id,
      recruiter_id: old.recruiter_id,
      interview_type: data.interview_type || old.interview_type,
      round_number: data.round_number || old.round_number,
      round_name: data.round_name || old.round_name,
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time,
      duration_minutes: data.duration_minutes || old.duration_minutes,
      mode: data.mode || old.mode,
      meet_link: data.meet_link || old.meet_link,
      venue: data.venue || old.venue,
      notes: data.notes || old.notes,
      created_by: data.created_by || old.created_by,
    };

    const feedbackToken = uuidv4();
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 30);
    newData.feedback_token = feedbackToken;
    newData.feedback_token_expires = tokenExpiry;

    const newId = await interviewRepo.create(newData);
    const newInterview = await interviewRepo.findById(newId);

    // Send new confirmation
    this.sendConfirmationEmails(newInterview).catch(err =>
      console.error('Reschedule confirmation error:', err.message)
    );

    return newInterview;
  }

  // ─── Submit feedback ───────────────────────────────────
  async submitFeedback(interviewId, feedbackData) {
    const criteria = [
      { name: 'Technical Knowledge', rating: parseInt(feedbackData.technical_score) || 0, comments: feedbackData.technical_comments },
      { name: 'Communication', rating: parseInt(feedbackData.communication_score) || 0, comments: feedbackData.communication_comments },
      { name: 'Problem Solving', rating: parseInt(feedbackData.problem_solving_score) || 0, comments: feedbackData.problem_solving_comments },
      { name: 'Culture Fit', rating: parseInt(feedbackData.culture_fit_score) || 0, comments: feedbackData.culture_fit_comments },
    ];

    const overall = Math.round(criteria.reduce((s, c) => s + c.rating, 0) / criteria.length);

    // Save criteria
    await interviewRepo.saveFeedbackCriteria(interviewId, criteria);

    // Generate AI summary
    let aiSummary = null;
    try {
      aiSummary = await this.generateAISummary(feedbackData, criteria, overall);
    } catch (err) {
      console.error('AI feedback summary error:', err.message);
    }

    // Update interview
    await interviewRepo.update(interviewId, {
      technical_score: criteria[0].rating,
      communication_score: criteria[1].rating,
      problem_solving_score: criteria[2].rating,
      culture_fit_score: criteria[3].rating,
      overall_score: overall,
      recommendation: feedbackData.recommendation,
      feedback_comments: feedbackData.comments || null,
      ai_feedback_summary: aiSummary,
      feedback_submitted: 1,
      status: 'completed',
    });

    // Update pipeline stage based on recommendation
    const interview = await interviewRepo.findById(interviewId);
    if (interview && interview.application_id) {
      await this.updatePipelineFromFeedback(interview, feedbackData.recommendation);
    }

    return { overall, aiSummary };
  }

  // ─── AI Summary ────────────────────────────────────────
  async generateAISummary(feedbackData, criteria, overallScore) {
    const prompt = `Summarize this interview feedback concisely (3-4 sentences):
Scores (out of 5): ${criteria.map(c => `${c.name}: ${c.rating}`).join(', ')}
Overall: ${overallScore}/5
Recommendation: ${(feedbackData.recommendation || '').replace(/_/g, ' ')}
Comments: ${feedbackData.comments || 'None'}
${criteria.filter(c => c.comments).map(c => `${c.name} notes: ${c.comments}`).join('\n')}`;

    const summary = await chatCompletion(
      'You are an HR analyst. Summarize interview feedback concisely and professionally.',
      prompt,
      { model: 'gpt-4o-mini', maxTokens: 300 }
    );
    return summary;
  }

  // ─── Update pipeline from feedback ─────────────────────
  async updatePipelineFromFeedback(interview, recommendation) {
    const pool = require('../config/database');
    const stageMap = {
      strongly_recommend: 'offered',
      recommend: 'offered',
      on_hold: 'interview',
      reject: 'rejected',
    };
    const newStage = stageMap[recommendation];
    if (!newStage) return;

    await pool.execute(
      'UPDATE aicp_admin_job_applications SET stage = ? WHERE id = ?',
      [newStage, interview.application_id]
    );
  }

  // ─── Send reminders ────────────────────────────────────
  async sendReminders(hoursAhead) {
    const type = hoursAhead === 24 ? 'reminder_24h' : 'reminder_1h';
    const interviews = await interviewRepo.getUpcomingForReminders(hoursAhead);

    for (const interview of interviews) {
      const dateStr = new Date(interview.scheduled_date).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      const timeStr = interview.scheduled_time.substring(0, 5);

      if (interview.student_email) {
        try {
          await sendMail({
            to: interview.student_email,
            subject: `Reminder: Interview ${hoursAhead === 1 ? 'in 1 hour' : 'tomorrow'} - ${interview.role_title} at ${interview.company_name}`,
            html: this.buildInterviewEmailHtml({
              recipientName: interview.student_name,
              roleTitle: interview.role_title,
              companyName: interview.company_name,
              dateStr,
              timeStr,
              duration: interview.duration_minutes,
              mode: interview.mode,
              meetLink: interview.meet_link,
              venue: interview.venue,
              type: 'reminder',
              hoursAhead,
            }),
          });
          await interviewRepo.logNotification({
            interview_id: interview.id,
            notification_type: type,
            recipient_email: interview.student_email,
            recipient_type: 'student',
            status: 'sent',
          });
        } catch (err) {
          await interviewRepo.logNotification({
            interview_id: interview.id,
            notification_type: type,
            recipient_email: interview.student_email,
            recipient_type: 'student',
            status: 'failed',
            error_message: err.message,
          });
        }
      }
    }
    return interviews.length;
  }

  // ─── Email HTML builder ────────────────────────────────
  buildInterviewEmailHtml(opts) {
    const headerColor = opts.type === 'reschedule' ? '#f59e0b'
      : opts.type === 'cancellation' ? '#ef4444'
      : opts.type === 'reminder' ? '#8b5cf6'
      : '#10b981';

    const title = opts.type === 'confirmation' ? 'Interview Scheduled'
      : opts.type === 'reschedule' ? 'Interview Rescheduled'
      : opts.type === 'cancellation' ? 'Interview Cancelled'
      : opts.type === 'reminder' ? `Interview Reminder${opts.hoursAhead === 1 ? ' - 1 Hour' : ' - Tomorrow'}`
      : 'Interview Update';

    let body = '';
    if (opts.type === 'reschedule') {
      body = `<p style="color:#555;font-size:14px;line-height:1.7;">Your interview for <strong>${opts.roleTitle}</strong> at <strong>${opts.companyName}</strong> has been rescheduled.</p>
        <p style="color:#555;font-size:14px;">New schedule details will be shared shortly.</p>`;
    } else {
      body = `
        <p style="color:#555;font-size:14px;line-height:1.7;">
          ${opts.isRecruiter ? `An interview has been scheduled with <strong>${opts.studentName}</strong> for` : 'Your interview for'}
          <strong> ${opts.roleTitle}</strong> at <strong>${opts.companyName}</strong> has been ${opts.type === 'reminder' ? 'confirmed' : 'scheduled'}.
        </p>
        <div style="background:#f8f9fa;border-radius:12px;padding:20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;width:120px;">Date</td><td style="color:#333;font-size:14px;font-weight:600;">${opts.dateStr}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Time</td><td style="color:#333;font-size:14px;font-weight:600;">${opts.timeStr} IST</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Duration</td><td style="color:#333;font-size:14px;">${opts.duration} minutes</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Mode</td><td style="color:#333;font-size:14px;text-transform:capitalize;">${opts.mode}</td></tr>
            ${opts.interviewType ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Type</td><td style="color:#333;font-size:14px;text-transform:capitalize;">${opts.interviewType.replace(/_/g, ' ')}</td></tr>` : ''}
            ${opts.roundNumber ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Round</td><td style="color:#333;font-size:14px;">${opts.roundNumber}${opts.roundName ? ' - ' + opts.roundName : ''}</td></tr>` : ''}
            ${opts.mode === 'online' && opts.meetLink ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Join Link</td><td><a href="${opts.meetLink}" style="color:#10b981;font-size:14px;font-weight:600;">Join Meeting</a></td></tr>` : ''}
            ${opts.mode === 'onsite' && opts.venue ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Venue</td><td style="color:#333;font-size:14px;">${opts.venue}</td></tr>` : ''}
          </table>
        </div>
        ${opts.notes ? `<p style="color:#888;font-size:13px;border-left:3px solid #e5e7eb;padding-left:12px;margin:16px 0;">${opts.notes}</p>` : ''}
        ${opts.feedbackLink ? `<div style="text-align:center;margin:24px 0;"><a href="${opts.feedbackLink}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Submit Feedback</a></div>` : ''}
      `;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f4f7;">
      <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#01103d,#1a2b5f);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#a3e635;font-size:22px;font-weight:700;">ATLAS Career Platform</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">${title}</p>
        </div>
        <div style="text-align:center;padding:24px 32px 0;">
          <span style="display:inline-block;background:${headerColor};color:#fff;padding:6px 20px;border-radius:20px;font-size:14px;font-weight:600;">${title}</span>
        </div>
        <div style="padding:20px 32px 28px;">
          <p style="color:#333;font-size:15px;line-height:1.6;">Hi <strong>${opts.recipientName}</strong>,</p>
          ${body}
        </div>
        <div style="background:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;color:#999;font-size:12px;">Atlas SkillTech University - Career Services</p>
          <p style="margin:4px 0 0;color:#bbb;font-size:11px;">This is an automated notification. Please do not reply.</p>
        </div>
      </div>
    </body></html>`;
  }
}

module.exports = new InterviewMgmtService();
