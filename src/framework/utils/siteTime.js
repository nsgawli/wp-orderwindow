/**
 * The site's date and time settings, for admin screens.
 *
 * Built on WordPress core's `wp-date` script (`@wordpress/date`, externalized
 * by wp-scripts, so no code is bundled). Core prints its settings inline:
 * date and time formats, translated month and weekday names, the start of
 * the week, and the store's time zone.
 *
 * Two kinds of value, two rules:
 * - **Wall-clock values** (`Y-m-d` dates, `HH:MM` times) name a calendar day
 *   or a time on the store's clock, not an instant. They are formatted as UTC
 *   values with `gmdateI18n()`, so no zone conversion can shift them.
 *   `dateI18n()` would parse an offset-less string in the *browser's* zone and
 *   then convert it to the store's, which moves dates by a day when the two
 *   zones differ.
 * - **Now in the store** (`storeToday()`, `storeNow()`) is the one place where
 *   converting an instant to the store's zone is the point.
 */
import { getSettings, gmdateI18n, date as phpDate } from '@wordpress/date';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Formats, names and zone from WordPress.
 *
 * @return {{dateFormat: string, timeFormat: string, startOfWeek: number, weekdays: string[], weekdaysShort: string[], timezone: Object}} The site's formats, translated weekday names, first day of the week (0 = Sunday) and zone (`{ string, offset, offsetFormatted, abbr }`).
 */
export const getSiteSettings = () => {
	const settings = getSettings();
	return {
		dateFormat: settings.formats.date,
		timeFormat: settings.formats.time,
		startOfWeek: Number(settings.l10n.startOfWeek) || 0,
		weekdays: settings.l10n.weekdays,
		weekdaysShort: settings.l10n.weekdaysShort,
		timezone: settings.timezone,
	};
};

/**
 * True for a real calendar date in `Y-m-d` form.
 *
 * @param {*} value Any value.
 * @return {boolean} Whether it is a valid `Y-m-d` date.
 */
export const isYmd = (value) => {
	const m = typeof value === 'string' && value.match(YMD);
	if (!m) {
		return false;
	}
	// setUTCFullYear, not Date.UTC(): Date.UTC maps years 0–99 to 1900–1999,
	// and Chrome's date input passes through such years while a year is typed
	// ("2031" goes 0002 → 0020 → 0203 → 2031). Rejecting them blanked the
	// field mid-typing (OW-023).
	const d = new Date(0);
	d.setUTCFullYear(+m[1], +m[2] - 1, +m[3]);
	return (
		d.getUTCFullYear() === +m[1] &&
		d.getUTCMonth() === +m[2] - 1 &&
		d.getUTCDate() === +m[3]
	);
};

/**
 * True for `HH:MM` from `00:00` to `23:59`; `24:00` only when `allowEndOfDay`.
 *
 * @param {*}       value         Any value.
 * @param {boolean} allowEndOfDay Accept `24:00` too.
 * @return {boolean} Whether it is a valid time.
 */
export const isHhmm = (value, allowEndOfDay = false) =>
	typeof value === 'string' &&
	(HHMM.test(value) || (allowEndOfDay && value === '24:00'));

/**
 * Minutes from midnight for `HH:MM` (`24:00` is 1440), or null.
 *
 * @param {*} value A time.
 * @return {number|null} Minutes, or null for anything that isn't a time.
 */
export const toMinutes = (value) => {
	if (value === '24:00') {
		return 1440;
	}
	const m = typeof value === 'string' && value.match(HHMM);
	return m ? +m[1] * 60 + +m[2] : null;
};

/**
 * `HH:MM` for minutes from midnight, wrapped into one day (1440 is `00:00`).
 *
 * @param {number} minutes Minutes from midnight (any integer; wrapped into 0–1439).
 * @return {string} `HH:MM`.
 */
export const fromMinutes = (minutes) => {
	const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
	return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * Format a calendar date (`Y-m-d`) with a PHP-style format, by default the
 * site's date format. Returns '' for anything that isn't a real date.
 *
 * @param {string} ymd    The date.
 * @param {string} format PHP date format.
 * @return {string} The formatted date, or ''.
 */
export const formatSiteDate = (ymd, format = getSiteSettings().dateFormat) =>
	isYmd(ymd) ? gmdateI18n(format, `${ymd}T12:00:00Z`) : '';

/**
 * A PHP date format with its year removed, keeping the site's own day and
 * month order: `F j, Y` → `F j`, `d/m/Y` → `d/m`, `Y-m-d` → `m-d`,
 * `j. F Y` → `j. F`. Escaped characters (`\\Y`) are kept.
 *
 * @param {string} format PHP date format.
 * @return {string} The format without year tokens and their separators.
 */
export const withoutYear = (format) => {
	const stripped = String(format)
		.replace(/(^|[^\\])[\s,./-]*[Yyo](?![a-z])/g, '$1')
		.replace(/^[\s,./-]+|[\s,/-]+$/g, '');
	return stripped || 'F j';
};

/**
 * Format a wall-clock time (`HH:MM`, or `24:00` shown as midnight) with the
 * site's time format. Returns '' for anything else.
 *
 * @param {string} hhmm   The time.
 * @param {string} format PHP date format.
 * @return {string} The formatted time, or ''.
 */
export const formatSiteTime = (hhmm, format = getSiteSettings().timeFormat) => {
	const value = hhmm === '24:00' ? '00:00' : hhmm;
	return isHhmm(value) ? gmdateI18n(format, `2000-01-01T${value}:00Z`) : '';
};

/**
 * Today's date in the store's zone, `Y-m-d`.
 *
 * @param {Date} now The instant (default: now).
 * @return {string} `Y-m-d` in the store's zone.
 */
export const storeToday = (now = new Date()) => phpDate('Y-m-d', now);

/**
 * The current time in the store's zone, formatted with the site's time format.
 *
 * @param {Date} now The instant (default: now).
 * @return {string} The formatted time.
 */
export const storeNow = (now = new Date()) =>
	phpDate(getSiteSettings().timeFormat, now);

/**
 * `Y-m-d` plus a number of days (calendar arithmetic, no zones).
 *
 * @param {string} ymd  The date.
 * @param {number} days Days to add (may be negative).
 * @return {string} The new `Y-m-d`, or '' for an invalid date.
 */
export const addDays = (ymd, days) => {
	if (!isYmd(ymd)) {
		return '';
	}
	const d = new Date(`${ymd}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};

/**
 * The store's time zone for display: the zone name (`Europe/London`), or the
 * offset as `UTC+5:30` when the site uses a manual offset.
 *
 * @return {string} The label.
 */
export const storeZoneLabel = () => {
	const zone = getSiteSettings().timezone || {};
	if (zone.string) {
		return zone.string;
	}
	const offset = Number(zone.offset) || 0;
	const sign = offset < 0 ? '-' : '+';
	const abs = Math.abs(offset);
	const hours = Math.floor(abs);
	const minutes = Math.round((abs - hours) * 60);
	return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
};
