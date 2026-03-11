const pool = require('../config/database');

class DocumentRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_documents WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_documents WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows;
  }

  async findByType(userId, docType) {
    const [rows] = await pool.execute('SELECT * FROM aicp_documents WHERE user_id = ? AND doc_type = ? ORDER BY updated_at DESC', [userId, docType]);
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_documents (user_id, title, doc_type, file_path, file_name, file_size, mime_type, notes, s3_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.userId, data.title, data.docType || 'other', data.filePath, data.fileName, data.fileSize || 0, data.mimeType || '', data.notes || null, data.s3Key || null]
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
    await pool.execute(`UPDATE aicp_documents SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async delete(id) {
    await pool.execute('DELETE FROM aicp_documents WHERE id = ?', [id]);
  }

  async getStorageUsed(userId) {
    const [rows] = await pool.execute('SELECT SUM(file_size) as total FROM aicp_documents WHERE user_id = ?', [userId]);
    return rows[0].total || 0;
  }
}

module.exports = new DocumentRepository();
