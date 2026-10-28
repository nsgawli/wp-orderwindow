import React from 'react';

const Flex = React.memo(
	({
		vertical = false,
		wrap = false,
		justify = '',
		align = '',
		gap = 0,
		id = '',
		className = '',
		onClick = null,
		children,
		style = {},
	}) => {
		let styles = {
			display: 'flex',
		};

		if (wrap) {
			styles.flexWrap = 'wrap';
		}

		if (vertical) {
			styles.flexFlow = 'column';
		}

		if (justify !== '') {
			styles.justifyContent = justify;
		}

		if (align !== '') {
			styles.alignItems = align;
		}

		if (gap > 0) {
			styles.gap = gap;
		}

		styles = { ...styles, ...style };

		return (
			<div id={id} className={className} onClick={onClick} style={styles}>
				{children}
			</div>
		);
	}
);

export default Flex;
