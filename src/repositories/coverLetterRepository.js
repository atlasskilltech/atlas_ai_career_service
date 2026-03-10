const pool = require('../config/database');

class CoverLetterRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM cover_letters WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM cover_letters WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO cover_letters (user_id, title, company_name, job_title, content, job_description) VALUES (?, ?, ?, ?, ?, ?)',
      [data.userId, data.title || 'Untitled', data.companyName || '', data.jobTitle || '', data.content || '', data.jobDescription || '']
    );
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);
    await pool.execute(`UPDATE cover_letters SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async delete(id) {
    await pool.execute('DELETE FROM cover_letters WHERE id = ?', [id]);
  }
}

module.exports = new CoverLetterRepository();
