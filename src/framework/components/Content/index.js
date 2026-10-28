import React from 'react';
import './index.css';

const Content = React.memo(({ children, style = {} }) => {
	return (
		<div className="orderwindow-content" style={style}>
			{children}
		</div>
	);
});

export default Content;
