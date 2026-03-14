const { sendMail } = require('../config/email');

class NotificationService {
  getStageLabel(stage) {
    const labels = {
      applied: 'Application Received',
      shortlisted: 'Shortlisted',
      interview: 'Interview Stage',
      offered: 'Offer Extended',
      rejected: 'Application Update',
      withdrawn: 'Application Withdrawn',
    };
    return labels[stage] || stage;
  }

  getStageColor(stage) {
    const colors = {
      applied: '#3b82f6',
      shortlisted: '#8b5cf6',
      interview: '#f59e0b',
      offered: '#10b981',
      rejected: '#ef4444',
      withdrawn: '#6b7280',
    };
    return colors[stage] || '#6b7280';
  }

  getStageMessage(stage, companyName, roleTitle) {
    const messages = {
      applied: `Your application for <strong>${roleTitle}</strong> at <strong>${companyName}</strong> has been received. We will review your profile and get back to you soon.`,
      shortlisted: `Congratulations! You have been <strong>shortlisted</strong> for the position of <strong>${roleTitle}</strong> at <strong>${companyName}</strong>. Please stay tuned for further updates.`,
      interview: `Great news! You have been moved to the <strong>Interview stage</strong> for <strong>${roleTitle}</strong> at <strong>${companyName}</strong>. Details regarding the interview schedule will be shared shortly.`,
      offered: `We are delighted to inform you that you have received an <strong>offer</strong> for the position of <strong>${roleTitle}</strong> at <strong>${companyName}</strong>! Please check your email for the offer details.`,
      rejected: `Thank you for your interest in the <strong>${roleTitle}</strong> position at <strong>${companyName}</strong>. After careful consideration, we regret to inform you that we will not be moving forward with your application at this time.`,
      withdrawn: `Your application for <strong>${roleTitle}</strong> at <strong>${companyName}</strong> has been marked as withdrawn.`,
    };
    return messages[stage] || `Your application status for ${roleTitle} at ${companyName} has been updated to ${stage}.`;
  }

  buildEmailHtml(studentName, stage, companyName, roleTitle, reason) {
    const stageLabel = this.getStageLabel(stage);
    const stageColor = this.getStageColor(stage);
    const stageMessage = this.getStageMessage(stage, companyName, roleTitle);

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f4f4f7;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#01103d,#1a2b5f);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#a3e635;font-size:22px;font-weight:700;">ATLAS Career Platform</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Application Status Update</p>
        </div>

        <!-- Status Badge -->
        <div style="text-align:center;padding:24px 32px 0;">
          <span style="display:inline-block;background:${stageColor};color:#fff;padding:6px 20px;border-radius:20px;font-size:14px;font-weight:600;letter-spacing:0.5px;">
            ${stageLabel}
          </span>
        </div>

        <!-- Content -->
        <div style="padding:20px 32px 28px;">
          <p style="color:#333;font-size:15px;line-height:1.6;">Hi <strong>${studentName}</strong>,</p>
          <p style="color:#555;font-size:14px;line-height:1.7;">${stageMessage}</p>
          ${reason ? `<div style="background:#f8f9fa;border-left:3px solid ${stageColor};padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;"><p style="margin:0;color:#666;font-size:13px;"><strong>Note:</strong> ${reason}</p></div>` : ''}
          <p style="color:#555;font-size:14px;line-height:1.7;margin-top:20px;">
            You can track your application status on the <a href="#" style="color:${stageColor};text-decoration:none;font-weight:600;">Career Platform</a>.
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f8f9fa;padding:16px 32px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;color:#999;font-size:12px;">Atlas SkillTech University - Career Services</p>
          <p style="margin:4px 0 0;color:#bbb;font-size:11px;">This is an automated notification. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>`;
  }

  async notifyStageChange(applicantInfo, toStage, reason) {
    if (!applicantInfo || !applicantInfo.email) return;

    try {
      const subject = `Application Update: ${this.getStageLabel(toStage)} - ${applicantInfo.role_title} at ${applicantInfo.company_name}`;
      const html = this.buildEmailHtml(
        applicantInfo.name,
        toStage,
        applicantInfo.company_name,
        applicantInfo.role_title,
        reason
      );

      await sendMail({
        to: applicantInfo.email,
        subject,
        html,
      });
      console.log(`Pipeline notification sent to ${applicantInfo.email} for stage: ${toStage}`);
    } catch (err) {
      console.error('Pipeline notification error:', err.message);
      // Don't throw - notification failure shouldn't block stage change
    }
  }
}

module.exports = new NotificationService();
