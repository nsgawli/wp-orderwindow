import React, { createContext, useContext, useState } from 'react';

const AlertsContext = createContext();

export const AlertsProvider = ({ children }) => {
	const [alerts, setAlerts] = useState([]);
	const addAlert = (alert) => {
		setAlerts((prev) => [...prev, alert]);
	};
	const removeAlert = (id) => {
		setAlerts((prev) => prev.filter((alert) => alert.id !== id));
	};

	return (
		<AlertsContext.Provider value={{ alerts, addAlert, removeAlert }}>
			{children}
		</AlertsContext.Provider>
	);
};

export const useAlerts = () => {
	return useContext(AlertsContext);
};
