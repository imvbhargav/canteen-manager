import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';

const SECRET_KEY = env.ENCRYPTION_KEY as string;
const ALGORITHM = 'aes-256-cbc';

if (!SECRET_KEY || SECRET_KEY.length !== 32) {
	throw new Error('ENCRYPTION_KEY must be exactly 32 characters long.');
}

export function encryptCounterId(counterId: string): string {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);

	let encrypted = cipher.update(counterId, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptCounterData(encryptedPayload: string): string | null {
	try {
		const parts = encryptedPayload.split(':');
		if (parts.length !== 2) return null;

		const [ivHex, encryptedHex] = parts;
		const iv = Buffer.from(ivHex, 'hex');
		const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);

		let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
		decrypted += decipher.final('utf8');

		return decrypted;
	} catch {
		// Fails silently if someone scans a fake/tampered QR code
		return null;
	}
}
