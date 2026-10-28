/**
 * The Ordering tab's pure logic: the stored value ↔ the form, the message
 * limit and preview. No React, no requests.
 */

export const MESSAGE_MAX = 500;
export const MODES = ['block', 'schedule', 'catalogue'];
export const BAR_SCOPES = ['woocommerce', 'all'];

/**
 * Characters as PHP's `mb_strlen()` counts them (code points), so the
 * counter agrees with the server's 500-character limit (an emoji is one).
 *
 * @param {string} text Text.
 * @return {number} Length.
 */
export const messageLength = (text) => [...String(text ?? '')].length;

/**
 * The form model from `GET /settings/behaviour`, with safe defaults.
 *
 * @param {Object} stored The stored group.
 * @return {{enforce: boolean, closedMode: string, closedMessage: string, noticeBar: boolean, noticeBarScope: string, scheduledOrderNote: boolean, scheduledOrderNoteText: string}} The model.
 */
export const fromStored = (stored) => ({
	enforce: stored?.enforce === true,
	closedMode: MODES.includes(stored?.closedMode)
		? stored.closedMode
		: 'block',
	closedMessage:
		typeof stored?.closedMessage === 'string' ? stored.closedMessage : '',
	// On unless stored as exactly false (the server's default is on).
	noticeBar: stored?.noticeBar !== false,
	noticeBarScope: BAR_SCOPES.includes(stored?.noticeBarScope)
		? stored.noticeBarScope
		: 'woocommerce',
	// OW-062: on unless stored as exactly false, like the notice bar.
	scheduledOrderNote: stored?.scheduledOrderNote !== false,
	scheduledOrderNoteText:
		typeof stored?.scheduledOrderNoteText === 'string'
			? stored.scheduledOrderNoteText
			: '',
});

export const sameModel = (a, b) =>
	a.enforce === b.enforce &&
	a.closedMode === b.closedMode &&
	a.closedMessage === b.closedMessage &&
	a.noticeBar === b.noticeBar &&
	a.noticeBarScope === b.noticeBarScope &&
	a.scheduledOrderNote === b.scheduledOrderNote &&
	a.scheduledOrderNoteText === b.scheduledOrderNoteText;

/**
 * Browser-side checks, as `{ field: true }` (the screen words them).
 *
 * @param {Object} model The model.
 * @return {Object} Problems by field.
 */
export const validate = (model) => {
	const problems = {};
	if (messageLength(model.closedMessage) > MESSAGE_MAX) {
		problems.closedMessage = true;
	}
	if (messageLength(model.scheduledOrderNoteText) > MESSAGE_MAX) {
		problems.scheduledOrderNoteText = true;
	}
	return problems;
};

/**
 * The message as shoppers would see it, with the server's token values: the
 * draft text, or the default when it's empty (the server stores '' for the
 * default). Only the two tokens are replaced, as on the server.
 *
 * @param {string} message        The draft message.
 * @param {string} defaultMessage The translated default.
 * @param {Object} tokens         `{ next_open, closures_label }`.
 * @return {string} The preview.
 */
export const previewMessage = (message, defaultMessage, tokens) => {
	const template = String(message ?? '').trim() ? message : defaultMessage;
	return String(template ?? '')
		.split('{next_open}')
		.join(String(tokens?.next_open ?? ''))
		.split('{closures_label}')
		.join(String(tokens?.closures_label ?? ''))
		.trim();
};

/**
 * The scheduled-order note as an email would show it (OW-062): the draft
 * text, or the default when it's empty; only `{scheduled_for}` is replaced,
 * as on the server.
 *
 * @param {string} text        The draft note.
 * @param {string} defaultText The translated default.
 * @param {Object} tokens      `{ scheduled_for }`.
 * @return {string} The preview.
 */
export const previewNote = (text, defaultText, tokens) => {
	const template = String(text ?? '').trim() ? text : defaultText;
	return String(template ?? '')
		.split('{scheduled_for}')
		.join(String(tokens?.scheduled_for ?? ''))
		.trim();
};
