export function correctMimetype(filename, mimetype) {
	const extension = filename.split('.').pop().toLowerCase();

	if (extension === 'json' && mimetype === 'text/plain') {
		return 'application/json';
	}

	if (extension === 'xml' && mimetype === 'text/plain') {
		return 'application/xml';
	}

	if (extension === 'html' && mimetype === 'text/plain') {
		return 'text/html';
	}

	if (extension === 'js' && mimetype === 'text/plain') {
		return 'application/javascript';
	}

	if (extension === 'css' && mimetype === 'text/plain') {
		return 'text/css';
	}

	if (extension === 'yaml' && mimetype === 'text/plain') {
		return 'application/yaml';
	}

	return mimetype;
}