const documentService = require('../services/documentService');

class DocumentController {
  async index(req, res) {
    try {
      const documents = await documentService.getAll(req.session.user.id);
      const storageUsed = await documentService.getStorageUsed(req.session.user.id);
      res.render('pages/documents/index', { title: 'Document Hub', layout: 'layouts/app', documents, storageUsed });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  async upload(req, res) {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const doc = await documentService.upload(req.session.user.id, req.file, req.body);
      res.json({ success: true, document: doc });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async update(req, res) {
    try {
      await documentService.update(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      await documentService.delete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new DocumentController();
