const usersTableBody = document.getElementById('usersTableBody');
const btnCreateUser = document.getElementById('btnCreateUser');
const userModal = document.getElementById('userModal');
const changePasswordModal = document.getElementById('changePasswordModal');
const userDeleteModal = document.getElementById('userDeleteModal');

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
			usersTableBody.innerHTML = '<tr><td colspan="3">No users configured.</td></tr>';
			return;
		}
		usersTableBody.innerHTML = '';
		users.forEach(u => {
			const tr = document.createElement('tr');
			tr.innerHTML = `<td>${u.username}</td><td>${new Date(u.createdAt).toLocaleString()}</td><td>
				<button class="action-edit" data-id="${u.id}">Edit</button>
				<button class="action-password" data-id="${u.id}">Password</button>
				<button class="action-remove" data-id="${u.id}">Delete</button>
			</td>`;
			usersTableBody.appendChild(tr);
		});
		// attach handlers
		document.querySelectorAll('.action-edit').forEach(btn => btn.addEventListener('click', onEditUser));
		document.querySelectorAll('.action-password').forEach(btn => btn.addEventListener('click', onChangePassword));
		document.querySelectorAll('.action-remove').forEach(btn => btn.addEventListener('click', onDeleteUser));
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

// initial load
loadUsers();

