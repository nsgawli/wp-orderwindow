import React from 'react';
import { Flex } from '@framework/components';
import './index.css';

const EmptyState = ({
	title = 'No Data Found',
	description = '',
	icon = null,
	action = null,
}) => {
	return (
		<Flex
			className="orderwindow-empty-state"
			vertical
			align="center"
			gap={15}
		>
			{icon && (
				<div className="orderwindow-empty-state-icon">
					{icon}
				</div>
			)}

			<div className="orderwindow-empty-state-title">
				{title}
			</div>

			{description && (
				<div className="orderwindow-empty-state-description">
					{description}
				</div>
			)}

			{action}
		</Flex>
	);
};

export default EmptyState;