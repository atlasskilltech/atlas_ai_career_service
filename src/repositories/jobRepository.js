const pool = require('../config/database');

class JobRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_jobs WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_jobs WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows;
  }

  async findByStatus(userId, status) {
    const [rows] = await pool.execute('SELECT * FROM aicp_jobs WHERE user_id = ? AND status = ? ORDER BY updated_at DESC', [userId, status]);
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_jobs (user_id, company, position, location, url, salary_range, description, status, applied_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.userId, data.company, data.position, data.location || null, data.url || null, data.salaryRange || null, data.description || null, data.status || 'saved', data.appliedDate || null, data.notes || null]
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
    await pool.execute(`UPDATE aicp_jobs SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async updateStatus(id, status) {
    await pool.execute('UPDATE aicp_jobs SET status = ? WHERE id = ?', [status, id]);
  }

  async delete(id) {
    await pool.execute('DELETE FROM aicp_jobs WHERE id = ?', [id]);
  }

  async getCountByStatus(userId) {
    const [rows] = await pool.execute('SELECT status, COUNT(*) as count FROM aicp_jobs WHERE user_id = ? GROUP BY status', [userId]);
    return rows;
  }

  async getTotalApplications() {
    const [rows] = await pool.execute("SELECT COUNT(*) as count FROM aicp_jobs WHERE status != 'saved'");
    return rows[0].count;
  }

  async getInterviewCount(userId) {
    const [rows] = await pool.execute("SELECT COUNT(*) as count FROM aicp_jobs WHERE user_id = ? AND status = 'interview'", [userId]);
    return rows[0].count;
  }

  async getTasks(jobId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_job_tasks WHERE job_id = ? ORDER BY due_date ASC', [jobId]);
    return rows;
  }

  async addTask(data) {
    const [result] = await pool.execute('INSERT INTO aicp_job_tasks (job_id, title, due_date) VALUES (?, ?, ?)', [data.jobId, data.title, data.dueDate || null]);
    return { id: result.insertId, ...data };
  }

  async toggleTask(taskId) {
    await pool.execute('UPDATE aicp_job_tasks SET completed = NOT completed WHERE id = ?', [taskId]);
  }

  async deleteTask(taskId) {
    await pool.execute('DELETE FROM aicp_job_tasks WHERE id = ?', [taskId]);
  }
}

module.exports = new JobRepository();
