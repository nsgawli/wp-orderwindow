// A "date-only" string (`yyyy-MM-dd`, as produced by `formatDate()`) has no
// time zone of its own — it names a calendar day, not an instant. Handing
// one to `new Date(string)` or date-fns's `parseISO()` parses it as UTC
// midnight, which then renders one day off in any local time zone behind
// UTC. Parsing the `yyyy-MM-dd` parts directly into a local `Date` avoids
// that shift no matter the viewer's time zone.
export const parseDateOnly = (value) => {
	if (!value) {
		return null;
	}

	const [year, month, day] = String(value)
		.split('-')
		.map((part) => parseInt(part, 10));

	if (!year || !month || !day) {
		return null;
	}

	return new Date(year, month - 1, day);
};
