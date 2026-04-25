const usersTableBody = document.getElementById('usersTableBody');
const btnCreateUser = document.getElementById('btnCreateUser');
const userModal = document.getElementById('userModal');
const changePasswordModal = document.getElementById('changePasswordModal');
const userDeleteModal = document.getElementById('userDeleteModal');
const user2faModal = document.getElementById('user2faModal');
const confirmUserReset2faBtn = document.getElementById('confirmUserReset2faBtn');
const settingsNexusAuthSettings = document.getElementById('settingsNexusAuthSettings');
const settingsNexusAuthSettingsToggle = document.getElementById('settingsNexusAuthSettingsToggle');
const settingsNexusEmail = document.getElementById('settingsNexusEmail');
const settingsNexusAuthToken = document.getElementById('settingsNexusAuthToken');
const nexusPreDonateMessage = document.getElementById('nexusPreDonateMessage');
const settingsNexusRegister = document.getElementById('settingsNexusRegister');
const settingsNexusCommunityProfile = document.getElementById('settingsNexusCommunityProfile');
const warlockLatestVersion = document.getElementById('warlock-latest-version');

function closeModal(el) { if (!el) return; el.classList.remove('show'); }
function openModal(el) { if (!el) return; el.classList.add('show'); }

async function loadUsers() {
	usersTableBody.innerHTML = '<tr><td colspan="3"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
	try {
		const res = await fetch('/api/users');
		const data = await res.json();
		if (!data.success) throw new Error(data.error || 'Failed to load users');
		const users = data.data || [];
		if (users.length === 0) {
			usersTableBody.innerHTML = '<tr><td colspan="4">No users configured.</td></tr>';
			return;
		}
		usersTableBody.innerHTML = '';
		users.forEach(u => {
			const tr = document.createElement('tr');
			tr.innerHTML = `<td>${u.username}</td>
<td>${twofactor ? (u.secret_2fa ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>') : 'N/A'}</td>
<td>${new Date(u.createdAt).toLocaleString()}</td>
<td>
	<div class="button-group">
		<button class="action-edit" data-id="${u.id}">Edit</button>
		<button class="action-password" data-id="${u.id}">Password</button>
		${twofactor && u.secret_2fa ? '<button class="action-2fa" data-id="' + u.id + '" data-secret="' + u.secret_2fa + '">2FA</button>' : ''}
		<button class="action-remove" data-id="${u.id}">Delete</button>
	</div>
</td>`;
			usersTableBody.appendChild(tr);
		});
		// attach handlers
		document.querySelectorAll('.action-edit').forEach(btn => btn.addEventListener('click', onEditUser));
		document.querySelectorAll('.action-password').forEach(btn => btn.addEventListener('click', onChangePassword));
		document.querySelectorAll('.action-remove').forEach(btn => btn.addEventListener('click', onDeleteUser));
		document.querySelectorAll('.action-2fa').forEach(btn => btn.addEventListener('click', on2faUser));
	} catch (e) {
		usersTableBody.innerHTML = `<tr><td colspan="3">Error: ${e.message}</td></tr>`;
		showToast('error', `Failed to load users: ${e.message}`);
	}
}

function onEditUser(e) {
	const id = e.currentTarget.dataset.id;
	const row = e.currentTarget.closest('tr');
	const username = row.children[0].innerText;
	document.getElementById('userModalTitle').innerText = 'Edit User';
	document.getElementById('inputUsername').value = username;
	document.getElementById('inputUserId').value = id;
	document.getElementById('passwordRow').style.display = 'none';
	openModal(userModal);
}

function onChangePassword(e) {
	const id = e.currentTarget.dataset.id;
	document.getElementById('pwdUserId').value = id;
	document.getElementById('newPassword').value = '';
	openModal(changePasswordModal);
}

function onDeleteUser(e) {
	const id = e.currentTarget.dataset.id;
	document.getElementById('delUserId').value = id;
	openModal(userDeleteModal);
}

function on2faUser(e) {
	const id = e.currentTarget.dataset.id,
		secret = e.currentTarget.dataset.secret,
		confirmResetBtn = document.getElementById('confirmUserReset2faBtn'),
		ownInfo = document.getElementById('own-user-2fa'),
		otherInfo = document.getElementById('other-user-2fa'),
		qrcode = document.getElementById("qrcode");

	confirmResetBtn.dataset.userid = id;
	if (secret === 'true') {
		ownInfo.style.display = 'none';
		otherInfo.style.display = 'block';
	}
	else {
		ownInfo.style.display = 'block';
		otherInfo.style.display = 'none';

		if (qrcode.querySelector('img') === null) {
			document.getElementById('own-2fa-secret').innerText = secret;
			new QRCode(
				qrcode,
				`otpauth://totp/Warlock:${window.location.hostname }?secret=${secret}&issuer=Warlock`
			);
		}
	}
	openModal(user2faModal);
}

