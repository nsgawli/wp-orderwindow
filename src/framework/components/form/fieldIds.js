import React from 'react';

/**
 * Ids for one form field (OW-053): the control, its help text and its error,
 * unique on the page, so `Label` can point at the control and the control at
 * its help and error.
 *
 * @return {{field: string, info: string, error: string}} Ids.
 */
export function useFieldIds() {
	const base = React.useId();
	return {
		field: `${base}field`,
		info: `${base}info`,
		error: `${base}error`,
	};
}

/**
 * ARIA attributes for a field's control: help text and error as its
 * description, the error state, and required.
 *
 * @param {Object}  ids           From `useFieldIds()`.
 * @param {Object}  state
 * @param {*}       state.info     Help text, when shown.
 * @param {*}       state.error    Error message, when shown.
 * @param {boolean} state.required Whether the field is required.
 * @return {Object} Attributes to spread on the control.
 */
export function fieldAria(ids, { info, error, required }) {
	const describedBy = [info ? ids.info : '', error ? ids.error : '']
		.filter(Boolean)
		.join(' ');
	return {
		'aria-describedby': describedBy || undefined,
		'aria-invalid': error ? true : undefined,
		'aria-required': required ? true : undefined,
	};
}
