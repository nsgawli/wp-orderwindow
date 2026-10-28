/**
 * What the current user may do, from the inline `window.orderWindowSettings`
 * object (`Admin\SettingsPage::enqueue_scripts()`). Only shapes the UI; the
 * REST routes enforce every check themselves.
 */
export const canManageSite = () =>
	Boolean(window.orderWindowSettings?.user?.canManageSite);
