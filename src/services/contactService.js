const contactRepository = require('../repositories/contactRepository');

class ContactService {
  async getAll(userId) {
    return contactRepository.findByUserId(userId);
  }

  async getById(id) {
    const contact = await contactRepository.findById(id);
    if (!contact) throw new Error('Contact not found');
    contact.interactions = await contactRepository.getInteractions(id);
    return contact;
  }

  async create(userId, data) {
    return contactRepository.create({ userId, ...data });
  }

  async update(id, data) {
    return contactRepository.update(id, data);
  }

  async delete(id) {
    return contactRepository.delete(id);
  }

  async addInteraction(data) {
    return contactRepository.addInteraction(data);
  }

  async getUpcomingFollowUps(userId) {
    return contactRepository.getUpcomingFollowUps(userId);
  }
}

module.exports = new ContactService();
