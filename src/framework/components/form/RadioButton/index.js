import React from 'react';
import { Controller, useController } from 'react-hook-form';
import Flex from '@framework/components/Flex';
import Label from '@framework/components/form/Label';
import { useFieldIds } from '@framework/components/form/fieldIds';
import '../index.css'; // form styles
import './index.css'; // radio button styles

const RadioButton = ({
	name,
	options,
	control,
	label = null,
	validations = {},
	className = '',
	extaInfo = '',
	style = {},
}) => {
	const { fieldState } = useController({
		name,
		control,
	});
	const ids = useFieldIds();

	className = className ? `orderwindow-form-field ${className}` : 'orderwindow-form-field';

	return (
		<Flex className={className} style={style} vertical gap={3}>
			{label && (
				<Label
					text={label}
					id={ids.field}
					required={validations.required ? true : false}
				/>
			)}
			{extaInfo && <small id={ids.info}>{extaInfo}</small>}
			<Controller
				name={name}
				control={control}
				rules={validations}
				defaultValue={[]}
				render={({ field }) => (
					// The group is named by its label and described by its help and error (OW-053).
					<div
						role="radiogroup"
						aria-labelledby={label ? ids.field : undefined}
						aria-describedby={
							[extaInfo ? ids.info : '', fieldState.error?.message ? ids.error : '']
								.filter(Boolean)
								.join(' ') || undefined
						}
						aria-required={validations.required ? true : undefined}
						className="orderwindow-radio-group"
					>
						{options.map((option, index) => (
							<label key={index} className="orderwindow-radio-option">
								<input
									type="radio"
									{...field}
									value={option.value}
									checked={field.value === option.value}
									onChange={() => {
										field.onChange(option.value);
									}}
								/>
								{option.label}
							</label>
						))}
					</div>
				)}
			/>
			{fieldState.error && fieldState.error.message && (
				<small id={ids.error} className="orderwindow-form-field-error-msg">
					{fieldState.error.message}
				</small>
			)}
		</Flex>
	);
};

export default RadioButton;
