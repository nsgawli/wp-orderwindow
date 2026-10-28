import React, { useCallback, useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	ConfirmDialog,
	Content,
	Divider,
	Flex,
	ScreenLoader,
	Title,
} from '@framework/components';
import { DateField, TimeField } from '@framework/components/form';
import { storeToday } from '@framework/utils/siteTime';
import { useAlerts } from '@framework/hooks/useAlerts';
import { useDraft } from '../unsaved-changes';
import {
	fieldErrors,
	getBehaviour,
	getStatus,
	resumeOrdering,
	saveBehaviour,
	startPause,
} from './resource';
import {
	MESSAGE_MAX,
	fromStored,
	messageLength,
	previewMessage,
	previewNote,
	sameModel,
	validate,
} from './model';
import './index.css';

export const BASE_PATH = '/ordering';
const ID = 'orderwindow-ordering';

const errorText = (error) =>
	error?.message || __('Unknown error.', 'orderwindow');

/**
 * The status line: what checkout does right now, from the saved settings.
 *
 * @param {Object} status `GET /ordering/status`.
 * @return {{tone: string, headline: string, detail: string}} The line.
 */
const describeStatus = (status) => {
	const { reason, outcome, mode, pause } = status;
	let headline;
	let tone = 'closed';

	if (reason === 'paused') {
		headline = pause?.untilLabel
			? sprintf(
					/* translators: %s: when ordering resumes, e.g. "2:30 pm" or "Tue 9:00 am". */
					__('Paused until %s', 'orderwindow'),
					pause.untilLabel
				)
			: __('Paused until you resume', 'orderwindow');
		tone = 'paused';
	} else if (reason === 'outside_hours' || reason === 'closure') {
		headline = status.nextOpenLabel
			? sprintf(
					/* translators: %s: when the store opens, e.g. "Tue 9:00 am". */
					__('Closed, opens %s', 'orderwindow'),
					status.nextOpenLabel
				)
			: __('Closed, with no opening ahead', 'orderwindow');
	} else if (reason === 'not_enforced') {
		return {
			tone: 'neutral',
			headline: __('Not enforced', 'orderwindow'),
			detail: __(
				'Shoppers can order at any time. Turn on “Enforce opening hours” to use your store hours.',
				'orderwindow'
			),
		};
	} else if (reason === 'fallback') {
		return {
			tone: 'open',
			headline: __('Open', 'orderwindow'),
			detail: __(
				'The saved store hours are invalid, so the store is treated as open. Save them again in Store hours.',
				'orderwindow'
			),
		};
	} else if (reason === 'error') {
		return {
			tone: 'open',
			headline: __('Open', 'orderwindow'),
			detail: __(
				'Order Window hit an error, so ordering is allowed. Details are in WooCommerce → Status → Logs.',
				'orderwindow'
			),
		};
	} else {
		return {
			tone: 'open',
			headline: status.nextCloseLabel
				? sprintf(
						/* translators: %s: when the store closes, e.g. "6:00 pm". */
						__('Open now, closes %s', 'orderwindow'),
						status.nextCloseLabel
					)
				: __('Open now', 'orderwindow'),
			detail: __('Shoppers can order.', 'orderwindow'),
		};
	}

	let detail;
	if (outcome === 'scheduled') {
		detail = __(
			'Orders are accepted and scheduled for the next opening.',
			'orderwindow'
		);
	} else if (mode === 'catalogue') {
		detail = __(
			'Shoppers can browse but can’t add to cart or check out.',
			'orderwindow'
		);
	} else if (mode === 'schedule') {
		detail = __(
			'There is no opening to schedule orders for, so checkout is blocked.',
			'orderwindow'
		);
	} else {
		detail = __(
			'Shoppers can browse and add to cart but can’t check out.',
			'orderwindow'
		);
	}
	return { tone, headline, detail };
};

/**
 * "Ordering is paused until …" / "… until you resume it" / "… not paused".
 *
 * @param {Object} pause The `pause` part of the status.
 * @return {string} The sentence.
 */
