/**
 * Weekly hours: stored value ↔ editor model, browser-side checks, and server
 * error placement. Pure functions, no React.
 *
 * Model: `{ mon: { mode, ranges, unreadable }, … sun }`
 * - `mode` is `closed`, `open24`, `custom`, or null when the stored day couldn't
 *   be read (the merchant must choose; nothing is converted silently);
 * - `ranges` are the custom ranges, kept while another mode is selected, so
 *   switching Closed and back restores them;
 * - `unreadable` marks a day whose stored value wasn't a list.
 */
import { validateRanges } from '../ranges';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const MAX_RANGES = 24;
export const DEFAULT_RANGE = { start: '09:00', end: '17:00' };

/**
 * Day keys in display order for WordPress's `start_of_week` (0 = Sunday).
 *
 * @param {number} startOfWeek WordPress's `start_of_week`.
 * @return {string[]} Day keys.
 */
export const orderedDays = (startOfWeek) => {
	const sundayFirst = ['sun', ...DAYS.slice(0, 6)];
	const start =
		Number.isInteger(startOfWeek) && startOfWeek >= 0 && startOfWeek <= 6
			? startOfWeek
			: 1;
	return [...sundayFirst.slice(start), ...sundayFirst.slice(0, start)];
};

/**
 * Index into WordPress's weekday names (0 = Sunday).
 *
 * @param {string} day Day key.
 * @return {number} Index.
 */
export const weekdayIndex = (day) =>
	day === 'sun' ? 0 : DAYS.indexOf(day) + 1;

const isFullDay = (ranges) =>
	ranges.length === 1 &&
	ranges[0] &&
	typeof ranges[0] === 'object' &&
	ranges[0].start === '00:00' &&
	ranges[0].end === '24:00';

/**
 * The editor model for a stored `weekly` value. Anything unreadable is
 * flagged, never guessed.
 *
 * @param {*} weekly The stored `weekly` value.
 * @return {Object} The model.
 */
export const fromStored = (weekly) => {
	const source =
		weekly && typeof weekly === 'object' && !Array.isArray(weekly)
			? weekly
			: {};
	const model = {};
	DAYS.forEach((day) => {
		const ranges = source[day];
		if (!Array.isArray(ranges)) {
			model[day] = { mode: null, ranges: [], unreadable: true };
		} else if (ranges.length === 0) {
			model[day] = { mode: 'closed', ranges: [], unreadable: false };
		} else if (isFullDay(ranges)) {
			model[day] = { mode: 'open24', ranges: [], unreadable: false };
		} else {
			model[day] = {
				mode: 'custom',
				ranges: ranges.map((r) => r),
				unreadable: false,
			};
		}
	});
	return model;
};

/**
 * Stored keys the editor drops on save (e.g. an unknown day such as `funday`).
 *
 * @param {*} weekly The stored `weekly` value.
 * @return {string[]} The unknown keys.
 */
export const unknownKeys = (weekly) =>
	weekly && typeof weekly === 'object' && !Array.isArray(weekly)
		? Object.keys(weekly).filter((key) => !DAYS.includes(key))
		: [];

/**
 * The `weekly` body for `PUT /settings/schedule`: all seven days, ranges in display order.
 *
 * @param {Object} model The model.
 * @return {Object} The `weekly` body.
 */
export const toPayload = (model) => {
	const weekly = {};
	DAYS.forEach((day) => {
		const { mode, ranges } = model[day];
		if (mode === 'open24') {
			weekly[day] = [{ start: '00:00', end: '24:00' }];
		} else if (mode === 'custom') {
			weekly[day] = ranges.map((r) => ({ start: r?.start, end: r?.end }));
		} else {
			weekly[day] = [];
		}
	});
	return weekly;
};

/**
 * Switch a day's mode; custom ranges are kept (and seeded on first use).
 *
 * @param {Object} dayModel The day's model.
 * @param {string} mode     `closed`, `open24` or `custom`.
 * @return {Object} The new day model.
 */
export const withMode = (dayModel, mode) => ({
	...dayModel,
	mode,
	unreadable: false,
	ranges:
		mode === 'custom' && dayModel.ranges.length === 0
			? [{ ...DEFAULT_RANGE }]
			: dayModel.ranges,
});

/**
 * Days still waiting for the merchant to choose a mode (unreadable when loaded).
 *
 * @param {Object} model The model.
 * @return {string[]} Day keys.
 */
export const undecidedDays = (model) =>
	DAYS.filter((day) => model[day].mode === null);

/**
 * Browser-side checks, for quick feedback only; the server decides. They
 * cover an empty or unreadable time, start equal to end, and overlaps within
 * one day. Cross-day overlaps and limits come from the server.
 *
 * @param {Object} model The editor model.
 * @return {Object} `{ [day]: { [key]: message } }`, keys as TimeRangesEditor expects.
 */
export const validate = (model) => {
	const errors = {};
	DAYS.forEach((day) => {
		const { mode, ranges } = model[day];
		if (mode !== 'custom') {
			return;
		}
		const dayErrors = validateRanges(ranges);
		if (Object.keys(dayErrors).length) {
			errors[day] = dayErrors;
		}
	});
	return errors;
};

const PATH = /^weekly\.(mon|tue|wed|thu|fri|sat|sun)\.(\d+)(?:\.(start|end))?$/;

/**
 * Split server errors (`{ path: message }`) into those placed at a field or
 * row (`{ [day]: { [key]: message } }`) and the rest, listed in the summary.
 *
 * @param {Object} byPath Messages keyed by server path.
 * @param {Object} model  The model that was sent (to confirm a row exists).
 * @return {{placed: Object, unplaced: string[]}} Where each message goes.
 */
export const placeServerErrors = (byPath, model) => {
	const placed = {};
	const unplaced = [];
	Object.entries(byPath).forEach(([path, message]) => {
		const m = path.match(PATH);
		const day = m?.[1];
		const index = m ? Number(m[2]) : -1;
		if (
			m &&
			model[day]?.mode === 'custom' &&
			index < model[day].ranges.length
		) {
			placed[day] = placed[day] || {};
			placed[day][m[3] ? `${index}.${m[3]}` : String(index)] = message;
		} else {
			unplaced.push(message);
		}
	});
	return { placed, unplaced };
};

/**
 * Copy one day's hours onto others.
 *
 * @param {Object}   model   The model.
 * @param {string}   from    Source day key.
 * @param {string[]} targets Day keys to overwrite.
 * @return {Object} The new model.
 */
export const copyDay = (model, from, targets) => {
	const next = { ...model };
	targets.forEach((day) => {
		next[day] = {
			mode: model[from].mode,
			ranges: model[from].ranges.map((r) => ({ ...r })),
			unreadable: false,
		};
	});
	return next;
};

export const sameModel = (a, b) => JSON.stringify(a) === JSON.stringify(b);
