import React, { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ModalPopup, Button } from '@framework/components';
import { DateField } from '@framework/components/form';
import { useDraft } from '../../unsaved-changes';
import {
	MAX_LABEL,
	labelLength,
	toForm,
	toAfterFromChange,
	fromForm,
	validateForm,
	placeErrors,
} from './model';

const DIALOG_FIELDS = ['label', 'from', 'to'];

/**
 * Add or edit one closure. Confirming saves at once (the parent's `onSave`);
 * on a server error the dialog stays open with the messages, and the list
 * doesn't change. While the form differs from what it opened with, it holds
 * a draft, so leaving Store hours asks first (OW-021).
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen  Mount it only while open (fresh state per opening).
 * @param {*}        props.entry   The stored entry, or null for a new one.
 * @param {number}   props.index   The entry's index in the list that will be sent.
 * @param {string}   props.today   The store's today, `Y-m-d` (default date for a new closure).
 * @param {Function} props.onSave  `( entry, index ) => Promise`; rejects with the apiFetch error.
 * @param {Function} props.onClose
 */
const ClosureDialog = ({ isOpen, entry, index, today, onSave, onClose }) => {
	// The parent mounts this dialog only while it's open, so every opening
	// starts from fresh state. Resetting in an effect instead let a keystroke
	// that arrived before the effect edit the previous form (OW-023).
	const [initial] = useState(() => toForm(entry, today));
	const [form, setForm] = useState(initial);
	const [attempted, setAttempted] = useState(false);
	const [server, setServer] = useState({ fields: {}, general: [] });
	const [saving, setSaving] = useState(false);
	// Scoped to Closures: the dialog unmounts with the sub-tab, so even Back to
	// another Store hours sub-tab would lose the text.
	const [, setDraft, clearDraft] = useDraft(
		'closure-dialog',
		'/store-hours/closures'
	);
	const labelRef = useRef(null);

	useEffect(() => clearDraft, []); // eslint-disable-line react-hooks/exhaustive-deps

	const update = (changes) => {
		const next = { ...form, ...changes };
		setForm(next);
		setServer({ fields: {}, general: [] });
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

	const clientErrors = validateForm(form);
	const shown = attempted ? clientErrors : {};
	const errorFor = (field) => server.fields[field] || shown[field] || '';
	const otherServer = Object.entries(server.fields)
		.filter(([field]) => !DIALOG_FIELDS.includes(field))
		.map(([, message]) => message);
	const general = [...server.general, ...otherServer];

	const submit = async (event) => {
		event.preventDefault();
		setAttempted(true);
		if (Object.keys(clientErrors).length) {
			return;
		}
		setSaving(true);
		try {
			await onSave(fromForm(form, entry), index);
			clearDraft();
		} catch (error) {
			const byPath = error?.byPath;
			setServer(
				byPath
					? placeErrors(byPath, index, 'closures')
					: {
							fields: {},
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
			isOpen={isOpen}
			onClose={close}
			closeOnBackdrop={false}
			initialFocusRef={labelRef}
			title={
				isNew
					? __('Add closure', 'orderwindow')
					: __('Edit closure', 'orderwindow')
			}
		>
			<form
				className="orderwindow-closure-form"
				onSubmit={submit}
				noValidate
			>
				{general.length > 0 && (
					<div
						className="orderwindow-closure-form__errors"
						role="alert"
					>
						<p>
							{__('The closure wasn’t saved:', 'orderwindow')}
						</p>
						<ul>
							{general.map((message, i) => (
								<li key={i}>{message}</li>
							))}
						</ul>
					</div>
				)}

				<div className="orderwindow-form-field">
					<label
						htmlFor="orderwindow-closure-label"
						className="orderwindow-form-field-label"
					>
						{__('Label (optional)', 'orderwindow')}
					</label>
					<input
						ref={labelRef}
						id="orderwindow-closure-label"
						type="text"
						value={form.label}
						onChange={(event) =>
							update({ label: event.target.value })
						}
						aria-invalid={errorFor('label') ? true : undefined}
						aria-describedby={
							errorFor('label')
								? 'orderwindow-closure-label-count orderwindow-closure-label-error'
								: 'orderwindow-closure-label-count'
						}
					/>
					<small
						id="orderwindow-closure-label-count"
						className={
							length > MAX_LABEL
								? 'orderwindow-form-field-error-msg'
								: ''
						}
					>
						{sprintf(
							/* translators: 1: characters used; 2: the most allowed. */
							__(
								'%1$d of %2$d characters, e.g. “Diwali”.',
								'orderwindow'
							),
							length,
							MAX_LABEL
						)}
					</small>
					{errorFor('label') && (
						<small
							id="orderwindow-closure-label-error"
							className="orderwindow-form-field-error-msg"
						>
							{errorFor('label')}
						</small>
					)}
				</div>

				<label
					className="orderwindow-closure-form__check"
					htmlFor="orderwindow-closure-one-day"
				>
					<input
						id="orderwindow-closure-one-day"
						type="checkbox"
						checked={form.oneDay}
						onChange={(event) =>
							update({
								oneDay: event.target.checked,
								to: event.target.checked ? form.from : form.to,
							})
						}
					/>
					{__('One day', 'orderwindow')}
				</label>

				<div className="orderwindow-closure-form__dates">
					<DateField
						id="orderwindow-closure-from"
						label={
							form.oneDay
								? __('Date', 'orderwindow')
								: __('First closed date', 'orderwindow')
						}
						value={form.from}
						onChange={(from) =>
							update({
								from,
								to: form.oneDay
									? from
									: toAfterFromChange(form, from),
							})
						}
						error={errorFor('from')}
						required
					/>
					{!form.oneDay && (
						<DateField
							id="orderwindow-closure-to"
							label={__('Last closed date', 'orderwindow')}
							value={form.to}
							onChange={(to) => update({ to })}
							error={errorFor('to')}
							required
						/>
					)}
				</div>

				<label
					className="orderwindow-closure-form__check"
					htmlFor="orderwindow-closure-yearly"
				>
					<input
						id="orderwindow-closure-yearly"
						type="checkbox"
						checked={form.yearly}
						onChange={(event) =>
							update({ yearly: event.target.checked })
						}
						aria-describedby="orderwindow-closure-yearly-help"
					/>
					{__('Repeat every year', 'orderwindow')}
				</label>
				<small
					id="orderwindow-closure-yearly-help"
					className="orderwindow-closure-form__help"
				>
					{__(
						'Repeats on the same dates every year, for less than a year at a time. It can run over the new year (for example 24 December – 2 January). A yearly closure on 29 February applies only in leap years.',
						'orderwindow'
					)}
				</small>

				<div className="orderwindow-closure-form__actions">
					<Button onClick={close} disabled={saving}>
						{__('Cancel', 'orderwindow')}
					</Button>
					<Button type="primary" htmlType="submit" loading={saving}>
						{__('Save closure', 'orderwindow')}
					</Button>
				</div>
			</form>
		</ModalPopup>
	);
};

export default ClosureDialog;
