import apiFetch from '@wordpress/api-fetch';
import { dispatch, select } from '@wordpress/data';
import { store as settingsStore } from './store';
import type { ApiResponse } from './types';

const REST_PATH = '/prc-block-bits/v1/settings';

export async function fetchSettings(): Promise<ApiResponse> {
	const { setFromResponse } = dispatch(settingsStore);
	const response = (await apiFetch({ path: REST_PATH })) as ApiResponse;
	setFromResponse(response);
	return response;
}

export async function saveSettings(): Promise<ApiResponse> {
	const { setFromResponse } = dispatch(settingsStore);
	const settings = select(settingsStore).getSettings();
	const response = (await apiFetch({
		path: REST_PATH,
		method: 'POST',
		data: settings,
	})) as ApiResponse;
	setFromResponse(response);
	return response;
}
