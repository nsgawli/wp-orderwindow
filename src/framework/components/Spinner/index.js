import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import './index.css';

const Spinner = React.memo(({ className = '' }) => (
	<FaSpinner
		className={`orderwindow-spinner-icon${className ? ' ' + className : ''}`}
	/>
));

export default Spinner;
