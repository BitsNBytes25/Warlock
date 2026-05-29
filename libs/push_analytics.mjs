import https from "https";
import {MetaModel} from "../db/models/meta.mjs";
import {execSync} from "child_process";
import pkg from '../package.json' with { type: "json" };

export function push_analytics(action) {
	// Send a tracking snippet to our analytics server so we can monitor basic usage.
	// We just send the version of Warlock you are running and otherwise no uniquely identifying information.
	const params = new URLSearchParams();
	let uaData = {};
	params.append('idsite', '8');
	params.append('rec', '1');
	params.append('action_name', action);

	try {
		if (pkg && pkg.version) {
			params.append('dimension1', pkg.version);
		}
	} catch (e) {
		console.log(e);
	}

	uaData.platform = execSync('lsb_release -i 2>/dev/null | sed "s#.*:\\t##"').toString().trim();
	uaData.platformVersion = execSync('lsb_release -r 2>/dev/null | sed "s#.*:\\t##"').toString().trim();
	params.append('uadata', JSON.stringify(uaData));

	MetaModel.findOne({key: 'install_id'}).then(meta => {
		if (meta && meta.value) {
			params.append('_id', meta.value);
		}
		else {
			// Create a new install_id if it doesn't exist
			// This needs to be a 16-character hex string.
			const installId = [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
			(new MetaModel({key: 'install_id', value: installId})).save().then(() => {
				params.append('_id', installId);
			});
		}
	});

	try {
		https.get(`https://metrics.eval.bz/matomo.php?${params.toString()}`);
	}
	catch { }
}