const pauseStateText = (pause) => {
	if (!pause?.active) {
		return __('Ordering is not paused.', 'orderwindow');
	}
	if (!pause.untilLabel) {
		return __('Ordering is paused until you resume it.', 'orderwindow');
	}
	return sprintf(
		/* translators: %s: when ordering resumes, e.g. "Tue 2:30 pm". */
		__('Ordering is paused until %s.', 'orderwindow'),
		pause.untilLabel
	);
};

const modeOptions = () => [
	{
		value: 'block',
		label: __('Block checkout', 'orderwindow'),
		help: __(
			'Shoppers can browse and add to cart, but can’t check out until you open. Paying an existing order still works.',
			'orderwindow'
		),
	},
	{
		value: 'schedule',
		label: __('Accept orders for the next opening', 'orderwindow'),
		help: __(
			'Shoppers order as usual. Each order is marked as placed while closed and scheduled for the next opening. With no opening ahead, checkout is blocked.',
			'orderwindow'
		),
	},
	{
		value: 'catalogue',
		label: __('Catalogue mode', 'orderwindow'),
		help: __(
			'Shoppers can browse, but can’t add to cart or check out. Paying an existing order still works.',
			'orderwindow'
		),
	},
];

const pausePresets = () => [
	{
		id: '30m',
		label: __('30 minutes', 'orderwindow'),
		body: { mode: 'duration', minutes: 30 },
	},
	{
		id: '1h',
		label: __('1 hour', 'orderwindow'),
		body: { mode: 'duration', minutes: 60 },
	},
	{
		id: '2h',
		label: __('2 hours', 'orderwindow'),
		body: { mode: 'duration', minutes: 120 },
	},
	{
		id: 'today',
		label: __('Rest of today', 'orderwindow'),
		body: { mode: 'end_of_day' },
	},
	{
		id: 'next',
		label: __('Until the next opening', 'orderwindow'),
		body: { mode: 'next_opening' },
	},
];

