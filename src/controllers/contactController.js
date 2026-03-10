const contactService = require('../services/contactService');

class ContactController {
  async index(req, res) {
    try {
      const contacts = await contactService.getAll(req.session.user.id);
      const followUps = await contactService.getUpcomingFollowUps(req.session.user.id);
      res.render('pages/networking/index', { title: 'Networking CRM', layout: 'layouts/app', contacts, followUps });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  async view(req, res) {
    try {
      const contact = await contactService.getById(req.params.id);
      res.render('pages/networking/view', { title: contact.name, layout: 'layouts/app', contact });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/networking');
    }
  }

  async create(req, res) {
    try {
      const contact = await contactService.create(req.session.user.id, req.body);
      res.json({ success: true, contact });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async update(req, res) {
    try {
      await contactService.update(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      await contactService.delete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async addInteraction(req, res) {
    try {
      const interaction = await contactService.addInteraction({
        contactId: req.params.id,
        userId: req.session.user.id,
        ...req.body,
      });
      res.json({ success: true, interaction });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new ContactController();
