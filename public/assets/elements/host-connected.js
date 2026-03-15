/**
 * Render a simple connected status entry for a given host
 *
 * @license AGPLv3
 * @author Charlie Powell <cdp1337@bitsnbytes.dev>
 */
class HostConnectedMetricElement extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();

		this.valueNode = null;
		this._attached = false;

		/**
		 * Handler for live host data updates.
		 *
		 * @param {CustomEvent} e
		 */
		this.hostChangeListener = e => {
			// Attach the event listener for this node to retrieve live metrics.
			if (e.detail.host === this.host) {
				if (e.detail.hasOwnProperty('connected')) {
					this.value = e.detail.connected;
				}
				else {
					// If this device sent data recently, it's likely still connected.
					this.value = true;
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

		const valueNode = this.valueNode || document.createElement('span');

		valueNode.className = 'value critical';
		valueNode.textContent = '✖ Disconnected';
		if (!this.valueNode) {
			this.appendChild(valueNode);
			this.valueNode = valueNode;
		}
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
	 * Set the status of the connected state.
	 *
	 * @param {boolean} connected
	 */
	set value(connected) {
		if (connected) {
			this.valueNode.textContent = '✔ Connected';
			this.valueNode.className = 'value good';
		}
		else {
			this.valueNode.textContent = '✖ Disconnected';
			this.valueNode.className = 'value critical';
		}
	}
}

customElements.define('host-connected-metric', HostConnectedMetricElement);
