<?php // phpcs:ignore WordPress.Files.FileName.NotHyphenatedLowercase -- PSR-4: the file is named after its class.
namespace OrderWindow\RestApi;

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use OrderWindow\RestApi\OrderingStatus;
use OrderWindow\RestApi\Pause;
use OrderWindow\RestApi\Schedule\Preview;
use OrderWindow\RestApi\Settings\Behaviour;
use OrderWindow\RestApi\Settings\Closures;
use OrderWindow\RestApi\Settings\General;
use OrderWindow\RestApi\Settings\Schedule;
use OrderWindow\RestApi\Status;

/**
 * REST API Loader.
 */
class Autoloader {

	/**
	 * Initialize REST API controllers.
	 *
	 * @return void
	 */
	public static function init() {

		General::init();
		Schedule::init();
		Closures::init();
		Preview::init();
		Behaviour::init();
		Pause::init();
		OrderingStatus::init();
		Status::init();
	}
}
