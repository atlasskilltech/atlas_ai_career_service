const pool = require('../config/database');

class UserRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_users WHERE id = ?', [id]);
    return rows[0];
  }

  async findByEmail(email) {
    const [rows] = await pool.execute('SELECT * FROM aicp_users WHERE email = ?', [email]);
    return rows[0];
  }

  async findByGoogleId(googleId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_users WHERE google_id = ?', [googleId]);
    return rows[0];
  }

  async linkGoogleId(userId, googleId) {
    await pool.execute('UPDATE aicp_users SET google_id = ?, email_verified = 1 WHERE id = ?', [googleId, userId]);
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_users (name, email, password, role, department, year_of_study, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.name, data.email, data.password, data.role || 'student', data.department || null, data.yearOfStudy || null, data.verificationToken || null]
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
    await pool.execute(`UPDATE aicp_users SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async verifyEmail(token) {
    const [rows] = await pool.execute('SELECT * FROM aicp_users WHERE verification_token = ?', [token]);
    if (rows[0]) {
      await pool.execute('UPDATE aicp_users SET email_verified = 1, verification_token = NULL WHERE id = ?', [rows[0].id]);
      return rows[0];
    }
    return null;
  }

  async setResetToken(email, token, expires) {
    await pool.execute('UPDATE aicp_users SET reset_token = ?, reset_token_expires = ? WHERE email = ?', [token, expires, email]);
  }

  async findByResetToken(token) {
    const [rows] = await pool.execute('SELECT * FROM aicp_users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
    return rows[0];
  }

  async resetPassword(id, password) {
    await pool.execute('UPDATE aicp_users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [password, id]);
  }

  async getAllStudents() {
    const [rows] = await pool.execute("SELECT id, name, email, department, year_of_study, created_at FROM aicp_users WHERE role = 'student' ORDER BY created_at DESC");
    return rows;
  }

  async getStudentCount() {
    const [rows] = await pool.execute("SELECT COUNT(*) as count FROM aicp_users WHERE role = 'student'");
    return rows[0].count;
  }

  async getStudentsByDepartment() {
    const [rows] = await pool.execute("SELECT department, COUNT(*) as count FROM aicp_users WHERE role = 'student' GROUP BY department");
    return rows;
  }

  /**
   * Check if user is active in dice_students (for students) or dice_staff (for staff/admin).
   * Returns true if active, false if inactive.
   */
  async isUserActive(email, role) {
    if (role === 'student') {
      const [rows] = await pool.execute(
        'SELECT * FROM dice_students WHERE student_email = ? AND student_active = 1',
        [email]
      );
      return rows.length > 0;
    } else {
      const [rows] = await pool.execute(
        'SELECT * FROM dice_staff WHERE staff_email = ? AND staff_active = 1',
        [email]
      );
      return rows.length > 0;
    }
  }
}

module.exports = new UserRepository();
