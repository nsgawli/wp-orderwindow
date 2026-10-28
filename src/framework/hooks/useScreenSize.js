import React, { createContext, useContext, useState, useEffect } from 'react';

const sizes = {
	xs: 0,
	sm: 576,
	md: 768,
	lg: 992,
	xl: 1200,
};

const getElementScreenSize = (element) => {
	if (element) {
		const width = element.clientWidth;
		if (width >= sizes.xl) return 'xl';
		else if (width >= sizes.lg) return 'lg';
		else if (width >= sizes.md) return 'md';
		else if (width >= sizes.sm) return 'sm';
		else return 'xs';
	}
	return 'xs';
};

const ScreenSizeContext = createContext();

export const ScreenSizeProvider = ({ element, children }) => {
	const [screenSize, setScreenSize] = useState('xs');

	useEffect(() => {
		const updateScreenSize = () => {
			setScreenSize(getElementScreenSize(element));
		};
		updateScreenSize();
		window.addEventListener('resize', updateScreenSize);
		return () => window.removeEventListener('resize', updateScreenSize);
	}, [element]);

	return (
		<ScreenSizeContext.Provider value={{ screenSize }}>
			{children}
		</ScreenSizeContext.Provider>
	);
};

export const useScreenSize = () => {
	return useContext(ScreenSizeContext);
};
