declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        studentId: string;
        name: string;
      } | null;
      sessionId: string | null;
    }
  }
}
export {};