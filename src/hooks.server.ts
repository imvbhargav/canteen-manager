import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userSessions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { hashSessionToken } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  console.log('\n--- HOOK EXECUTING ---');
  
  // 1. Check if SvelteKit sees the cookie
  const sessionToken = event.cookies.get('session_id');
  console.log('1. Raw Cookie Token:', sessionToken ? 'FOUND' : 'MISSING');

  if (!sessionToken) {
    event.locals.user = null;
    event.locals.sessionId = null;
    return resolve(event);
  }

  // 2. Check the hash generation
  const tokenHash = hashSessionToken(sessionToken);
  console.log('2. Generated Token Hash:', tokenHash);

  // 3. Database Lookup
  const sessionRecord = await db.query.userSessions.findFirst({
    where: and(
      eq(userSessions.tokenHash, tokenHash),
      eq(userSessions.isRevoked, false)
    ),
    with: {
      user: {
        columns: { id: true, studentId: true, name: true, isActive: true }
      }
    }
  });

  console.log('3. DB Session Record:', sessionRecord ? 'FOUND' : 'MISSING OR REVOKED');

  if (sessionRecord) {
     console.log('4. User attached to session:', !!sessionRecord.user);
     console.log('5. User is active:', sessionRecord.user?.isActive);
  }

  if (sessionRecord && sessionRecord.user && sessionRecord.user.isActive) {
    console.log('-> SUCCESS: Attaching user to locals');
    event.locals.user = {
      id: sessionRecord.user.id,
      studentId: sessionRecord.user.studentId,
      name: sessionRecord.user.name
    };
    event.locals.sessionId = sessionRecord.id;
  } else {
    console.log('-> FAIL: Clearing locals and deleting cookie');
    event.locals.user = null;
    event.locals.sessionId = null;
    event.cookies.delete('session_id', { path: '/' });
  }

  console.log('----------------------\n');
  return resolve(event);
};