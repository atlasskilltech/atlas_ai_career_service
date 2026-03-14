const interviewRepo = require('../repositories/interviewMgmtRepo');
const interviewService = require('../services/interviewMgmtService');

class InterviewMgmtController {
  // ─── List page ─────────────────────────────────────────
  async listPage(req, res) {
    try {
      const query = req.query;
      const filters = {
        search: query.search,
        status: query.status,
        interview_type: query.interview_type,
        mode: query.mode,
        date_from: query.date_from,
        date_to: query.date_to,
        company: query.company,
        sort: query.sort || 'newest',
        page: query.page || 1,
        limit: 50,
      };

      const { interviews, total, page, limit } = await interviewRepo.findAll(filters);
      const stats = await interviewRepo.getStats();
      const filterOptions = await interviewRepo.getFilterOptions();
      const jobs = await interviewRepo.getActiveJobs();
      const recruiters = await interviewRepo.getRecruiters();
      const totalPages = Math.ceil(total / limit);

      res.render('pages/admin/interviews/list', {
        title: 'Interview Management',
        layout: 'layouts/admin',
        interviews,
        stats,
        total,
        page,
        totalPages,
        query,
        filterOptions,
        jobs,
        recruiters,
      });
    } catch (err) {
      console.error('Interview list error:', err);
      req.flash('error', 'Failed to load interviews');
      res.redirect('/admin');
    }
  }

  // ─── Calendar page ─────────────────────────────────────
  async calendarPage(req, res) {
    try {
      const jobs = await interviewRepo.getActiveJobs();
      const recruiters = await interviewRepo.getRecruiters();
      const stats = await interviewRepo.getStats();

      res.render('pages/admin/interviews/calendar', {
        title: 'Interview Calendar',
        layout: 'layouts/admin',
        jobs,
        recruiters,
        stats,
      });
    } catch (err) {
      console.error('Calendar page error:', err);
      req.flash('error', 'Failed to load calendar');
      res.redirect('/admin/interviews');
    }
  }

  // ─── Feedback page (public, token-based) ───────────────
  async feedbackPage(req, res) {
    try {
      const interview = await interviewRepo.findByFeedbackToken(req.params.token);
      if (!interview) {
        return res.render('pages/admin/interviews/feedback', {
          title: 'Interview Feedback',
          layout: 'layouts/admin',
          interview: null,
          error: 'Invalid or expired feedback link.',
        });
      }

      const criteria = await interviewRepo.getFeedbackCriteria(interview.id);

      res.render('pages/admin/interviews/feedback', {
        title: 'Interview Feedback',
        layout: 'layouts/admin',
        interview,
        criteria,
        error: null,
      });
    } catch (err) {
      console.error('Feedback page error:', err);
      res.render('pages/admin/interviews/feedback', {
        title: 'Interview Feedback',
        layout: 'layouts/admin',
        interview: null,
        error: 'Something went wrong. Please try again.',
      });
    }
  }

