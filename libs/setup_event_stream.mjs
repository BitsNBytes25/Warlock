import {Host} from "../db.js";
import {HostData} from "./host_data.mjs";

/**
 * Setup a request as an event stream
 *
 * @param req
 * @param res
 * @param next
 */
export function setupEventStream(req, res, next) {
	let interval = null;

	// Send the header to signal the browser this is an event stream connection.
	res.writeHead(200, {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive'
	});

	const onClientClose = () => {
		res.locals.clientGone = true;
	};

	const keepAlive = () => {
		if (res.locals.clientGone) {
			clearInterval(interval);
			return;
		}
		res.write(':keepalive\n\n');
	}

	// Track client disconnects
	res.locals.clientGone = false;
	req.on('close', onClientClose);
	req.on('aborted', onClientClose);
	res.on('close', onClientClose);

	// Send a keepalive every minute
	interval = setInterval(keepAlive, 60000);

	// Run next middleware function
	next();
}
