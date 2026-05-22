import {
	Icon,
	__experimentalText as Text,
	__experimentalVStack as VStack,
	__experimentalHStack as HStack,
	Card,
	Button,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { chevronDown } from '@wordpress/icons';
import { useState } from '@wordpress/element';
import type { SettingsAccordionProps } from '../types';

export default function SettingsAccordion({
	title,
	description,
	children,
	contentId,
	headingId,
	descriptionId,
}: SettingsAccordionProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Card className="block-bits-settings__accordion">
			<Button
				className="block-bits-settings__accordion-trigger"
				onClick={() => setIsOpen(!isOpen)}
				aria-expanded={isOpen}
				aria-controls={contentId}
				aria-describedby={descriptionId}
				aria-label={
					isOpen
						? sprintf(
								/* translators: %s: section title */
								__('Collapse %s settings', 'prc-block-bits'),
								title
							)
						: sprintf(
								/* translators: %s: section title */
								__('Expand %s settings', 'prc-block-bits'),
								title
							)
				}
			>
				<HStack alignment="top" justify="space-between">
					<VStack spacing={1}>
						<h3
							className="block-bits-settings__accordion-header"
							id={headingId}
						>
							{title}
						</h3>
						<Text
							className="block-bits-settings__accordion-description"
							id={descriptionId}
						>
							{description}
						</Text>
					</VStack>
					<Icon
						className={
							isOpen
								? 'block-bits-settings__accordion-chevron-up'
								: 'block-bits-settings__accordion-chevron-down'
						}
						icon={chevronDown}
					/>
				</HStack>
			</Button>
			{isOpen && (
				<div
					className="block-bits-settings__accordion-form"
					role="region"
					id={contentId}
					aria-labelledby={headingId}
				>
					{children}
				</div>
			)}
		</Card>
	);
}
