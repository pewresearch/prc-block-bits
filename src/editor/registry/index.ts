export {
	registerBlockBit,
	getBlockBit,
	getAllBlockBits,
	getBitsApplicableTo,
	getBitsGroupedByCategory,
	hydrateFromWindow,
	resetRegistry,
	UNCATEGORIZED_LABEL,
} from './registry';

export type {
	AttributeType,
	BitAttributeSchema,
	BitDescriptor,
	BitEditComponent,
	BitEditProps,
	ServerBitProjection,
} from './registry';
