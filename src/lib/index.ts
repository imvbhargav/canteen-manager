import { CheckCircle2, Utensils, Clock, XCircle, ReceiptText } from 'lucide-svelte';

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
export function getInitials(name: string): string {
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.substring(0, 2);
}

export function formatDateTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleString('en-IN', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: true,
		timeZone: 'Asia/Kolkata'
	});
}

export function formatDateShort(iso: string): string {
	const [, m, d] = iso.split('-');
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	return `${months[parseInt(m) - 1]} ${parseInt(d)}`;
}

export function formatDate(iso: string): string {
	const [y, m, d] = iso.split('-');
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

export function sanitizeAlphanumeric(value: string): string {
	return value.replace(/[^a-zA-Z0-9]/g, '');
}

export function getStatusConfig(status: string) {
	switch (status) {
		case 'COMPLETED':
			return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
		case 'READY':
			return { icon: Utensils, color: 'text-blue-500', bg: 'bg-blue-500/10' };
		case 'PENDING':
			return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' };
		case 'CANCELLED':
			return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' };
		default:
			return { icon: ReceiptText, color: 'text-foreground/50', bg: 'bg-muted/50' };
	}
}
