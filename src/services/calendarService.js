/**
 * Calendar Service — Generates ICS calendar invites for interviews
 */
const { v4: uuidv4 } = require('uuid');

class CalendarService {
  /**
   * Generate ICS calendar content for an interview
   */
  generateICS(interview) {
    const uid = uuidv4();
    const now = this.formatDateToICS(new Date());

    const startDate = new Date(`${interview.scheduled_date}T${interview.scheduled_time}`);
    const endDate = new Date(startDate.getTime() + (interview.duration_minutes || 60) * 60000);

    const dtStart = this.formatDateToICS(startDate);
    const dtEnd = this.formatDateToICS(endDate);

    const summary = `Interview: ${interview.role_title} - ${interview.company_name}`;
    const description = this.buildDescription(interview);
    const location = interview.mode === 'online'
      ? (interview.meet_link || 'Online')
      : (interview.venue || 'TBD');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ATLAS Career Platform//Interview//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${this.escapeICS(summary)}`,
      `DESCRIPTION:${this.escapeICS(description)}`,
      `LOCATION:${this.escapeICS(location)}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Interview in 30 minutes',
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT10M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Interview in 10 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  /**
   * Generate cancellation ICS
   */
  generateCancellationICS(interview) {
    const uid = uuidv4();
    const now = this.formatDateToICS(new Date());
    const startDate = new Date(`${interview.scheduled_date}T${interview.scheduled_time}`);
    const dtStart = this.formatDateToICS(startDate);

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ATLAS Career Platform//Interview//EN',
      'METHOD:CANCEL',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `SUMMARY:CANCELLED: Interview - ${interview.role_title} at ${interview.company_name}`,
      'STATUS:CANCELLED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  formatDateToICS(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  escapeICS(str) {
    return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  buildDescription(interview) {
    const lines = [
      `Role: ${interview.role_title}`,
      `Company: ${interview.company_name}`,
      `Type: ${(interview.interview_type || '').replace(/_/g, ' ')}`,
      `Round: ${interview.round_number}${interview.round_name ? ' - ' + interview.round_name : ''}`,
      `Duration: ${interview.duration_minutes} minutes`,
      `Mode: ${interview.mode}`,
    ];
    if (interview.mode === 'online' && interview.meet_link) {
      lines.push(`Meeting Link: ${interview.meet_link}`);
    }
    if (interview.mode === 'onsite' && interview.venue) {
      lines.push(`Venue: ${interview.venue}`);
    }
    if (interview.notes) {
      lines.push(`Notes: ${interview.notes}`);
    }
    return lines.join('\\n');
  }
}

module.exports = new CalendarService();
