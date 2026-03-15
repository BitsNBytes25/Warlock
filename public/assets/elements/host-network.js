/**
 * Render a dynamic Network bandwidth entry for a given host
 *
 * @license AGPLv3
 * @author Charlie Powell <cdp1337@bitsnbytes.dev>
 */
class HostNetworkMetricElement extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();

		this.txNode = document.createElement('span');
		this.rxNode = document.createElement('span');
		this.host = null;
	}

	/**
	 * Called when the element is added to the DOM.
	 */
	connectedCallback() {
		this.render();

		// Attach the event listener for this node to retrieve live metrics.
		document.addEventListener('hostChange', e => {
			if (e.detail.host === this.host) {
				if (e.detail.hasOwnProperty('net_tx')) {
					this.txValue = e.detail.net_tx;
				}
				if (e.detail.hasOwnProperty('net_rx')) {
					this.rxValue = e.detail.net_rx;
				}
			}
		});
	}

	render() {
		this.host = this.getAttribute('host');

		// This module requires a host to be specified.
		if (!this.host) {
			this.innerHTML = 'ERROR: No host specified';
			return;
		}

		const container = document.createElement('div');
		container.className = 'network-values';

		this.txNode.className = 'net-tx';
		this.txNode.textContent = '0 bps ↑';
		container.appendChild(this.txNode);

		this.rxNode.className = 'net-rx';
		this.rxNode.textContent = '↓ 0 bps';
		container.appendChild(this.rxNode);

		this.appendChild(container);

		// Initial data lookup
		getHost(this.host).then(hostData => {
			// Initial hostData may or may not contain metrics data, that's fine.
			if (hostData.hasOwnProperty('metrics')) {
				this.txValue = hostData.metrics.net_tx;
				this.rxValue = hostData.metrics.net_rx;
			}
		});
	}

	/**
	 * Set the value of network transmit (upload) bandwidth in bits per second.
	 *
	 * @param {string|number|null} bps
	 */
	set txValue(bps) {
		bps = parseFloat(bps);
		if (isNaN(bps)) {
			bps = 0;
		}

		// Use numberTick for updating the value if it's available.
		if (typeof numberTick === 'function') {
			numberTick(
				this.txNode,
				bps,
				v => formatBitSpeed(v) + ' ↑'
			);
		}
		else {
			this.txNode.textContent = formatBitSpeed(bps) + ' ↑';
		}
	}

	/**
	 * Set the value of network receive (download) bandwidth in bits per second.
	 *
	 * @param {string|number|null} bps
	 */
	set rxValue(bps) {
		bps = parseFloat(bps);
		if (isNaN(bps)) {
			bps = 0;
		}

		// Use numberTick for updating the value if it's available.
		if (typeof numberTick === 'function') {
			numberTick(
				this.rxNode,
				bps,
				v => '↓ ' + formatBitSpeed(v)
			);
		}
		else {
			this.rxNode.textContent = '↓ ' + formatBitSpeed(bps);
		}
	}
}

customElements.define('host-network-metric', HostNetworkMetricElement);

