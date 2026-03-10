const documentRepository = require('../repositories/documentRepository');
const path = require('path');
const fs = require('fs');

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
    return documentRepository.create({
      userId,
      title: data.title || file.originalname,
      docType: data.docType || 'other',
      filePath: `/uploads/documents/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      notes: data.notes || null,
    });
  }

  async update(id, data) {
    return documentRepository.update(id, data);
  }

  async delete(id) {
    const doc = await documentRepository.findById(id);
    if (doc) {
      const filePath = path.join(__dirname, '../../public', doc.file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await documentRepository.delete(id);
    }
  }

  async getStorageUsed(userId) {
    const bytes = await documentRepository.getStorageUsed(userId);
    return (bytes / (1024 * 1024)).toFixed(2); // MB
  }
}

module.exports = new DocumentService();
