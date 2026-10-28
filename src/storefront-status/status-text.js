/**
 * The text of the "Store status" block and shortcode (OW-040), from the
 * status. `Frontend\StoreStatus::text()` in PHP does the same, so a page
 * printed by PHP and the same page refreshed by the script agree, and the
 * block editor's preview uses this too.
 *
 * - Open: the open template with `{closes_at}` filled. With no closing time
 *   (open 24/7, hours not enforced) a template that needs one gives the
 *   plain `openFallback` ("Open now") instead of a gap.
 * - Closed or paused: the closed template with `{next_open}` filled; with no
 *   template, the store's own closed message from the status.
 * - Other braces stay as typed. The result is plain text: set it with
 *   `textContent`, never as HTML.
 */

/**
 * @param {Object} status   The `/status` data.
 * @param {Object} template `{ open, closed, openFallback, later }`: the templates, the plain open text and the "next opening unknown" word.
 * @return {string} Plain text.
 */
export function statusText(status, template) {
	if (status.state === 'open') {
		if (
			template.open.indexOf('{closes_at}') !== -1 &&
			typeof status.closesAtLabel !== 'string'
		) {
			return template.openFallback;
		}
		return template.open
			.split('{closes_at}')
			.join(status.closesAtLabel || '')
			.trim();
	}
	if (template.closed === '') {
		return typeof status.message === 'string' ? status.message : '';
	}
	return template.closed
		.split('{next_open}')
		.join(
			typeof status.nextOpenLabel === 'string'
				? status.nextOpenLabel
				: template.later
		)
		.trim();
}
