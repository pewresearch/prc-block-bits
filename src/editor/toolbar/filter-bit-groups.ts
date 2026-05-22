/**
 * Client-side search filter for the modal bits picker.
 */

import type { BitDescriptor } from '../registry';

function bitMatchesQuery(
	bit: BitDescriptor,
	categoryLabel: string,
	normalizedQuery: string
): boolean {
	const slugTail = bit.name.includes('/')
		? bit.name.slice(bit.name.indexOf('/') + 1)
		: bit.name;

	const haystacks = [bit.title, bit.label, bit.name, slugTail, categoryLabel];

	return haystacks.some((value) =>
		value.toLowerCase().includes(normalizedQuery)
	);
}

/**
 * Return a copy of `groups` containing only bits (and categories) that match
 * `query`. Empty or whitespace-only query returns `groups` unchanged.
 */
export function filterBitGroups(
	groups: Map<string, BitDescriptor[]>,
	query: string
): Map<string, BitDescriptor[]> {
	const normalizedQuery = query.trim().toLowerCase();

	if (!normalizedQuery) {
		return groups;
	}

	const filtered = new Map<string, BitDescriptor[]>();

	for (const [category, bits] of groups.entries()) {
		const matchingBits = bits.filter((bit) =>
			bitMatchesQuery(bit, category, normalizedQuery)
		);

		if (matchingBits.length > 0) {
			filtered.set(category, matchingBits);
		}
	}

	return filtered;
}
