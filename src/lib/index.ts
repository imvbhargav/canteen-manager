// place files you want to import through the `$lib` alias in this folder.
export function formatCurrencyINR(amount: number): string {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateTicketReference(): string {
	const letters = Array.from(
		{ length: 3 },
		() => LETTERS[Math.floor(Math.random() * LETTERS.length)]
	).join('');
	const digits = String(Math.floor(1000 + Math.random() * 9000));
	return `${letters}${digits}`;
}
