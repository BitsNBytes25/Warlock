/**
 * Render a dynamic per-disk usage entry for a given host and disk device
 *
 * @license AGPLv3
 * @author Charlie Powell <cdp1337@bitsnbytes.dev>
 */
class HostDiskMetricElement extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();

		this.valueNode = document.createElement('span');
		this.percentageNode = document.createElement('span');
		this.graphNode = null;
		this.rawValue = null;
		this.host = null;
		this.dev = null;
	}

	/**
	 * Called when the element is added to the DOM.
	 */
	connectedCallback() {
		this.render();

		// Attach the event listener for this node to retrieve live metrics.
		document.addEventListener('hostChange', e => {
			if (e.detail.host === this.host && this.dev) {
				const freeKey = `disk_${this.dev}_free`;
				const usedKey = `disk_${this.dev}_used`;
				const totalKey = `disk_${this.dev}_total`;

				if (e.detail.hasOwnProperty(freeKey)) {
					this.value = {
						free: e.detail[freeKey],
						used: e.detail[usedKey],
						total: e.detail[totalKey]
					};
				}
			}
		});
	}

	render() {
		const bargraph = parseInt(this.getAttribute('bargraph') || 0) === 1,
			bar = document.createElement('div'),
			fill = document.createElement('div');

		this.host = this.getAttribute('host');
		this.dev = this.getAttribute('dev');

		// This module requires both a host and a device to be specified.
		if (!this.host) {
			this.innerHTML = 'ERROR: No host specified';
			return;
		}

		if (!this.dev) {
			this.innerHTML = 'ERROR: No disk device specified';
			return;
		}

		this.valueNode.className = 'value';
		this.appendChild(this.valueNode);

		this.percentageNode.className = 'percentage';
		this.appendChild(this.percentageNode);

		if (bargraph) {
			bar.className = 'bargraph-h';
			fill.className = 'fill';

			this.graphNode = fill;
			bar.appendChild(fill);
			this.appendChild(bar);
		}

		// Initial data lookup
		getHost(this.host).then(hostData => {
			// Initial hostData may or may not contain metrics data, that's fine.
			if (hostData.hasOwnProperty('metrics')) {
				const freeKey = `disk_${this.dev}_free`;
				const usedKey = `disk_${this.dev}_used`;
				const totalKey = `disk_${this.dev}_total`;

				if (hostData.metrics.hasOwnProperty(freeKey)) {
					this.value = {
						free: hostData.metrics[freeKey],
						used: hostData.metrics[usedKey],
						total: hostData.metrics[totalKey]
					};
				}
			}
		});
	}

	/**
	 * Set the value of disk usage for this specific disk.
	 * Expects an object with { free, used, total } properties in bytes.
	 *
	 * @param {Object} diskData
	 * @param {number} diskData.free
	 * @param {number} diskData.used
	 * @param {number} diskData.total
	 */
	set value(diskData) {
		if (!diskData || typeof diskData !== 'object') {
			diskData = { free: 0, used: 0, total: 0 };
		}

		const free = parseFloat(diskData.free) || 0,
			used = parseFloat(diskData.used) || 0,
			total = parseFloat(diskData.total) || 1;

		this.rawValue = free;

		const percentage = Math.max(0, Math.min(100, (used / total) * 100));

		// Use numberTick for updating the free space value if it's available.
		if (typeof numberTick === 'function') {
			numberTick(
				this.valueNode,
				free,
				v => formatFileSize(v, 1) + ' free'
			);
			numberTick(
				this.percentageNode,
				percentage,
				p => '(' + p.toFixed(0) + '% used)'
			);
		}
		else {
			this.valueNode.innerHTML = formatFileSize(free, 1) + ' free';
			this.percentageNode.innerHTML = '(' + percentage.toFixed(0) + '% used)';
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
	 * Get the current raw value of disk free space in bytes.
	 *
	 * @returns {float}
	 */
	get value() {
		return this.rawValue || 0.0;
	}
}

customElements.define('host-disk-metric', HostDiskMetricElement);

