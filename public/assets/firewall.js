const {host} = getPathParams('/host/firewall/:host'),
	tableBody = document.getElementById('firewallTableBody'),
	addBtn = document.getElementById('btnAddRule'),
	addModal = document.getElementById('addRuleModal'),
	deleteModal = document.getElementById('deleteRuleModal'),
	btnPauseFirewall = document.getElementById('btnPauseFirewall'),
	btnEnableFirewall = document.getElementById('btnEnableFirewall'),
	portsTableBody = document.getElementById('portsTableBody'),
	globalRules = [];

function sanitizeForPreview(text){
	return (text || '').replace(/[<>\n\r]/g, '');
}

function renderRules(rules){
	tableBody.innerHTML = '';
	if (!rules || rules.length === 0){
		tableBody.innerHTML = '<tr><td colspan="6">No rules configured</td></tr>';
		return;
	}

	rules.forEach(rule => {
		const tr = document.createElement('tr'),
			tdTo = document.createElement('td'),
			tdFrom = document.createElement('td'),
			tdProto = document.createElement('td'),
			tdAction = document.createElement('td'),
			tdComment = document.createElement('td'),
			tdActions = document.createElement('td'),
			delBtn = document.createElement('button');

		if (rule.from === 'any') {
			// Register global rule for later use
			globalRules.push(rule);
		}

		tdTo.textContent = rule.to;
		tdFrom.textContent = rule.from || 'any';
		tdProto.textContent = (rule.proto || 'any').toUpperCase();
		tdAction.textContent = (rule.action || '').toUpperCase();
		tdAction.className = 'status-' + (rule.action || 'unknown').toLowerCase();
		tdComment.textContent = rule.comment || '';
		delBtn.className = 'action-remove';
		delBtn.textContent = 'Delete';
		delBtn.addEventListener('click', () => {
			// populate delete modal
			const spec = {
				action: rule.action,
				proto: rule.proto || undefined,
				from: rule.from || undefined,
				to: rule.to || undefined
			};
			// Show a sanitized preview
			document.getElementById('deleteRulePreview').textContent =
				`To: ${sanitizeForPreview(spec.port || spec.to || 'any')}\nFrom: ${sanitizeForPreview(spec.from || 'any')}\nAction: ${sanitizeForPreview(spec.action)}`;
			document.getElementById('delRuleSpec').value = JSON.stringify(spec);
			deleteModal.classList.add('show');
		});
		tdActions.appendChild(delBtn);

		tr.appendChild(tdTo);
		tr.appendChild(tdFrom);
		tr.appendChild(tdProto);
		tr.appendChild(tdAction);
		tr.appendChild(tdComment);
		tr.appendChild(tdActions);
		tableBody.appendChild(tr);
	});
}

async function fetchRules(){
	tableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
	fetch(`/api/firewall/${host}`, { method: 'GET' })
		.then(response => response.json())
		.then(resp => {
			const statusActive = document.getElementById('firewallStatusActive'),
				statusInactive = document.getElementById('firewallStatusInactive'),
				statusNotInstalled = document.getElementById('firewallStatusNotInstalled');

			if (!resp || !resp.success){
				showToast('error', resp && resp.error ? resp.error : 'Failed to fetch rules');
				tableBody.innerHTML = '<tr><td colspan="6">Error loading rules</td></tr>';
				return;
			}

			// Update status indicators
			if (resp.status === 'active') {
				statusActive.style.display = 'flex';
				statusInactive.style.display = 'none';
				statusNotInstalled.style.display = 'none';
				btnEnableFirewall.style.display = 'none';
				btnPauseFirewall.style.display = 'inline-block';
			}
			else if (resp.status === 'inactive') {
				statusActive.style.display = 'none';
				statusInactive.style.display = 'flex';
				statusNotInstalled.style.display = 'none';
				btnEnableFirewall.style.display = 'inline-block';
				btnPauseFirewall.style.display = 'none';
			}
			else {
				statusActive.style.display = 'none';
				statusInactive.style.display = 'none';
				statusNotInstalled.style.display = 'flex';
				btnEnableFirewall.style.display = 'none';
				btnPauseFirewall.style.display = 'none';
			}

			renderRules(resp.rules || []);
		}).catch(e => {
			console.error(e);
			showToast('error', 'Error fetching rules');
			tableBody.innerHTML = '<tr><td colspan="6">Error loading rules</td></tr>';
		});
}

function checkInGlobalRules(port, protocol) {
	for (let i = 0; i < globalRules.length; i++) {
		const rule = globalRules[i],
			ruleProto = (rule.proto || 'any').toLowerCase();

		// If the protocol doesn't match, skip this rule
		if (ruleProto !== 'any' && ruleProto !== protocol.toLowerCase()) {
			continue;
		}

		// Check if the port falls within a range
		if (rule.to.includes(':')) {
			const [start, end] = rule.to.split(':').map(Number);
			if (start <= Number(port) && Number(port) <= end) {
				return true;
			}
		}
		else if (Number(rule.to) === Number(port)) {
			return true;
		}
	}

	return false;
}

function addRule(action, to, from, proto, comment) {
	// simple client validation
	const allowedActions = ['ALLOW','DENY','REJECT'];
	if (!allowedActions.includes(action)) return showToast('error','Invalid action');
	if (proto && !['tcp','udp'].includes(proto)) return showToast('error','Invalid proto');
	if (comment && !/^[a-zA-Z0-9 _.\-()]+$/.test(comment)) return showToast('error','Invalid comment characters');

	const payload = { action };
	if (proto) payload.proto = proto;
	if (from) payload.from = from;
	if (to) payload.to = to;
	if (comment) payload.comment = comment;

	fetch(`/api/firewall/${host}`, {
		method: 'POST',
		headers: {'Content-Type':'application/json'},
		body: JSON.stringify(payload)
	})
		.then(response => response.json())
		.then(resp => {
			showToast('info', resp.stdout);
			addModal.classList.remove('show');
			fetchRules();
			fetchPorts();
		}).catch(() => {
		showToast('error', 'Failed to add rule');
	});
}

