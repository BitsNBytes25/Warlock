import { getAppInstaller } from '../libs/get_app_installer.mjs';

const examples = [
  {
    title: 'ARK',
    source: 'github',
    repo: 'cdp1337/ARKSurvivalAscended-Linux',
    branch: 'dev',
    installer: 'dist/server-install-debian12.sh'
  },
  {
    title: 'VEIN',
    source: 'github',
    repo: 'BitsNBytes25/VEIN-Dedicated-Server',
    // default branch (no branch set) should default to main
    installer: 'dist/installer.sh'
  }
];

(async () => {
  for (const app of examples) {
    try {
      const url = await getAppInstaller(app);
      console.log(`${app.title}: ${url}`);
    } catch (err) {
      console.error(`${app.title}: Error:`, err.message || err);
    }
  }
})();

