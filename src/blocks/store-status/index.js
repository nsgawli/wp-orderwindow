import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import Edit from './edit';

// Rendered by PHP (`Frontend\StoreStatus`): nothing is saved.
registerBlockType(metadata.name, {
	edit: Edit,
	save: () => null,
});
