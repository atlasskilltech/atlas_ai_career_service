const pool = require('../config/database');

class ContactRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO contacts (user_id, name, email, phone, company, position, linkedin_url, contact_type, notes, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.userId, data.name, data.email || null, data.phone || null, data.company || null, data.position || null, data.linkedinUrl || null, data.contactType || 'other', data.notes || null, data.followUpDate || null]
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
    await pool.execute(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async delete(id) {
    await pool.execute('DELETE FROM contacts WHERE id = ?', [id]);
  }

  async addInteraction(data) {
    const [result] = await pool.execute(
      'INSERT INTO interaction_logs (contact_id, user_id, interaction_type, notes) VALUES (?, ?, ?, ?)',
      [data.contactId, data.userId, data.interactionType || 'other', data.notes || null]
    );
    await pool.execute('UPDATE contacts SET last_contacted = CURDATE() WHERE id = ?', [data.contactId]);
    return { id: result.insertId, ...data };
  }

  async getInteractions(contactId) {
    const [rows] = await pool.execute('SELECT * FROM interaction_logs WHERE contact_id = ? ORDER BY interaction_date DESC', [contactId]);
    return rows;
  }

  async getUpcomingFollowUps(userId) {
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE user_id = ? AND follow_up_date >= CURDATE() ORDER BY follow_up_date ASC LIMIT 10', [userId]);
    return rows;
  }
}

module.exports = new ContactRepository();
