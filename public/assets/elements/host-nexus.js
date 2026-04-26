/**
 * Render a dynamic CPU entry for a given host
 *
 * @license AGPLv3
 * @author Charlie Powell <cdp1337@bitsnbytes.dev>
 */
class HostNexusStatusElement extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();
		this._attached = false;
	}

	/**
	 * Called when the element is added to the DOM.
	 */
	connectedCallback() {
		this._attached = true;
		this.render();
	}

	/**
	 * Called when the element is removed from the DOM.
	 */
	disconnectedCallback() {
		this._attached = false;
	}

	/**
	 * Called when an observed attribute changes.
	 */
	static get observedAttributes() {
		return ['token', 'email'];
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
		// General attribute change, we don't really care which one.
		this.render();
	}

	async nexusHostPing(host) {
		const email = await sha256(this.getAttribute('email'));

		const headers = {
			'X-Host-Token': this.getAttribute('token'),
			'X-Email': email
		};
		return fetch(
			'https://api.warlock.nexus/host/ping', {headers}
		).then(
			r => r.json()
		).catch(
			e => {return {success: false, message: e.message}; }
		);
	}

	error(message, link) {
		this.innerHTML = '<i class="fa fa-times bad"></i> ';

		const span = document.createElement('span');
		span.innerText = message;
		this.appendChild(span);

		const helpLink = document.createElement('a');
		const helpIcon = document.createElement('i');

		helpLink.className = 'help-link';
		helpLink.href = link;
		helpLink.target = '_blank';
		helpLink.ref = 'noopener noreferrer';
		helpLink.title = 'Click to learn more';

		helpIcon.className = 'fa fa-question-circle';

		helpLink.appendChild(helpIcon);
		this.appendChild(helpLink);
	}

	/**
	 * Render this element.
	 *
	 * This will create the necessary DOM elements and attach event listeners.
	 * It will also perform initial data lookup and initial rendering.
	 */
	render() {
		// Skip rendering if we're not ready yet.
		if (!(this._attached)) {
			return;
		}

		const email = this.getAttribute('email'),
			token = this.getAttribute('token');

		this.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';

		if (!token) {
			this.error('Host not configured for Warlock.Nexus', 'https://warlock.nexus/docs/host-setup');
			return;
		}

		if (!email) {
			this.error('Host not configured for Warlock.Nexus', 'https://warlock.nexus/docs/host-setup');
			return;
		}

		this.nexusHostPing().then(response => {
			if (response.success) {
				this.innerHTML = '<i class="fa fa-heart good"></i> <span>Host connected to Warlock.Nexus</span>';
			} else {
				this.error(response.message, 'https://warlock.nexus/docs/troubleshooting');
			}
		});
	}

	get token() {
		return this.getAttribute('token');
	}

	set token(value) {
		this.setAttribute('token', value);
	}

	get email() {
		return this.getAttribute('email');
	}
	set email(value) {
		this.setAttribute('email', value);
	}
}

customElements.define('host-nexus-status', HostNexusStatusElement);
