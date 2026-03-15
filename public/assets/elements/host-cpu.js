/**
 * Render a dynamic CPU entry for a given host
 *
 * @license AGPLv3
 * @author Charlie Powell <cdp1337@bitsnbytes.dev>
 */
class HostCPUElement extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();

		this.valueNode = document.createElement('span');
		this.graphNode = null;
		this.rawValue = null;
		this.host = null;
	}

	/**
	 * Called when the element is added to the DOM.
	 */
	connectedCallback() {
		this.render();

		// Attach the event listener for this node to retrieve live metrics.
		document.addEventListener('hostChange', e => {
			if (e.detail.host === this.host && e.detail.hasOwnProperty('cpu_usage')) {
				this.value = e.detail.cpu_usage;
			}
		});
	}

	render() {
		const model = parseInt(this.getAttribute('model') || 0) === 1,
			bargraph = parseInt(this.getAttribute('bargraph') || 0) === 1,
			details = document.createElement('div'),
			bar = document.createElement('div'),
			fill = document.createElement('div');

		this.host = this.getAttribute('host');

		// This module requires both an author and the authors component to be loaded.
		if (!this.host) {
			this.innerHTML = 'ERROR: No host specified';
			return;
		}

		this.valueNode.className = 'value';
		this.appendChild(this.valueNode);

		if (model) {
			details.className = 'cpu-details';

			this.appendChild(details);
		}

		if (bargraph) {
			bar.className = 'bargraph-h';
			fill.className = 'fill';

			this.graphNode = fill;
			bar.appendChild(fill);
			this.appendChild(bar);
		}

		// Initial data lookup
		getHost(this.host).then(hostData => {
			if (model) {
				details.innerHTML = hostData.cpu.model || 'Unknown CPU';
			}

			// Initial hostData may or may not contain metrics data, that's fine.
			if (hostData.hasOwnProperty('metrics')) {
				this.value = hostData.metrics.cpu_usage;
			}
		});
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
		this.rawValue = Math.max(0, Math.min(100, percentage));

		// Use numberTick for updating the value if it's available.
		if (typeof numberTick === 'function') {
			numberTick(
				this.valueNode,
				this.rawValue,
			v => v.toFixed(1) + '%'
			);
		}
		else {
			this.valueNode.innerHTML = this.rawValue.toFixed(1) + '%';
		}

		// Use progressBarTick to update the bargraph if it's available
		if (this.graphNode) {
			if (typeof progressBarTick === 'function') {
				progressBarTick(this.graphNode, this.rawValue);
			}
			else {
				this.graphNode.style.width = this.rawValue + '%';
			}
		}
	}

	/**
	 * Get the current raw value of the CPU usage percentage.
	 *
	 * @returns {float}
	 */
	get value() {
		return this.rawValue || 0.0;
	}
}

customElements.define('host-cpu', HostCPUElement);