const multer = require('multer');

const ALLOWED_DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];

function createMemoryUploader(allowedTypes) {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Allowed: ' + allowedTypes.join(', ')), false);
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  });
}

// Resume upload (memory storage for parsing + S3 upload)
const resumeMemoryUpload = createMemoryUploader([
  ...ALLOWED_DOCS,
]);

const resumeUpload = createMemoryUploader([...ALLOWED_DOCS]);

const documentUpload = createMemoryUploader([...ALLOWED_DOCS, 'image/jpeg', 'image/png']);

const profileUpload = createMemoryUploader(ALLOWED_IMAGES);

module.exports = { resumeUpload, resumeMemoryUpload, documentUpload, profileUpload };
