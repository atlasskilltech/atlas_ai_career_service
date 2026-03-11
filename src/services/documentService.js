const documentRepository = require('../repositories/documentRepository');
const s3 = require('../config/s3');

class DocumentService {
  async getAll(userId) {
    return documentRepository.findByUserId(userId);
  }

  async getByType(userId, docType) {
    return documentRepository.findByType(userId, docType);
  }

  async getById(id) {
    return documentRepository.findById(id);
  }

  async upload(userId, file, data) {
    const { key, url } = await s3.upload(file.buffer, file.originalname, 'documents', file.mimetype);

    return documentRepository.create({
      userId,
      title: data.title || file.originalname,
      docType: data.docType || 'other',
      filePath: url,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      notes: data.notes || null,
      s3Key: key,
    });
  }

  async update(id, data) {
    return documentRepository.update(id, data);
  }

  async delete(id) {
    const doc = await documentRepository.findById(id);
    if (doc) {
      // Delete from S3 if s3_key exists
      if (doc.s3_key) {
        try { await s3.remove(doc.s3_key); } catch (e) { console.error('S3 delete error:', e.message); }
      }
      await documentRepository.delete(id);
    }
  }

  async getStorageUsed(userId) {
    const bytes = await documentRepository.getStorageUsed(userId);
    return (bytes / (1024 * 1024)).toFixed(2); // MB
  }
}

module.exports = new DocumentService();