function loadNexusProfile() {
	// settingsNexusCommunityProfile
	let email = localStorage.getItem('nexusAuthEmail');
	if (!email) {
		return;
	}

	sha256(email).then(hash => {
		const headers = {
			'X-Email': hash,
		};

		// Verify the authentication token first.
		fetch('https://api.warlock.nexus/community/full', {headers})
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					settingsNexusCommunityProfile.style.display = 'block';
					const profileData = data.data;

					// 1. Map simple text/textarea fields
					// We use a mapping object to link the incoming keys to our HTML element IDs
					const fieldMap = {
						"name": "profileName",
						"tagline": "profileTagline",
						"description": "profileDescription",
						"color": "profileColor",
						"country": "profileCountry"
					};

					// Iterate through the map and update values if the key exists in data
					for (const [dataKey, elementId] of Object.entries(fieldMap)) {
						const element = document.getElementById(elementId);
						if (element && profileData[dataKey] !== undefined) {
							element.value = profileData[dataKey];
						}
					}

					// 2. Handle the 'socials' array
					// We need to convert the array ["url1", "url2"] into a single string with newlines
					const socialsElement = document.getElementById('profileSocials');
					if (socialsElement && Array.isArray(profileData.socials)) {
						socialsElement.value = profileData.socials.join('\n');
					}

					// 3. Handle the 'enabled' boolean (checkbox)
					// For checkboxes, we modify the '.checked' property instead of '.value'
					const enabledCheckbox = document.getElementById('profileEnabled');
					if (enabledCheckbox && typeof profileData.enabled === 'boolean') {
						enabledCheckbox.checked = profileData.enabled;
					}
				}
				else {
					settingsNexusAuthSettings.classList.add('active');
					const message = document.createElement('p');
					message.classList.add('error-message');
					message.innerText = data.message;
					messageNexusRegisterResponse.innerHTML = '';
					messageNexusRegisterResponse.appendChild(message);
				}
			});
	});
}

/**
 * Collects form data and sends it to the server via POST.
 */
async function saveCommunityProfile() {
	const saveButton = document.getElementById('btnSaveCommunityProfile');

	// 1. Prepare the payload object
	// We use the same keys as your incoming data for consistency
	const payload = {
		name: document.getElementById('profileName').value,
		tagline: document.getElementById('profileTagline').value,
		description: document.getElementById('profileDescription').value,
		color: document.getElementById('profileColor').value,
		country: document.getElementById('profileCountry').value,
		enabled: document.getElementById('profileEnabled').checked
	};

	// 2. Handle the 'socials' transformation
	// Convert the newline-separated string back into a clean array of strings
	const socialsText = document.getElementById('profileSocials').value;
	payload.socials = socialsText
		.split('\n')
		.map(line => line.trim())
		.filter(line => line !== ""); // Remove empty lines

	// 3. UI Feedback: Disable button to prevent double-submission
	saveButton.disabled = true;
	const originalText = saveButton.innerText;
	saveButton.innerText = "Saving...";

	try {
		const email = await sha256(localStorage.getItem('nexusAuthEmail'));

		const headers = {
			'X-Email': email,
			'X-Auth-Token': localStorage.getItem('nexusAuthToken') || '',
			'Content-Type': 'application/json'
		};

		// 4. Perform the POST request
		const response = await fetch('https://api.warlock.nexus/community/details', { // Replace with your actual endpoint
			method: 'POST',
			headers,
			body: JSON.stringify(payload)
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.message || 'Failed to save profile');
		}

		// Success!
		showToast('success', 'Profile saved successfully!');
		console.log("Saved payload:", payload);

	} catch (error) {
		console.error("Error saving profile:", error);
		showToast('error', error.message, false, 'Failed to save profile!');
	} finally {
		// 5. Restore button state
		saveButton.disabled = false;
		saveButton.innerText = originalText;
	}
}

// Create user button
if (btnCreateUser) {
	btnCreateUser.addEventListener('click', () => {
		document.getElementById('userModalTitle').innerText = 'Create User';
		document.getElementById('inputUsername').value = '';
		document.getElementById('inputPassword').value = '';
		document.getElementById('inputUserId').value = '';
		document.getElementById('passwordRow').style.display = '';
		openModal(userModal);
	});
}

// Modal close buttons
document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', (ev) => {
	const modal = ev.currentTarget.closest('.modal');
	closeModal(modal);
}));

