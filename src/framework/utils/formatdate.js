import { getSettings } from '@wordpress/date';
import { format } from 'date-fns';
import enUS from 'date-fns/locale/en-US';

export const formatDate = (date) => {
	return format(date, 'yyyy-MM-dd');
};

export const formatDateTime = (date) => {
	return format(date, 'yyyy-MM-dd HH:mm:ss');
};

export const formatTime = (date) => {
	return format(date, 'HH:mm');
};

/**
 * The date pickers' locale: date-fns' en-US with the site's own names (months,
 * short weekdays, AM/PM) and first day of the week, from core's `wp-date`
 * settings (the site locale's `$wp_locale` and `start_of_week`). Read on each
 * call, so the pickers follow the site, not strings of our own.
 */
const l10n = () => getSettings().l10n || {};

export const customLocale = {
	...enUS,
	options: {
		...enUS.options,
		get weekStartsOn() {
			const day = Number(l10n().startOfWeek);
			return Number.isInteger(day) && day >= 0 && day <= 6 ? day : 0;
		},
	},
	localize: {
		...enUS.localize,
		month: (n, options) =>
			l10n().months?.[n] ?? enUS.localize.month(n, options),
		day: (n, options) =>
			l10n().weekdaysShort?.[n] ?? enUS.localize.day(n, options),
		dayPeriod: (period, options) =>
			l10n().meridiem?.[period === 'pm' ? 'PM' : 'AM'] ??
			enUS.localize.dayPeriod(period, options),
	},
};
