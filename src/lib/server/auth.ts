import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

// Creates a cryptographically secure session token
export function generateSessionToken(): string {
	return randomBytes(32).toString('hex');
}

// Hashes the token for database storage (so a DB leak doesn't compromise active sessions)
export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

// Hashes a user PIN with a random salt
export function hashPin(pin: string): string {
	const salt = randomBytes(16).toString('hex');
	const derivedKey = scryptSync(pin, salt, 64).toString('hex');
	return `${salt}:${derivedKey}`;
}

// Safely compares a provided PIN against the stored hash
export function verifyPin(pin: string, storedHash: string): boolean {
	const [salt, key] = storedHash.split(':');
	if (!salt || !key) return false;

	const keyBuffer = Buffer.from(key, 'hex');
	const derivedKey = scryptSync(pin, salt, 64);

	try {
		return timingSafeEqual(keyBuffer, derivedKey);
	} catch {
		return false;
	}
}
