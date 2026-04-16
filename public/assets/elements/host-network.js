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

		this.txNode = null;
		this.rxNode = null;
		this._attached = false;

		/**
		 * Handler for live host data updates.
		 *
		 * @param {CustomEvent} e
		 */
		this.hostChangeListener = e => {
			// Attach the event listener for this node to retrieve live metrics.
			if (e.detail.host === this.host) {
				if (e.detail.hasOwnProperty('net_tx')) {
					this.txValue = e.detail.net_tx;
				}
				if (e.detail.hasOwnProperty('net_rx')) {
					this.rxValue = e.detail.net_rx;
				}
			}
		};
	}

	/**
	 * Called when the element is added to the DOM.
	 */
	connectedCallback() {
		this._attached = true;
		this.render();
		document.addEventListener('hostChange', this.hostChangeListener);
	}

	/**
	 * Called when the element is removed from the DOM.
	 */
	disconnectedCallback() {
		this._attached = false;
		document.removeEventListener('hostChange', this.hostChangeListener);
	}

	/**
	 * Called when an observed attribute changes.
	 */
	static get observedAttributes() {
		return ['host'];
	}

	/**
	 * Called when an observed attribute changes.
	 *
	 * Only fires when setAttribute is called.
	 *
	 * @param {string} name
	 * @param oldValue
	 * @param newValue
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			// General attribute change, we don't really care which one.
			this.render();
		}
	}

	render() {
		// Skip rendering if we're not ready yet.
		if (!(this._attached && this.host)) {
			return;
		}

		const txNode = this.txNode || document.createElement('span'),
			rxNode = this.rxNode || document.createElement('span');

		txNode.className = 'net-tx';
		txNode.textContent = '0 bps ↑';
		if (!this.txNode) {
			this.appendChild(txNode);
			this.txNode = txNode;
		}

		rxNode.className = 'net-rx';
		rxNode.textContent = '↓ 0 bps';
		if (!this.rxNode) {
			this.appendChild(rxNode);
			this.rxNode = rxNode;
		}

		// Initial data lookup
		getHost(this.host).then(hostData => {
			// Initial hostData may or may not contain metrics data, that's fine.
			if (hostData.hasOwnProperty('metrics')) {
				this.txValue = hostData.metrics.net_tx;
				this.rxValue = hostData.metrics.net_rx;
			}
		}).catch(() => {

		});
	}

	/**
	 * Get the host identifier.
	 *
	 * @returns {string}
	 */
	get host() {
		return this.getAttribute('host');
	}

	/**
	 * Set the host identifier.
	 *
	 * @param {string} value
	 */
	set host(value) {
		this.setAttribute('host', value);
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
