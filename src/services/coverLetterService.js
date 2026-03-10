const coverLetterRepository = require('../repositories/coverLetterRepository');
const { chatCompletion } = require('../config/openai');

class CoverLetterService {
  async getAll(userId) {
    return coverLetterRepository.findByUserId(userId);
  }

  async getById(id) {
    return coverLetterRepository.findById(id);
  }

  async generate(userId, data) {
    const prompt = `Write a professional cover letter for:

Company: ${data.companyName}
Position: ${data.jobTitle}
Job Description: ${data.jobDescription}

Candidate Resume/Background:
${data.resumeText}

Requirements:
- Professional tone, 3-4 paragraphs
- Tailored to the specific job role
- Highlight relevant skills and experiences
- Show enthusiasm for the company
- Include a clear call to action

Return ONLY the cover letter text.`;

    const content = await chatCompletion(
      'You are an expert cover letter writer who creates compelling, personalized cover letters that help candidates stand out.',
      prompt,
      { maxTokens: 1500 }
    );

    return coverLetterRepository.create({
      userId,
      title: `${data.companyName} - ${data.jobTitle}`,
      companyName: data.companyName,
      jobTitle: data.jobTitle,
      content,
      jobDescription: data.jobDescription,
    });
  }

  async update(id, data) {
    return coverLetterRepository.update(id, data);
  }

  async delete(id) {
    return coverLetterRepository.delete(id);
  }
}

module.exports = new CoverLetterService();
