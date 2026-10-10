// scripts/admin-reset-password.js
// Administrative CLI to securely reset a user password (Rule 13.4).
// Reads new password from hidden stdin and invalidates existing sessions.

import readline from 'readline';
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
    console.error('Usage: npm run admin:reset-password -- <username>');
    process.exit(1);
  }

  const db = await connectDB();
  const usernameLower = username.toLowerCase();
  const user = await db.collection('users').findOne({ usernameLower });

  if (!user) {
    console.error(`Error: User "${username}" not found.`);
    await closeDB();
    process.exit(1);
  }

  const password = await promptPassword(`Enter new password for "${username}": `);
  const passCheck = validatePassword(password, { username: user.username, displayName: user.displayName });
  if (!passCheck.valid) {
    console.error(`Error: ${passCheck.message}`);
    await closeDB();
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  // Update password and invalidate all active sessions
  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { passwordHash, updatedAt: now } }
  );

  const deleteSessionsResult = await db.collection('sessions').deleteMany({ userId: user._id });

  await db.collection('admin_audit').insertOne({
    adminId: 'CLI',
    action: 'admin_reset_password',
    target: usernameLower,
    sessionsInvalidated: deleteSessionsResult.deletedCount,
    timestamp: now
  });

  console.log(`✅ Password successfully reset for "${username}". Invalidated ${deleteSessionsResult.deletedCount} existing sessions.`);
  await closeDB();
}

main().catch((err) => {
  console.error('Fatal password reset error:', err.message);
  process.exit(1);
});