function updateConfig(app_guid, service, option, newValue) {
	fetch(`/api/service/configs/${app_guid}/${host}/${service}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ [option]: newValue })
	})
		.then(response => response.json())
		.then(result => {
			if (result.success) {
				fetchRules();
				fetchPorts();
				showToast('success', `Configuration option ${option} updated successfully.`);
			} else {
				showToast('error', `Failed to update configuration option ${option}: ${result.error}`);
			}
		});
}

async function fetchPorts() {
	portsTableBody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
	fetchApplications().then(apps => {
		fetch(`/api/ports/${host}`, { method: 'GET' })
			.then(response => response.json())
			.then(resp => {
				portsTableBody.innerHTML = '';

				// resp is an array of Objects with config, description, guid, port, protocol, and service.
				// sort them by the port number
				resp.ports.sort((a,b) => a.port - b.port);
				resp.ports.forEach((port) => {
					const row = document.createElement('tr'),
						tdGame = document.createElement('td'),
						tdPort = document.createElement('td'),
						tdProto = document.createElement('td'),
						tdService = document.createElement('td'),
						tdDescription = document.createElement('td'),
						tdAction = document.createElement('td');

					console.log(port, checkInGlobalRules(port.port, port.protocol));

					tdGame.className = 'icon';
					tdGame.innerHTML = renderAppIcon(port.guid);
					tdProto.textContent = port.protocol.toUpperCase();
					tdService.textContent = port.service || '';
					tdDescription.textContent = port.description || '';

					let input;
					if (port.config) {
						// Ports with configuration parameters can be changed!
						input = `<input type="number" value="${port.port}" min="1" max="65535" data-guid="${port.guid}" data-config="${port.config}" data-service="${port.service}" class="port-input"/>`;
					}
					else {
						input = `<input type="number" value="${port.port}" readonly=readonly class="port-input"/>`;
					}
					tdPort.innerHTML = '<div class="form-group">' + input + '</div>';

					if (checkInGlobalRules(port.port, port.protocol)) {
						tdAction.innerHTML = '<span class="status-allowed"><i class="fas fa-check"></i> Allowed Globally</span>';
					}
					else {
						tdAction.innerHTML = `<button class="add-port-rule" data-port="${port.port}" data-protocol="${port.protocol}" data-comment="${port.description}"><i class="fas fa-plus"></i> Add to Allow Rules</button>`;
					}

					row.appendChild(tdGame);
					row.appendChild(tdPort);
					row.appendChild(tdProto);
					row.appendChild(tdService);
					row.appendChild(tdDescription);
					row.appendChild(tdAction);
					portsTableBody.appendChild(row);
				});

				portsTableBody.querySelectorAll('.add-port-rule').forEach(el => {
					el.addEventListener('click', (e) => {
						let btn = e.target;
						addRule('ALLOW', btn.dataset.port, 'any', btn.dataset.protocol, btn.dataset.comment);
					});
				});

				portsTableBody.querySelectorAll('input').forEach(el => {
					el.addEventListener('change', (e) => {
						let input = e.target,
							newPort = parseInt(input.value, 10),
							guid = input.dataset.guid,
							config = input.dataset.config,
							service = input.dataset.service;

						if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
							showToast('error', 'Invalid port number');
							return;
						}

						updateConfig(guid, service, config, newPort);
					});
				});
			});
	});
}

(function(){
	loadHost(host);

    // Add rule wiring
    addBtn.addEventListener('click', () => {
		addModal.classList.add('show');
	});
    document.getElementById('saveRuleBtn').addEventListener('click', () => {
        const action = document.getElementById('ruleAction').value;
        const proto = document.getElementById('ruleProto').value || undefined;
        const from = document.getElementById('ruleFrom').value.trim() || undefined;
        const to = document.getElementById('ruleTo').value.trim() || undefined;
        const comment = document.getElementById('ruleComment').value.trim() || undefined;

		addRule(action, to, from, proto, comment);
    });

    // Delete confirm
    document.getElementById('confirmDeleteRuleBtn').addEventListener('click', () => {
        const specRaw = document.getElementById('delRuleSpec').value;
        if (!specRaw) return showToast('error','No rule specified');
        let spec = null;
        try { spec = JSON.parse(specRaw); } catch(e){ return showToast('error','Invalid rule spec'); }

        fetch(`/api/firewall/${host}`, {
			method: 'DELETE',
			headers: {'Content-Type':'application/json'},
			body: JSON.stringify(spec)
		})
			.then(resp => resp.json())
			.then(resp => {
				showToast('info', resp.stdout);
				fetchRules();
				deleteModal.classList.remove('show');
			}).catch(() => {
				showToast('error','Failed to delete rule');
			});
    });

	btnPauseFirewall.addEventListener('click', () => {
		fetch(`/api/firewall/disable/${host}`, { method: 'POST' }).then(() => {
			fetchRules();
		});
	});

	btnEnableFirewall.addEventListener('click', () => {
		fetch(`/api/firewall/enable/${host}`, { method: 'POST' }).then(() => {
			fetchRules();
		});
	});

    // initial load
    fetchRules();
	fetchPorts();
})();
