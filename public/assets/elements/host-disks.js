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

		this.valueNode = null;
		this.graphNode = null;
		this.fillNode = null;
		this.percentageNode = null;
		this._attached = false;

		/**
		 * Handler for live host data updates.
		 *
		 * @param {CustomEvent} e
		 */
		this.hostChangeListener = e => {
			if (e.detail.host === this.host && e.detail.hasOwnProperty('disks_free')) {
				this.value = {
					free: e.detail.disks_free,
					used: e.detail.disks_used,
					total: e.detail.disks_total || (e.detail.disks_free + e.detail.disks_used)
				};
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
			percentageNode = this.percentageNode || document.createElement('span'),
			graphNode = this.graphNode || document.createElement('div'),
			fillNode = this.fillNode || document.createElement('div');

		valueNode.className = 'value';
		if (!this.valueNode) {
			this.appendChild(valueNode);
			this.valueNode = valueNode;
		}

		percentageNode.className = 'percentage';
		if (!this.percentageNode) {
			this.appendChild(percentageNode);
			this.percentageNode = percentageNode;
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
			// Initial hostData may or may not contain metrics data, that's fine.
			if (hostData.hasOwnProperty('metrics')) {
				this.value = {
					free: hostData.metrics.disks_free,
					used: hostData.metrics.disks_used,
					total: hostData.metrics.disks_total || 0
				};
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

customElements.define('host-disks-metric', HostDisksMetricElement);
