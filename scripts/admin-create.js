// scripts/admin-create.js
// Administrative CLI to create or grant the 'admin' role to a user (Rule 13.4).
// Reads password securely from hidden stdin. NEVER accessible via HTTP API.

import readline from 'readline';
import { ObjectId } from 'mongodb';
import { connectDB, closeDB } from '../src/db.js';
import { hashPassword, validatePassword } from '../src/utils/passwords.js';

function promptPassword(promptText) {
  return new Promise((resolve) => {
    process.stdout.write(promptText);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      let password = '';
      process.stdin.on('data', function onData(char) {
        const c = char.toString('utf-8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(password);
        } else if (c === '\u0008' || c === '\x7f') {
          password = password.slice(0, -1);
        } else if (c === '\u0003') {
          process.exit(1);
        } else {
          password += c;
        }
      });
    } else {
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: npm run admin:create -- <username>');
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    console.error('Error: Username must be 3-30 characters (letters, numbers, underscore).');
    process.exit(1);
  }

  const password = await promptPassword(`Enter password for admin user "${username}": `);
  const passCheck = validatePassword(password, { username });
  if (!passCheck.valid) {
    console.error(`Error: ${passCheck.message}`);
    process.exit(1);
  }

  const db = await connectDB();
  const usernameLower = username.toLowerCase();
  const existing = await db.collection('users').findOne({ usernameLower });

  const passwordHash = await hashPassword(password);
  const now = new Date();

  if (existing) {
    await db.collection('users').updateOne(
      { _id: existing._id },
      { $set: { role: 'admin', passwordHash, updatedAt: now } }
    );
    console.log(`✅ Existing user "${username}" upgraded to role "admin".`);
  } else {
    const newAdmin = {
      _id: new ObjectId(),
      username,
      usernameLower,
      displayName: `Admin ${username}`,
      passwordHash,
      role: 'admin',
      acceptedTermsVersion: '1.0',
      acceptedTermsAt: now,
      createdAt: now,
      lastLoginAt: null
    };
    await db.collection('users').insertOne(newAdmin);
    console.log(`✅ Admin user "${username}" created successfully.`);
  }

  await db.collection('admin_audit').insertOne({
    adminId: 'CLI',
    action: 'admin_create',
    target: usernameLower,
    timestamp: now
  });

  await closeDB();
}

main().catch((err) => {
  console.error('Fatal admin creation error:', err.message);
  process.exit(1);
});
