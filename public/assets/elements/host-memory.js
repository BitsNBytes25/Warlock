/**
 * Render a dynamic Memory entry for a given host
 *
 * @license AGPLv3
 * @author Charlie Powell <cdp1337@bitsnbytes.dev>
 */
class HostMemoryMetricElement extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();

		this.valueNode = null;
		this.graphNode = null;
		this.fillNode = null;
		this.detailsNode = null;
		this._attached = false;
		this.totalMemory = null;

		/**
		 * Handler for live host data updates.
		 *
		 * @param {CustomEvent} e
		 */
		this.hostChangeListener = e => {
			// Attach the event listener for this node to retrieve live metrics.
			if (e.detail.host === this.host && e.detail.hasOwnProperty('memory_used')) {
				this.value = e.detail.memory_used;
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
		return ['host', 'bargraph'];
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

		const valueNode = this.valueNode || document.createElement('span'),
			graphNode = this.graphNode || document.createElement('div'),
			fillNode = this.fillNode || document.createElement('div');

		valueNode.className = 'value';
		if (!this.valueNode) {
			this.appendChild(valueNode);
			this.valueNode = valueNode;
		}

		if (this.bargraph) {
			// Bar graph selected, ensure it's rendered
			graphNode.className = 'bargraph-h';
			fillNode.className = 'fill';

			if (!this.graphNode) {
				graphNode.appendChild(fillNode);
				this.appendChild(graphNode);
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
			this.totalMemory = hostData.memory;

			// Initial hostData may or may not contain metrics data, that's fine.
			if (hostData.hasOwnProperty('metrics')) {
				this.value = hostData.metrics.memory_used;
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
	 * Set the value of memory used in bytes.
	 * This will automatically update the display with the formatted used/total memory.
	 *
	 * @param {string|number|null} bytes
	 */
	set value(bytes) {
		bytes = parseFloat(bytes);
		if (isNaN(bytes)) {
			bytes = 0;
		}
		bytes = Math.max(0, bytes);

		// Calculate percentage for bar graph
		const totalBytes = this.totalMemory || 1;
		const percentage = Math.max(0, Math.min(100, (bytes / totalBytes) * 100));

		// Use numberTick for updating the value if it's available.
		if (typeof numberTick === 'function') {
			numberTick(
				this.valueNode,
				bytes,
				v => formatFileSize(v, 0) + ' / ' + formatFileSize(totalBytes, 0)
			);
		}
		else {
			this.valueNode.innerHTML = formatFileSize(bytes, 0) + ' / ' + formatFileSize(totalBytes, 0);
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

customElements.define('host-memory-metric', HostMemoryMetricElement);

