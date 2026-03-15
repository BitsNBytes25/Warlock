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

		this.usedNode = document.createElement('span');
		this.graphNode = null;
		this.rawValue = null;
		this.host = null;
		this.totalMemory = null;
	}

	/**
	 * Called when the element is added to the DOM.
	 */
	connectedCallback() {
		this.render();

		// Attach the event listener for this node to retrieve live metrics.
		document.addEventListener('hostChange', e => {
			if (e.detail.host === this.host && e.detail.hasOwnProperty('memory_used')) {
				this.value = e.detail.memory_used;
			}
		});
	}

	render() {
		const bargraph = parseInt(this.getAttribute('bargraph') || 0) === 1,
			bar = document.createElement('div'),
			fill = document.createElement('div');

		this.host = this.getAttribute('host');

		// This module requires a host to be specified.
		if (!this.host) {
			this.innerHTML = 'ERROR: No host specified';
			return;
		}

		this.usedNode.className = 'value';
		this.appendChild(this.usedNode);

		if (bargraph) {
			bar.className = 'bargraph-h';
			fill.className = 'fill';

			this.graphNode = fill;
			bar.appendChild(fill);
			this.appendChild(bar);
		}

		// Initial data lookup
		getHost(this.host).then(hostData => {
			this.totalMemory = hostData.memory;

			// Initial hostData may or may not contain metrics data, that's fine.
			if (hostData.hasOwnProperty('metrics')) {
				this.value = hostData.metrics.memory_used;
			}
		});
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
		this.rawValue = Math.max(0, bytes);

		// Calculate percentage for bar graph
		const totalBytes = this.totalMemory || 1;
		const percentage = Math.max(0, Math.min(100, (this.rawValue / totalBytes) * 100));

		// Use numberTick for updating the value if it's available.
		if (typeof numberTick === 'function') {
			numberTick(
				this.usedNode,
				this.rawValue,
				v => formatFileSize(v, 0) + ' / ' + formatFileSize(totalBytes, 0)
			);
		}
		else {
			this.usedNode.innerHTML = formatFileSize(this.rawValue, 0) + ' / ' + formatFileSize(totalBytes, 0);
		}

		// Use progressBarTick to update the bargraph if it's available
		if (this.graphNode) {
			if (typeof progressBarTick === 'function') {
				progressBarTick(this.graphNode, percentage);
			}
			else {
				this.graphNode.style.width = percentage + '%';
			}
		}
	}

	/**
	 * Get the current raw value of memory used in bytes.
	 *
	 * @returns {float}
	 */
	get value() {
		return this.rawValue || 0.0;
	}
}

customElements.define('host-memory-metric', HostMemoryMetricElement);

