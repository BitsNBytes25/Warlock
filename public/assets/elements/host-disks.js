/**
 * Render a dynamic aggregated Disk usage entry for a given host
 *
 * @license AGPLv3
 * @author Charlie Powell <cdp1337@bitsnbytes.dev>
 */
class HostDisksMetricElement extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();

		this.valueNode = document.createElement('span');
		this.percentageNode = document.createElement('span');
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
			if (e.detail.host === this.host && e.detail.hasOwnProperty('disks_free')) {
				this.value = {
					free: e.detail.disks_free,
					used: e.detail.disks_used,
					total: e.detail.disks_total || (e.detail.disks_free + e.detail.disks_used)
				};
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
				this.value = {
					free: hostData.metrics.disks_free,
					used: hostData.metrics.disks_used,
					total: hostData.metrics.disks_total || 0
				};
			}
		});
	}

	/**
	 * Set the value of disk usage.
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

		// Use numberTick for updating the value if it's available.
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

customElements.define('host-disks-metric', HostDisksMetricElement);