const Ordering = () => {
	const [saved, setSaved] = useState(null);
	const [status, setStatus] = useState(null);
	const [loadError, setLoadError] = useState('');
	const [draft, setDraft, clearDraft] = useDraft('ordering', BASE_PATH);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState('');
	const [serverErrors, setServerErrors] = useState({});
	const [pauseBusy, setPauseBusy] = useState(false);
	const [pauseError, setPauseError] = useState('');
	const [confirmResumed, setConfirmResumed] = useState(false);
	const [untilDate, setUntilDate] = useState('');
	const [untilTime, setUntilTime] = useState('');
	const [untilError, setUntilError] = useState('');
	const summaryRef = useRef(null);
	const { addAlert } = useAlerts();

	const refreshStatus = useCallback(
		() =>
			getStatus()
				.then(setStatus)
				.catch(() => {
					// Keep the last status; the next focus tries again.
				}),
		[]
	);

	const load = useCallback(() => {
		setLoadError('');
		setSaved(null);
		Promise.all([getBehaviour(), getStatus()])
			.then(([behaviour, current]) => {
				setSaved(fromStored(behaviour));
				setStatus(current);
			})
			.catch((error) => setLoadError(errorText(error)));
	}, []);

	useEffect(load, [load]);

	// A pause set from the admin bar in another tab shows when this one is used again.
	useEffect(() => {
		const onFocus = () => refreshStatus();
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				refreshStatus();
			}
		};
		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [refreshStatus]);

	if (loadError) {
		return (
			<Shell>
				<div className={`${ID}__load-error`} role="alert">
					<p>
						{sprintf(
							/* translators: %s: error message. */
							__(
								'The ordering settings couldn’t be loaded: %s',
								'orderwindow'
							),
							loadError
						)}
					</p>
					<Button onClick={load}>
						{__('Try again', 'orderwindow')}
					</Button>
				</div>
			</Shell>
		);
	}
	if (!saved || !status) {
		return (
			<Shell>
				<ScreenLoader />
			</Shell>
		);
	}

	const model = draft ?? saved;
	const problems = validate(model);
	const length = messageLength(model.closedMessage);
	const noteLength = messageLength(model.scheduledOrderNoteText);
	const line = describeStatus(status);
	const paused = status.pause?.active === true;

	const update = (changes) => {
		const next = { ...model, ...changes };
		if (sameModel(next, saved)) {
			clearDraft();
		} else {
			setDraft(next);
		}
		setSaveError('');
		setServerErrors({});
	};

	const onSave = async () => {
		setSaveError('');
		setServerErrors({});
		if (Object.keys(problems).length) {
			window.setTimeout(() => summaryRef.current?.focus(), 0);
			return;
		}
		setSaving(true);
		try {
			const stored = await saveBehaviour(model);
			setSaved(fromStored(stored));
			clearDraft();
			refreshStatus();
			addAlert({
				id: Date.now(),
				type: 'success',
				title: __('Saved', 'orderwindow'),
				description: __('Ordering settings saved.', 'orderwindow'),
			});
		} catch (error) {
			const byField = fieldErrors(error);
			if (byField) {
				setServerErrors(byField);
			}
			setSaveError(errorText(error));
			window.setTimeout(() => summaryRef.current?.focus(), 0);
		} finally {
			setSaving(false);
		}
	};

	const runPause = async (action, successText) => {
		setPauseBusy(true);
		setPauseError('');
		try {
			await action();
			await refreshStatus();
			addAlert({
				id: Date.now(),
				type: 'success',
				title: __('Done', 'orderwindow'),
				description: successText,
			});
			return true;
		} catch (error) {
			setPauseError(errorText(error));
			await refreshStatus();
			return false;
		} finally {
			setPauseBusy(false);
		}
	};

	const pauseUntilTime = async () => {
		if (!untilDate || !untilTime) {
			setUntilError(__('Enter a date and a time.', 'orderwindow'));
			return;
		}
		setUntilError('');
		const ok = await runPause(
			() =>
				startPause({
					mode: 'until_time',
					until: `${untilDate} ${untilTime}`,
				}),
			__('Ordering is paused.', 'orderwindow')
		);
		if (ok) {
			setUntilDate('');
			setUntilTime('');
		}
	};

	const messageErrorId = `${ID}-message-error`;
	const messageError =
		serverErrors.closedMessage ||
		(problems.closedMessage
			? sprintf(
					/* translators: %d: the character limit. */
					__(
						'The message is too long: use at most %d characters.',
						'orderwindow'
					),
					MESSAGE_MAX
				)
			: '');
	const noteErrorId = `${ID}-note-error`;
	const noteError =
		serverErrors.scheduledOrderNoteText ||
		(problems.scheduledOrderNoteText
			? sprintf(
					/* translators: %d: the character limit. */
					__(
						'The note is too long: use at most %d characters.',
						'orderwindow'
					),
					MESSAGE_MAX
				)
			: '');
	// Shown inline only while the mode shows the note's fields; otherwise in the summary.
	const inlineErrors =
		model.closedMode === 'schedule'
			? ['closedMessage', 'scheduledOrderNoteText']
			: ['closedMessage'];
	const otherServerErrors = Object.entries(serverErrors).filter(
		([key]) => !inlineErrors.includes(key)
	);

	return (
		<Shell>
			<div
				className={`${ID}__status is-${line.tone}`}
				role="status"
				aria-live="polite"
			>
				<strong className={`${ID}__status-headline`}>
					{line.headline}
				</strong>
				<span className={`${ID}__status-detail`}>{line.detail}</span>
				{draft && (
					<span className={`${ID}__status-note`}>
						{__(
							'This reflects your saved settings.',
							'orderwindow'
						)}
					</span>
				)}
			</div>

			<section
				className={`${ID}__section`}
				aria-labelledby={`${ID}-enforce-title`}
			>
				<Title level={3} size={4} id={`${ID}-enforce-title`}>
					{__('Opening hours', 'orderwindow')}
				</Title>
				<label className={`${ID}__switch`} htmlFor={`${ID}-enforce`}>
					<input
						id={`${ID}-enforce`}
						type="checkbox"
						role="switch"
						checked={model.enforce}
						disabled={saving}
						aria-describedby={`${ID}-enforce-help`}
						onChange={(event) =>
							update({ enforce: event.target.checked })
						}
					/>
					<span>{__('Enforce opening hours', 'orderwindow')}</span>
				</label>
				<p id={`${ID}-enforce-help`} className={`${ID}__help`}>
					{__(
						'When on, shoppers can only order while the store is open; outside your store hours and closures the closed mode below applies. A pause applies either way.',
						'orderwindow'
					)}
				</p>
				{!model.enforce && !status.hoursAlwaysOpen && (
					<p className={`${ID}__warning`}>
						{__(
							'Hours are set but not enforced: shoppers can order at any time.',
							'orderwindow'
						)}
					</p>
				)}
			</section>

			<fieldset className={`${ID}__section ${ID}__modes`}>
				<legend>{__('When the store is closed', 'orderwindow')}</legend>
				{modeOptions().map((option) => (
					<div key={option.value} className={`${ID}__mode`}>
						<input
							id={`${ID}-mode-${option.value}`}
							type="radio"
							name={`${ID}-mode`}
							value={option.value}
							checked={model.closedMode === option.value}
							disabled={saving}
							aria-describedby={`${ID}-mode-${option.value}-help`}
							onChange={() =>
								update({ closedMode: option.value })
							}
						/>
						<label htmlFor={`${ID}-mode-${option.value}`}>
							{option.label}
						</label>
						<p
							id={`${ID}-mode-${option.value}-help`}
							className={`${ID}__help`}
						>
							{option.help}
						</p>
					</div>
				))}
			</fieldset>

			<section
				className={`${ID}__section`}
				aria-labelledby={`${ID}-message-title`}
			>
				<Title level={3} size={4} id={`${ID}-message-title`}>
					{__('Closed message', 'orderwindow')}
				</Title>
				<label htmlFor={`${ID}-message`} className={`${ID}__label`}>
					{__(
						'Message shown when an order is refused',
						'orderwindow'
					)}
				</label>
				<textarea
					id={`${ID}-message`}
					className={`${ID}__textarea${messageError ? ' has-error' : ''}`}
					rows={3}
					value={model.closedMessage}
					placeholder={status.defaultMessage}
					disabled={saving}
					aria-invalid={messageError ? 'true' : undefined}
					aria-describedby={[
						`${ID}-message-help`,
						`${ID}-message-count`,
						messageError ? messageErrorId : '',
					]
						.filter(Boolean)
						.join(' ')}
					onChange={(event) =>
						update({ closedMessage: event.target.value })
					}
				/>
				<div className={`${ID}__message-meta`}>
					<div id={`${ID}-message-help`} className={`${ID}__help`}>
						<p>
							{__(
								'Plain text. Leave it empty to use the default.',
								'orderwindow'
							)}
						</p>
						<p>{__('Tokens:', 'orderwindow')}</p>
						<ul className={`${ID}__tokens`}>
							<li>
								{__(
									'{next_open}: when the store next opens',
									'orderwindow'
								)}
							</li>
							<li>
								{__(
									'{closures_label}: the name of the closure in force',
									'orderwindow'
								)}
							</li>
						</ul>
						<p>
							{__(
								'Write “and” rather than “&”: some screen readers read “&” as “amp”.',
								'orderwindow'
							)}
						</p>
					</div>
					<p
						id={`${ID}-message-count`}
						className={`${ID}__count${length > MESSAGE_MAX ? ' is-over' : ''}`}
					>
						{sprintf(
							/* translators: 1: characters used, 2: the limit. */
							__('%1$d / %2$d characters', 'orderwindow'),
							length,
							MESSAGE_MAX
						)}
					</p>
				</div>
				{messageError && (
					<p
						id={messageErrorId}
						className="orderwindow-form-field-error-msg"
					>
						{messageError}
					</p>
				)}
				<p className={`${ID}__preview`}>
					<span>{__('Shoppers see:', 'orderwindow')}</span>{' '}
					<q>
						{previewMessage(
							model.closedMessage,
							status.defaultMessage,
							status.preview
						)}
					</q>
				</p>
			</section>

			{model.closedMode === 'schedule' && (
				<section
					className={`${ID}__section`}
					aria-labelledby={`${ID}-note-title`}
				>
					<Title level={3} size={4} id={`${ID}-note-title`}>
						{__('Order email note', 'orderwindow')}
					</Title>
					<label
						className={`${ID}__switch`}
						htmlFor={`${ID}-note-on`}
					>
						<input
							id={`${ID}-note-on`}
							type="checkbox"
							role="switch"
							checked={model.scheduledOrderNote}
							disabled={saving}
							aria-describedby={`${ID}-note-on-help`}
							onChange={(event) =>
								update({
									scheduledOrderNote: event.target.checked,
								})
							}
						/>
						<span>
							{__('Add a note to order emails', 'orderwindow')}
						</span>
					</label>
					<p id={`${ID}-note-on-help`} className={`${ID}__help`}>
						{__(
							'For orders placed while the store was closed, the note shows above the order details in the customer’s Processing order, Order on-hold and invoice emails.',
							'orderwindow'
						)}
					</p>
					<label htmlFor={`${ID}-note`} className={`${ID}__label`}>
						{__('Note', 'orderwindow')}
					</label>
					<textarea
						id={`${ID}-note`}
						className={`${ID}__textarea${noteError ? ' has-error' : ''}`}
						rows={3}
						value={model.scheduledOrderNoteText}
						placeholder={status.defaultScheduledNote}
						disabled={saving || !model.scheduledOrderNote}
						aria-invalid={noteError ? 'true' : undefined}
						aria-describedby={[
							`${ID}-note-help`,
							`${ID}-note-count`,
							noteError ? noteErrorId : '',
						]
							.filter(Boolean)
							.join(' ')}
						onChange={(event) =>
							update({
								scheduledOrderNoteText: event.target.value,
							})
						}
					/>
					<div className={`${ID}__message-meta`}>
						<div id={`${ID}-note-help`} className={`${ID}__help`}>
							<p>
								{__(
									'Plain text. Leave it empty to use the default.',
									'orderwindow'
								)}
							</p>
							<p>{__('Tokens:', 'orderwindow')}</p>
							<ul className={`${ID}__tokens`}>
								<li>
									{__(
										'{scheduled_for}: the date and time the order is scheduled for',
										'orderwindow'
									)}
								</li>
							</ul>
						</div>
						<p
							id={`${ID}-note-count`}
							className={`${ID}__count${noteLength > MESSAGE_MAX ? ' is-over' : ''}`}
						>
							{sprintf(
								/* translators: 1: characters used, 2: the limit. */
								__('%1$d / %2$d characters', 'orderwindow'),
								noteLength,
								MESSAGE_MAX
							)}
						</p>
					</div>
					{noteError && (
						<p
							id={noteErrorId}
							className="orderwindow-form-field-error-msg"
						>
							{noteError}
						</p>
					)}
					{model.scheduledOrderNote && (
						<p className={`${ID}__preview`}>
							<span>{__('Customers see:', 'orderwindow')}</span>{' '}
							<q>
								{previewNote(
									model.scheduledOrderNoteText,
									status.defaultScheduledNote,
									status.preview
								)}
							</q>
						</p>
					)}
				</section>
			)}

			<section
				className={`${ID}__section`}
				aria-labelledby={`${ID}-bar-title`}
			>
				<Title level={3} size={4} id={`${ID}-bar-title`}>
					{__('Shopper messages', 'orderwindow')}
				</Title>
				<label className={`${ID}__switch`} htmlFor={`${ID}-bar`}>
					<input
						id={`${ID}-bar`}
						type="checkbox"
						role="switch"
						checked={model.noticeBar}
						disabled={saving}
						aria-describedby={`${ID}-bar-help`}
						onChange={(event) =>
							update({ noticeBar: event.target.checked })
						}
					/>
					<span>
						{__('Show a notice bar while closed', 'orderwindow')}
					</span>
				</label>
				<p id={`${ID}-bar-help`} className={`${ID}__help`}>
					{__(
						'A bar at the top of the page shows the closed message while ordering is closed or paused, and is hidden while the store is open. Shoppers can dismiss it for their visit. It never shows on the pay-for-order and order-received pages.',
						'orderwindow'
					)}
				</p>
				<fieldset
					className={`${ID}__scopes`}
					disabled={saving || !model.noticeBar}
				>
					<legend>{__('Where it shows', 'orderwindow')}</legend>
					{[
						{
							value: 'woocommerce',
							label: __('WooCommerce pages only', 'orderwindow'),
							help: __(
								'The shop, product pages, cart, checkout and My Account. Other pages load nothing.',
								'orderwindow'
							),
						},
						{
							value: 'all',
							label: __('Every page', 'orderwindow'),
							help: __(
								'Every page of the site, including the home page and posts.',
								'orderwindow'
							),
						},
					].map((option) => (
						<div key={option.value} className={`${ID}__scope`}>
							<input
								id={`${ID}-bar-scope-${option.value}`}
								type="radio"
								name={`${ID}-bar-scope`}
								value={option.value}
								checked={model.noticeBarScope === option.value}
								aria-describedby={`${ID}-bar-scope-${option.value}-help`}
								onChange={() =>
									update({ noticeBarScope: option.value })
								}
							/>
							<label htmlFor={`${ID}-bar-scope-${option.value}`}>
								{option.label}
							</label>
							<p
								id={`${ID}-bar-scope-${option.value}-help`}
								className={`${ID}__help`}
							>
								{option.help}
							</p>
						</div>
					))}
				</fieldset>
			</section>

			<div
				ref={summaryRef}
				tabIndex={-1}
				aria-live="polite"
				className={`${ID}__summary${saveError || otherServerErrors.length ? ' has-errors' : ''}`}
			>
				{saveError && (
					<p>
						{sprintf(
							/* translators: %s: error message. */
							__(
								'The settings weren’t saved: %s Your changes are kept; try again.',
								'orderwindow'
							),
							saveError
						)}
					</p>
				)}
				{otherServerErrors.map(([key, message]) => (
					<p key={key}>{message}</p>
				))}
			</div>

			<div className={`${ID}__actions`}>
				<Button
					type="primary"
					onClick={onSave}
					loading={saving}
					disabled={
						!draft || saving || Object.keys(problems).length > 0
					}
				>
					{__('Save', 'orderwindow')}
				</Button>
				{draft && (
					<small>
						{__('You have unsaved changes.', 'orderwindow')}
					</small>
				)}
			</div>

			<Divider />

			<section
				className={`${ID}__section ${ID}__pause`}
				aria-labelledby={`${ID}-pause-title`}
			>
				<Title level={3} size={4} id={`${ID}-pause-title`}>
					{__('Pause ordering', 'orderwindow')}
				</Title>
				<p className={`${ID}__pause-state`} aria-live="polite">
					{pauseStateText(status.pause)}
				</p>
				<p className={`${ID}__help`}>
					{__(
						'Pausing applies at once, whether or not opening hours are enforced. It doesn’t change the settings above.',
						'orderwindow'
					)}
				</p>
				{paused && (
					<div className={`${ID}__pause-row`}>
						<Button
							type="primary"
							disabled={pauseBusy}
							onClick={() =>
								runPause(
									resumeOrdering,
									__('Ordering resumed.', 'orderwindow')
								)
							}
						>
							{__('Resume ordering', 'orderwindow')}
						</Button>
					</div>
				)}
				<div
					className={`${ID}__pause-row`}
					role="group"
					aria-label={__('Pause for', 'orderwindow')}
				>
					<span className={`${ID}__pause-label`} aria-hidden="true">
						{paused
							? __('Pause instead for:', 'orderwindow')
							: __('Pause for:', 'orderwindow')}
					</span>
					{pausePresets().map((preset) => {
						const unavailable =
							preset.id === 'next' && !status.nextOpening;
						return (
							<Button
								key={preset.id}
								disabled={pauseBusy || unavailable}
								onClick={() =>
									runPause(
										() => startPause(preset.body),
										__('Ordering is paused.', 'orderwindow')
									)
								}
							>
								{preset.label}
							</Button>
						);
					})}
					<Button
						disabled={pauseBusy}
						onClick={() => setConfirmResumed(true)}
					>
						{__('Until I resume', 'orderwindow')}
					</Button>
				</div>
				{!status.nextOpening && (
					<p className={`${ID}__help`}>
						{__(
							'“Until the next opening” needs an opening after the current one in your store hours.',
							'orderwindow'
						)}
					</p>
				)}
				<div
					className={`${ID}__pause-row ${ID}__until`}
					role="group"
					aria-labelledby={`${ID}-until-title`}
				>
					<span
						id={`${ID}-until-title`}
						className={`${ID}__pause-label`}
					>
						{__('Until a date and time:', 'orderwindow')}
					</span>
					<DateField
						id={`${ID}-until-date`}
						label={__('Resume on', 'orderwindow')}
						value={untilDate}
						onChange={(value) => {
							setUntilDate(value);
							setUntilError('');
						}}
						disabled={pauseBusy}
						describedBy={untilError ? `${ID}-until-error` : ''}
						className={`${ID}__until-date`}
					/>
					<TimeField
						id={`${ID}-until-time`}
						label={__('At (store time)', 'orderwindow')}
						value={untilTime}
						onChange={(value) => {
							setUntilTime(value);
							setUntilError('');
						}}
						disabled={pauseBusy}
						describedBy={untilError ? `${ID}-until-error` : ''}
					/>
					<Button disabled={pauseBusy} onClick={pauseUntilTime}>
						{__('Pause until then', 'orderwindow')}
					</Button>
				</div>
				{untilError && (
					<p
						id={`${ID}-until-error`}
						className="orderwindow-form-field-error-msg"
					>
						{untilError}
					</p>
				)}
				{pauseError && (
					<p className={`${ID}__pause-error`} role="alert">
						{sprintf(
							/* translators: %s: error message. */
							__('Ordering wasn’t paused: %s', 'orderwindow'),
							pauseError
						)}
					</p>
				)}
				<p className={`${ID}__help`}>
					{sprintf(
						/* translators: %s: today's date in the store, Y-m-d. */
						__(
							'Dates and times are the store’s (today is %s there).',
							'orderwindow'
						),
						storeToday()
					)}
				</p>
			</section>

			<ConfirmDialog
				isOpen={confirmResumed}
				title={__('Pause ordering until you resume?', 'orderwindow')}
				message={__(
					'Shoppers can’t order until you click Resume, here or in the admin bar. Opening hours don’t end this pause.',
					'orderwindow'
				)}
				confirmLabel={__('Pause ordering', 'orderwindow')}
				busy={pauseBusy}
				onCancel={() => setConfirmResumed(false)}
				onConfirm={async () => {
					await runPause(
						() => startPause({ mode: 'until_resumed' }),
						__(
							'Ordering is paused until you resume it.',
							'orderwindow'
						)
					);
					setConfirmResumed(false);
				}}
			/>
		</Shell>
	);
};

/**
 * The tab's frame: title and divider, as the Store hours tab has.
 *
 * @param {Object} props          Props.
 * @param {*}      props.children Content.
 * @return {JSX.Element} The frame.
 */
function Shell({ children }) {
	return (
		<Flex
			vertical
			gap={10}
			style={{ flexGrow: 1, minWidth: 0, maxWidth: '900px' }}
		>
			<Content>
				<Flex vertical gap={10}>
					<Title level={2} size={3}>
						{__('Ordering', 'orderwindow')}
					</Title>
					<Divider />
					<div className={ID}>{children}</div>
				</Flex>
			</Content>
		</Flex>
	);
}

export default Ordering;