  // ─── API: Schedule interviews ──────────────────────────
  async apiSchedule(req, res) {
    try {
      const data = req.body;
      if (!data.job_id || !data.student_ids || !data.scheduled_date || !data.scheduled_time) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const results = await interviewService.scheduleInterviews(data, req.session.user.id);
      res.json({ success: true, interviews: results });
    } catch (err) {
      console.error('Schedule interview error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Get interviews (JSON) ────────────────────────
  async apiList(req, res) {
    try {
      const result = await interviewRepo.findAll(req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Calendar events ──────────────────────────────
  async apiCalendar(req, res) {
    try {
      const { start, end } = req.query;
      if (!start || !end) {
        return res.status(400).json({ error: 'start and end dates required' });
      }
      const interviews = await interviewRepo.findForCalendar(start, end);

      const statusColors = {
        scheduled: '#3b82f6',
        confirmed: '#6366f1',
        in_progress: '#f59e0b',
        completed: '#10b981',
        cancelled: '#ef4444',
        rescheduled: '#f97316',
        no_show: '#6b7280',
      };

      const events = interviews.map(i => {
        const start = `${i.scheduled_date.toISOString().split('T')[0]}T${i.scheduled_time}`;
        const endDate = new Date(new Date(start).getTime() + i.duration_minutes * 60000);
        return {
          id: i.id,
          title: `${i.student_name} - ${i.company_name} (${i.role_title})`,
          start,
          end: endDate.toISOString(),
          color: statusColors[i.status] || '#6b7280',
          extendedProps: {
            status: i.status,
            interview_type: i.interview_type,
            mode: i.mode,
            round_number: i.round_number,
            student_name: i.student_name,
            company_name: i.company_name,
            role_title: i.role_title,
          },
        };
      });

      res.json(events);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Get interview detail ─────────────────────────
  async apiDetail(req, res) {
    try {
      const interview = await interviewRepo.findById(req.params.id);
      if (!interview) return res.status(404).json({ error: 'Interview not found' });

      const criteria = await interviewRepo.getFeedbackCriteria(interview.id);
      res.json({ success: true, interview, criteria });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Reschedule ───────────────────────────────────
  async apiReschedule(req, res) {
    try {
      const newInterview = await interviewService.reschedule(req.params.id, {
        ...req.body,
        created_by: req.session.user.id,
      });
      res.json({ success: true, interview: newInterview });
    } catch (err) {
      console.error('Reschedule error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Update status ────────────────────────────────
  async apiUpdateStatus(req, res) {
    try {
      const { status, reason } = req.body;
      if (!status) return res.status(400).json({ error: 'Status is required' });

      await interviewRepo.updateStatus(req.params.id, status, reason);

      // Send cancellation email if cancelled
      if (status === 'cancelled') {
        const interview = await interviewRepo.findById(req.params.id);
        if (interview && interview.student_email) {
          const { sendMail } = require('../config/email');
          const calendarService = require('../services/calendarService');
          const cancelICS = calendarService.generateCancellationICS(interview);
          sendMail({
            to: interview.student_email,
            subject: `Interview Cancelled: ${interview.role_title} at ${interview.company_name}`,
            html: interviewService.buildInterviewEmailHtml({
              recipientName: interview.student_name,
              roleTitle: interview.role_title,
              companyName: interview.company_name,
              type: 'cancellation',
            }),
            attachments: [{
              filename: 'cancel.ics',
              content: cancelICS,
              contentType: 'text/calendar; method=CANCEL',
            }],
          }).catch(err => console.error('Cancel email error:', err.message));
        }
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Submit feedback ──────────────────────────────
  async apiSubmitFeedback(req, res) {
    try {
      const interviewId = req.params.id;
      const result = await interviewService.submitFeedback(interviewId, req.body);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('Submit feedback error:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Get shortlisted students for a job ──────────
  async apiStudentsForJob(req, res) {
    try {
      const students = await interviewRepo.getShortlistedStudents(req.params.jobId);
      res.json({ success: true, students });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Send feedback link to recruiter ──────────────
  async apiSendFeedbackLink(req, res) {
    try {
      const interview = await interviewRepo.findById(req.params.id);
      if (!interview) return res.status(404).json({ error: 'Interview not found' });

      const email = req.body.email || interview.recruiter_email;
      if (!email) return res.status(400).json({ error: 'No email provided' });

      const baseUrl = process.env.BASE_URL || 'https://careerconnect.atlasskilltech.app';
      const feedbackLink = `${baseUrl}/admin/interviews/feedback/${interview.feedback_token}`;

      const { sendMail } = require('../config/email');
      await sendMail({
        to: email,
        subject: `Feedback Request: ${interview.student_name} - ${interview.role_title}`,
        html: interviewService.buildInterviewEmailHtml({
          recipientName: interview.recruiter_contact || 'Hiring Manager',
          roleTitle: interview.role_title,
          companyName: interview.company_name,
          studentName: interview.student_name,
          type: 'confirmation',
          isRecruiter: true,
          feedbackLink,
          dateStr: new Date(interview.scheduled_date).toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          }),
          timeStr: interview.scheduled_time.substring(0, 5),
          duration: interview.duration_minutes,
          mode: interview.mode,
          meetLink: interview.meet_link,
          venue: interview.venue,
        }),
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── API: Delete interview ─────────────────────────────
  async apiDelete(req, res) {
    try {
      await interviewRepo.delete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new InterviewMgmtController();