// Save user (create or edit)
document.getElementById('saveUserBtn').addEventListener('click', async () => {
	const id = document.getElementById('inputUserId').value;
	const username = document.getElementById('inputUsername').value.trim();
	const password = document.getElementById('inputPassword').value;
	if (!username) { showToast('error', 'Username is required'); return; }
	if (!id && (!password || password.length < 8)) { showToast('error', 'Password is required and must be at least 8 chars'); return; }
	try {
		let res;
		if (id) {
			res = await fetch(`/api/users/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username }) });
		} else {
			res = await fetch('/api/users', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
		}
		const data = await res.json();
		if (!data.success) throw new Error(data.error || 'Request failed');
		showToast('success', 'Saved');
		closeModal(userModal);
		await loadUsers();
	} catch (e) {
		showToast('error', `Failed to save user: ${e.message}`);
	}
});

// Save password
document.getElementById('savePasswordBtn').addEventListener('click', async () => {
	const id = document.getElementById('pwdUserId').value;
	const pwd = document.getElementById('newPassword').value;
	if (!pwd || pwd.length < 8) { showToast('error', 'Password must be at least 8 chars'); return; }
	try {
		const res = await fetch(`/api/users/${id}/password`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pwd }) });
		const data = await res.json();
		if (!data.success) throw new Error(data.error || 'Failed');
		showToast('success', 'Password updated');
		closeModal(changePasswordModal);
	} catch (e) {
		showToast('error', `Failed to set password: ${e.message}`);
	}
});

// Confirm delete
document.getElementById('confirmDeleteUserBtn').addEventListener('click', async () => {
	const id = document.getElementById('delUserId').value;
	try {
		const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
		const data = await res.json();
		if (!data.success) throw new Error(data.error || 'Failed to delete');
		showToast('success', 'User deleted');
		closeModal(userDeleteModal);
		await loadUsers();
	} catch (e) {
		showToast('error', `Failed to delete user: ${e.message}`);
	}
});

confirmUserReset2faBtn.addEventListener('click', async () => {
	const id = confirmUserReset2faBtn.dataset.userid;
	try {
		const res = await fetch(`/api/users/${id}/reset2fa`, { method: 'POST' });
		const data = await res.json();
		if (!data.success) throw new Error(data.error || 'Failed to reset');
		showToast('success', 'Reset user two-factor authentication');
		closeModal(user2faModal);
		await loadUsers();
	} catch (e) {
		showToast('error', `Failed to reset user: ${e.message}`);
	}
});

const saveBtn = document.getElementById('btnSaveCommunityProfile');
if (saveBtn) {
	saveBtn.addEventListener('click', saveCommunityProfile);
}

if (localStorage.getItem('nexusAuthEmail')) {
	settingsNexusEmail.value = localStorage.getItem('nexusAuthEmail');
	nexusPreDonateMessage.style.display = 'none';
}
else {
	settingsNexusAuthSettings.classList.add('active');
}
if (localStorage.getItem('nexusAuthToken')) {
	settingsNexusAuthToken.value = localStorage.getItem('nexusAuthToken');
}

settingsNexusAuthSettingsToggle.addEventListener('click', e => {
	settingsNexusAuthSettings.classList.toggle('active');
	e.preventDefault();
});

// Event listeners for nexus registration events
settingsNexusEmail.addEventListener('keyup', e => {
	if (e.key === 'Enter') {
		settingsNexusRegister.click();
	}
});
settingsNexusAuthToken.addEventListener('keyup', e => {
	if (e.key === 'Enter') {
		settingsNexusRegister.click();
	}
});
settingsNexusRegister.addEventListener('click', () => {
	let email = settingsNexusEmail.value,
		token = settingsNexusAuthToken.value;

	if (!email) {
		alert('Please enter a valid email address.');
		return;
	}

	if (!token) {
		alert('Please enter a valid token.');
		return;
	}

	showToast('info', 'Attempting to register with Warlock.Nexus...');
	sha256(email).then(hash => {
		const headers = {
			'X-Email': hash,
			'X-Auth-Token': token,
		};

		// Verify the authentication token first.
		fetch('https://api.warlock.nexus/community/ping', {headers})
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					showToast('success', 'Successfully authenticated with Warlock.Nexus!');
					settingsNexusAuthSettings.classList.remove('active');
					messageNexusRegisterResponse.innerHTML = '';
					nexusPreDonateMessage.style.display = 'none';
					localStorage.setItem('nexusAuthEmail', email);
					localStorage.setItem('nexusAuthToken', token);

					loadNexusProfile();
				}
				else {
					const message = document.createElement('p');
					message.classList.add('error-message');
					message.innerText = data.message;
					messageNexusRegisterResponse.innerHTML = '';
					messageNexusRegisterResponse.appendChild(message);
				}
			});
	});
});

// Pull the latest version for reference.
fetch('https://api.github.com/repos/BitsNBytes25/Warlock/tags').then(
	response => response.json()
).then(data => {
	if (!data || !data.length) {
		warlockLatestVersion.innerText = 'Error';
		console.error("Error:", "No data received");
	}
	else {
		warlockLatestVersion.innerText = data[0].name;
	}
}).catch(e => {
	warlockLatestVersion.innerText = 'Error';
	console.error("Error:", e);
});


// initial load
loadUsers();
loadNexusProfile();
