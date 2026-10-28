import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import { Flex, Content, Title, Divider, Tabs } from '@framework/components';
import { tabPanelProps } from '@framework/components/Tabs';
import { storeNow, storeZoneLabel } from '@framework/utils/siteTime';
import { canManageSite } from '../user';
import TimezoneNotice from '../TimezoneNotice';

import WeeklyHours from './weekly';
import Closures from './closures';
import SpecialHours from './special-hours';
import Preview from './preview';
import './index.css';

export const BASE_PATH = '/store-hours';

const subTabs = () => [
	{
		key: 'weekly',
		label: __('Weekly hours', 'orderwindow'),
		element: <WeeklyHours />,
	},
	{
		key: 'closures',
		label: __('Closures', 'orderwindow'),
		element: <Closures />,
	},
	{
		key: 'special-hours',
		label: __('Special hours', 'orderwindow'),
		element: <SpecialHours />,
	},
	{
		key: 'preview',
		label: __('Preview', 'orderwindow'),
		element: <Preview />,
	},
];

/** The time-zone line: times on this screen are the store's wall-clock times. */
function StoreClock() {
	const [now, setNow] = useState(() => storeNow());

	useEffect(() => {
		const timer = window.setInterval(() => setNow(storeNow()), 30000);
		return () => window.clearInterval(timer);
	}, []);

	return (
		<p className="orderwindow-store-clock">
			{sprintf(
				/* translators: 1: time zone, e.g. "Europe/London" or "UTC+5:30"; 2: the store's current time. */
				__(
					'Times use the store’s time zone: %1$s. Store time now: %2$s.',
					'orderwindow'
				),
				storeZoneLabel(),
				now
			)}{' '}
			{canManageSite() && (
				<a href="options-general.php#timezone_string">
					{__('Change it in Settings → General.', 'orderwindow')}
				</a>
			)}
		</p>
	);
}

const StoreHours = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const tabs = subTabs();
	const segment = location.pathname.replace(/\/$/, '').split('/')[2];
	const current = tabs.find((tab) => tab.key === segment);

	// `#/store-hours` and unknown sub-routes open Weekly hours.
	useEffect(() => {
		if (!current) {
			navigate(`${BASE_PATH}/weekly`, { replace: true });
		}
	}, [current, navigate]);

	return (
		<Flex
			vertical
			gap={10}
			style={{ flexGrow: 1, minWidth: 0, maxWidth: '900px' }}
		>
			<Content>
				<Flex vertical gap={10}>
					<Flex vertical gap={5}>
						<Title level={2} size={3}>
							{__('Store hours', 'orderwindow')}
						</Title>
						<StoreClock />
					</Flex>
					<TimezoneNotice />
					<Divider />
					<Tabs
						items={tabs}
						active={current?.key}
						onChange={(key) => navigate(`${BASE_PATH}/${key}`)}
						idPrefix="orderwindow-store-hours"
						ariaLabel={__('Store hours', 'orderwindow')}
					/>
					{current && (
						<div
							{...tabPanelProps(
								'orderwindow-store-hours',
								current.key
							)}
							className="orderwindow-store-hours-panel"
						>
							{current.element}
						</div>
					)}
				</Flex>
			</Content>
		</Flex>
	);
};

export default StoreHours;
