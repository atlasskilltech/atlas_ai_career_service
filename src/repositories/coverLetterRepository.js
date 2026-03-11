const pool = require('../config/database');

class CoverLetterRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_cover_letters WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute(
      'SELECT * FROM aicp_cover_letters WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      `INSERT INTO aicp_cover_letters (user_id, resume_id, title, company_name, job_title, content, job_description, tone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.resumeId || null,
        data.title || 'Untitled',
        data.companyName || '',
        data.jobTitle || '',
        data.content || '',
        data.jobDescription || '',
        data.tone || 'professional',
      ]
    );
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    const columnMap = {
      content: 'content',
      title: 'title',
      companyName: 'company_name',
      jobTitle: 'job_title',
      jobDescription: 'job_description',
      tone: 'tone',
      version: 'version',
    };
    for (const [key, value] of Object.entries(data)) {
      const col = columnMap[key] || key;
      fields.push(`${col} = ?`);
      values.push(value);
    }
    if (!fields.length) return;
    values.push(id);
    await pool.execute(`UPDATE aicp_cover_letters SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async delete(id) {
    await pool.execute('DELETE FROM aicp_cover_letters WHERE id = ?', [id]);
  }

  async incrementVersion(id) {
    await pool.execute('UPDATE aicp_cover_letters SET version = version + 1 WHERE id = ?', [id]);
  }

  // Version history
  async createVersion(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_cover_letter_versions (cover_letter_id, version_number, content_snapshot) VALUES (?, ?, ?)',
      [data.coverLetterId, data.versionNumber, data.contentSnapshot]
    );
    return { id: result.insertId, ...data };
  }

  async getVersions(coverLetterId) {
    const [rows] = await pool.execute(
      'SELECT * FROM aicp_cover_letter_versions WHERE cover_letter_id = ? ORDER BY version_number DESC',
      [coverLetterId]
    );
    return rows;
  }

  async getVersionById(versionId) {
    const [rows] = await pool.execute(
      'SELECT * FROM aicp_cover_letter_versions WHERE id = ?',
      [versionId]
    );
    return rows[0];
  }

  // Job details
  async createJobDetail(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_cover_letter_jobs (cover_letter_id, job_description, company_name, job_role) VALUES (?, ?, ?, ?)',
      [data.coverLetterId, data.jobDescription || '', data.companyName || '', data.jobRole || '']
    );
    return { id: result.insertId, ...data };
  }

  async getJobDetail(coverLetterId) {
    const [rows] = await pool.execute(
      'SELECT * FROM aicp_cover_letter_jobs WHERE cover_letter_id = ? ORDER BY created_at DESC LIMIT 1',
      [coverLetterId]
    );
    return rows[0];
  }

  async countByUserId(userId) {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM aicp_cover_letters WHERE user_id = ?',
      [userId]
    );
    return rows[0].count;
  }
}

module.exports = new CoverLetterRepository();
