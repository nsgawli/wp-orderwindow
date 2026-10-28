import React from 'react';
import './index.css';

const Badge = ({
	type = 'default',
	children,
	className = '',
}) => {
	return (
		<span className={`orderwindow-badge orderwindow-badge-${type} ${className}`}>
			{children}
		</span>
	);
};

export default Badge;