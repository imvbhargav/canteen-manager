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
	}
}
export {};
