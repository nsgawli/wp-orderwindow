<?php // phpcs:ignore WordPress.Files.FileName.NotHyphenatedLowercase -- PSR-4: the file is named after its class.
/**
 * Fired when the plugin is uninstalled.
 *
 * @package orderwindow
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Handles plugin uninstall cleanup.
 *
 * Every option, transient, user meta key, table and cron hook the plugin
 * adds must be removed here.
 */
class OrderWindow_Uninstall {

	/**
	 * Sites read per query when walking a network.
	 *
	 * @var int
	 */
	const SITES_PER_BATCH = 100;

	/**
	 * Run uninstall cleanup.
	 *
	 * On multisite WordPress runs this file once, in the main site's context, so every site
	 * of every network is visited in batches and each one follows its own "remove data"
	 * setting (OW-049).
	 *
	 * @return void
	 */
	public static function run() {

		if ( ! is_multisite() ) {
			self::run_site();
			return;
		}

		$offset = 0;

		do {
			$site_ids = get_sites(
				array(
					'fields'                 => 'ids',
					'number'                 => self::SITES_PER_BATCH,
					'offset'                 => $offset,
					'orderby'                => 'id',
					'order'                  => 'ASC',
					'update_site_meta_cache' => false,
				)
			);

			foreach ( $site_ids as $site_id ) {
				switch_to_blog( $site_id );
				self::run_site();
				restore_current_blog();
			}

			$offset    += self::SITES_PER_BATCH;
			$batch_size = count( $site_ids );
		} while ( self::SITES_PER_BATCH === $batch_size );
	}

	/**
	 * Clean up the current site when its settings allow it.
	 *
	 * @return void
	 */
	private static function run_site() {

		if ( ! self::should_remove_data() ) {
			return;
		}

		self::delete_options();
		self::delete_transients();
	}

	/**
	 * Check if settings allow data cleanup.
	 *
	 * @return bool
	 */
	private static function should_remove_data() {

		$general_settings = get_option( 'orderwindow_general_settings', array() );

		return is_array( $general_settings ) && ! empty( $general_settings['removeDataOnUninstall'] );
	}

	/**
	 * Delete plugin options.
	 *
	 * @return void
	 */
	private static function delete_options() {

		delete_option( 'orderwindow_general_settings' );
		delete_option( 'orderwindow_schedule_settings' );
		delete_option( 'orderwindow_closures_settings' );
		delete_option( 'orderwindow_behaviour_settings' );
		delete_option( 'orderwindow_pause_state' );
		delete_option( 'orderwindow_current_version' );
	}

	/**
	 * Delete plugin transients.
	 *
	 * @return void
	 */
	private static function delete_transients() {

		delete_transient( 'orderwindow_installing' );
		delete_transient( 'orderwindow_activation_redirect' );
		delete_transient( 'orderwindow_invalid_schedule_logged' );
		delete_transient( 'orderwindow_policy_error_logged' );
	}
}

OrderWindow_Uninstall::run();
