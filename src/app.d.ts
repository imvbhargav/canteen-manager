declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				referenceKey: string;
				name: string;
			} | null;
			sessionId: string | null;
		}
		interface Platform {
			env?: Record<string, unknown>;
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}
export {};
