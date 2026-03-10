const pool = require('../src/config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  const users = [
    ['Super Admin', 'admin@atlas.edu.in', hashedPassword, 'super_admin', 1],
    ['Placement Officer', 'placement@atlas.edu.in', hashedPassword, 'placement_admin', 1],
    ['Demo Student', 'student@atlas.edu.in', hashedPassword, 'student', 1],
  ];

  for (const user of users) {
    try {
      await pool.execute(
        'INSERT IGNORE INTO aicp_users (name, email, password, role, email_verified) VALUES (?, ?, ?, ?, ?)',
        user
      );
      console.log(`  ✓ User "${user[0]}" seeded`);
    } catch (err) {
      console.error(`  ✗ Seed error for "${user[0]}":`, err.message);
    }
  }

  console.log('Seeding complete.');
  process.exit(0);
}

seed();
