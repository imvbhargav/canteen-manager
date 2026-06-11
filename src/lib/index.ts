// place files you want to import through the `$lib` alias in this folder.
export function formatCurrencyINR(amount: number): string {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}
