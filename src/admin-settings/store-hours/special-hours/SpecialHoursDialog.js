import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ModalPopup, Button, TimeRangesEditor } from '@framework/components';
import { DateField } from '@framework/components/form';
import { useDraft } from '../../unsaved-changes';
import { labelLength, MAX_LABEL } from '../closures/model';
import {
	MAX_RANGES,
	DEFAULT_RANGES,
	toForm,
	fromForm,
	validateForm,
	placeErrors,
} from './model';

const NO_SERVER = { fields: {}, ranges: {}, general: [] };

/**
 * Add or edit one special-hours entry. Mounted by the parent only while open
 * (fresh state per opening; see ClosureDialog). Confirming saves at once; on
 * a server error the dialog stays open with the messages.
 *
 * @param {Object}   props
 * @param {*}        props.entry         The stored entry, or null for a new one.
 * @param {number}   props.index         Its index in the list that will be sent.
 * @param {string}   props.today         The store's today, `Y-m-d`.
 * @param {Function} props.onSave        `( entry, index ) => Promise`; rejects with `{ errors, sent }` or the error.
 * @param {Function} props.onClose
 * @param {Function} props.onClosuresTab Opens the Closures sub-tab.
 */
const SpecialHoursDialog = ({
	entry,
	index,
	today,
	onSave,
	onClose,
	onClosuresTab,
}) => {
	const [initial] = useState(() => toForm(entry, today));
	const [form, setForm] = useState(initial);
	const [attempted, setAttempted] = useState(false);
	const [server, setServer] = useState(NO_SERVER);
	const [saving, setSaving] = useState(false);
	// Scoped to this sub-tab: the dialog unmounts with it.
	const [, setDraft, clearDraft] = useDraft(
		'special-hours-dialog',
		'/store-hours/special-hours'
	);
	// Focus the date input itself on open (DateField doesn't forward refs).
	const [dateRef] = useState(() => ({
		get current() {
			return document.getElementById('orderwindow-special-date');
		},
	}));

	useEffect(() => clearDraft, []); // eslint-disable-line react-hooks/exhaustive-deps

	const update = (changes) => {
		const next = { ...form, ...changes };
		setForm(next);
		setServer(NO_SERVER);
		if (JSON.stringify(next) === JSON.stringify(initial)) {
			clearDraft();
		} else {
			setDraft(true);
		}
	};

	const close = () => {
		clearDraft();
		onClose();
	};

	const checks = validateForm(form);
	const shownFields = attempted ? checks.fields : {};
	// Row-level range problems (same times, overlaps) show while typing,
	// field-level ones after the first save attempt, as in Weekly hours.
	const shownRanges = Object.fromEntries(
		Object.entries(checks.ranges).filter(
			([key]) => attempted || !key.includes('.')
		)
	);
	const fieldError = (field) =>
		server.fields[field] || shownFields[field] || '';
	const rangeErrors = { ...shownRanges, ...server.ranges };

	const submit = async (event) => {
		event.preventDefault();
		setAttempted(true);
		if (
			Object.keys(checks.fields).length ||
			Object.keys(checks.ranges).length
		) {
			return;
		}
		setSaving(true);
		try {
			await onSave(fromForm(form, entry), index);
			clearDraft();
		} catch (error) {
			setServer(
				error?.errors
					? placeErrors(error.errors, index, error.sent)
					: {
							...NO_SERVER,
							general: [
								error?.message ||
									__('Unknown error.', 'orderwindow'),
							],
						}
			);
		} finally {
			setSaving(false);
		}
	};

	const length = labelLength(form.label);
	const isNew = entry === null || entry === undefined;

	return (
		<ModalPopup
			isOpen
			onClose={close}
			closeOnBackdrop={false}
			initialFocusRef={dateRef}
			title={
				isNew
					? __('Add special hours', 'orderwindow')
					: __('Edit special hours', 'orderwindow')
			}
		>
			<form
				className="orderwindow-closure-form"
				onSubmit={submit}
				noValidate
			>
				<p className="orderwindow-closure-form__help">
					{__(
						'Special hours replace the weekly hours on this date.',
						'orderwindow'
					)}{' '}
					<button
						type="button"
						className="button-link"
						onClick={() => {
							close();
							onClosuresTab();
						}}
					>
						{__(
							'To close for the day, add a closure instead.',
							'orderwindow'
						)}
					</button>
				</p>

				{server.general.length > 0 && (
					<div
						className="orderwindow-closure-form__errors"
						role="alert"
					>
						<p>
							{__(
								'The special hours weren’t saved:',
								'orderwindow'
							)}
						</p>
						<ul>
							{server.general.map((message, i) => (
								<li key={i}>{message}</li>
							))}
						</ul>
					</div>
				)}

				<DateField
					id="orderwindow-special-date"
					label={__('Date', 'orderwindow')}
					value={form.date}
					onChange={(date) => update({ date })}
					error={fieldError('date')}
					required
				/>

				<label
					className="orderwindow-closure-form__check"
					htmlFor="orderwindow-special-yearly"
				>
					<input
						id="orderwindow-special-yearly"
						type="checkbox"
						checked={form.yearly}
						onChange={(event) =>
							update({ yearly: event.target.checked })
						}
						aria-describedby="orderwindow-special-yearly-help"
					/>
					{__('Repeat every year', 'orderwindow')}
				</label>
				<small
					id="orderwindow-special-yearly-help"
					className="orderwindow-closure-form__help"
				>
					{__(
						'Repeats on the same date every year. On 29 February it applies only in leap years. Only one special-hours entry is allowed per date.',
						'orderwindow'
					)}
				</small>

				<fieldset className="orderwindow-special-form__hours">
					<legend className="orderwindow-form-field-label">
						{__('Hours', 'orderwindow')}
					</legend>
					<label
						className="orderwindow-closure-form__check"
						htmlFor="orderwindow-special-open24"
					>
						<input
							id="orderwindow-special-open24"
							type="checkbox"
							checked={form.open24}
							onChange={(event) =>
								update({
									open24: event.target.checked,
									ranges:
										!event.target.checked &&
										form.ranges.length === 0
											? DEFAULT_RANGES.map((r) => ({
													...r,
												}))
											: form.ranges,
								})
							}
						/>
						{__('Open 24 hours', 'orderwindow')}
					</label>
					{!form.open24 && (
						<TimeRangesEditor
							idPrefix="orderwindow-special-ranges"
							context={__('Special hours', 'orderwindow')}
							value={form.ranges}
							onChange={(ranges) => update({ ranges })}
							errors={rangeErrors}
							max={MAX_RANGES}
							disabled={saving}
						/>
					)}
					{fieldError('ranges') && (
						<small
							id="orderwindow-special-ranges-error"
							className="orderwindow-form-field-error-msg"
						>
							{fieldError('ranges')}
						</small>
					)}
				</fieldset>

				<div className="orderwindow-form-field">
					<label
						htmlFor="orderwindow-special-label"
						className="orderwindow-form-field-label"
					>
						{__('Label (optional)', 'orderwindow')}
					</label>
					<input
						id="orderwindow-special-label"
						type="text"
						value={form.label}
						onChange={(event) =>
							update({ label: event.target.value })
						}
						aria-invalid={fieldError('label') ? true : undefined}
						aria-describedby={
							fieldError('label')
								? 'orderwindow-special-label-count orderwindow-special-label-error'
								: 'orderwindow-special-label-count'
						}
					/>
					<small
						id="orderwindow-special-label-count"
						className={
							length > MAX_LABEL
								? 'orderwindow-form-field-error-msg'
								: ''
						}
					>
						{sprintf(
							/* translators: 1: characters used; 2: the most allowed. */
							__(
								'%1$d of %2$d characters, e.g. “Late opening”.',
								'orderwindow'
							),
							length,
							MAX_LABEL
						)}
					</small>
					{fieldError('label') && (
						<small
							id="orderwindow-special-label-error"
							className="orderwindow-form-field-error-msg"
						>
							{fieldError('label')}
						</small>
					)}
				</div>

				<div className="orderwindow-closure-form__actions">
					<Button onClick={close} disabled={saving}>
						{__('Cancel', 'orderwindow')}
					</Button>
					<Button type="primary" htmlType="submit" loading={saving}>
						{__('Save special hours', 'orderwindow')}
					</Button>
				</div>
			</form>
		</ModalPopup>
	);
};

export default SpecialHoursDialog;
