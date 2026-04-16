/**
 * Render a dynamic CPU entry for a given host
 *
 * @license AGPLv3
 * @author Charlie Powell <cdp1337@bitsnbytes.dev>
 */
class HostCPUMetricElement extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();

		this.valueNode = null;
		this.graphNode = null;
		this.fillNode = null;
		this.detailsNode = null;
		this._attached = false;

		/**
		 * Handler for live host data updates.
		 *
		 * @param {CustomEvent} e
		 */
		this.hostChangeListener = e => {
			// Attach the event listener for this node to retrieve live metrics.
			if (e.detail.host === this.host && e.detail.hasOwnProperty('cpu_usage')) {
				this.value = e.detail.cpu_usage;
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
		return ['host', 'model', 'bargraph'];
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

	/**
	 * Render this element.
	 *
	 * This will create the necessary DOM elements and attach event listeners.
	 * It will also perform initial data lookup and initial rendering.
	 */
	render() {
		// Skip rendering if we're not ready yet.
		if (!(this._attached && this.host)) {
			return;
		}

		const valueNode = this.valueNode || document.createElement('span'),
			detailsNode = this.detailsNode || document.createElement('div'),
			graphNode = this.graphNode || document.createElement('div'),
			fillNode = this.fillNode || document.createElement('div');

		let lastNode = null;

		valueNode.className = 'value';
		if (!this.valueNode) {
			this.appendChild(valueNode);
			this.valueNode = valueNode;
		}
		lastNode = valueNode;

		if (this.model) {
			// Model selected to be included, ensure it's rendered
			detailsNode.className = 'cpu-details';
			if (!this.detailsNode) {
				this.insertBefore(detailsNode, lastNode.nextSibling);
				this.detailsNode = detailsNode;
			}
			lastNode = detailsNode;
		}
		else if (this.detailsNode) {
			// Model probably changed and is no longer requested, remove it.
			this.removeChild(this.detailsNode);
			this.detailsNode = null;
		}

		if (this.bargraph) {
			// Bar graph selected, ensure it's rendered
			graphNode.className = 'bargraph-h';
			fillNode.className = 'fill';

			if (!this.graphNode) {
				graphNode.appendChild(fillNode);
				this.insertBefore(graphNode, lastNode.nextSibling);
				this.graphNode = graphNode;
				this.fillNode = fillNode;
			}
		}
		else if(this.graphNode) {
			// Bargraph is present but not requested, remove it.
			this.removeChild(this.graphNode);
			this.graphNode = null;
			this.fillNode = null;
		}

		// Initial data lookup
		getHost(this.host).then(hostData => {
			if (this.model) {
				detailsNode.innerHTML = hostData.cpu.model || 'Unknown CPU';
			}

			// Initial hostData may or may not contain metrics data, that's fine.
			if (hostData.hasOwnProperty('metrics')) {
				this.value = hostData.metrics.cpu_usage;
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
	 * Get if the model details should be displayed.
	 *
	 * @returns {boolean}
	 */
	get model() {
		return this.getAttribute('model') === '1';
	}

	/**
	 * Enable/disable model details rendering
	 *
	 * @param {boolean} value
	 */
	set model(value) {
		this.setAttribute('model', value ? '1' : '0');
	}

	/**
	 * Get if the bargraph should be displayed.
	 *
	 * @returns {boolean}
	 */
	get bargraph() {
		return this.getAttribute('bargraph') === '1';
	}

	/**
	 * Enable/disable bargraph rendering
	 *
	 * @param {boolean} value
	 */
	set bargraph(value) {
		this.setAttribute('bargraph', value ? '1' : '0');
	}

	/**
	 * Set the value of the CPU usage percentage.
	 * This will automatically clamp the value between 0 and 100, and update the display.
	 *
	 * @param {string|number|null} percentage
	 */
	set value(percentage) {
		percentage = parseFloat(percentage);
		if (isNaN(percentage)) {
			percentage = 0;
		}
		percentage = Math.max(0, Math.min(100, percentage));

		// Use numberTick for updating the value if it's available.
		if (typeof numberTick === 'function') {
			numberTick(
				this.valueNode,
				percentage,
			v => v.toFixed(1) + '%'
			);
		}
		else {
			this.valueNode.innerHTML = percentage.toFixed(1) + '%';
		}

		// Use progressBarTick to update the bargraph if it's available
		if (this.fillNode) {
			if (typeof progressBarTick === 'function') {
				progressBarTick(this.fillNode, percentage);
			}
			else {
				this.fillNode.style.width = percentage + '%';
			}
		}
	}
}

customElements.define('host-cpu-metric', HostCPUMetricElement);
