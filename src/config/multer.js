const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

function createUploader(destFolder, allowedTypes) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dest = path.join(__dirname, '../../public/uploads', destFolder);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  };

  return multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
}

const resumeUpload = createUploader('resumes', [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const documentUpload = createUploader('documents', [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const profileUpload = createUploader('profiles', ['image/jpeg', 'image/png', 'image/webp']);

module.exports = { resumeUpload, documentUpload, profileUpload };
