const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const HOST = 'localhost';
const PORT = 3077;
const TARGET_HOST = '127.0.0.1'; // Assuming localhost is a valid host in DB
const REMOTE_PATH = '/tmp/test_download.bin';
const DOWNLOADED_FILE = 'downloaded_test_file.bin';

// Create a dummy binary file on the "remote" (local) host
const buffer = Buffer.alloc(1024);
for (let i = 0; i < 1024; i++) {
    buffer[i] = i % 256;
}
fs.writeFileSync(REMOTE_PATH, buffer);

// Prepare request
const options = {
    hostname: HOST,
    port: PORT,
    path: `/api/file/download/${TARGET_HOST}?path=${REMOTE_PATH}`,
    method: 'GET'
};

console.log(`Downloading from http://${HOST}:${PORT}${options.path}...`);

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    if (res.statusCode !== 200) {
        console.error('FAILURE: Status code is not 200');
        res.setEncoding('utf8');
        res.on('data', chunk => console.log('BODY:', chunk));
        process.exit(1);
    }

    const fileStream = fs.createWriteStream(DOWNLOADED_FILE);
    res.pipe(fileStream);

    fileStream.on('finish', () => {
        fileStream.close();
        console.log('Download completed.');

        // Verify content
        const downloadedBuffer = fs.readFileSync(DOWNLOADED_FILE);
        if (buffer.equals(downloadedBuffer)) {
            console.log('SUCCESS: Downloaded file matches original.');

            // Cleanup
            fs.unlinkSync(REMOTE_PATH);
            fs.unlinkSync(DOWNLOADED_FILE);
            process.exit(0);
        } else {
            console.error('FAILURE: Downloaded file content mismatch.');
            // Cleanup
            fs.unlinkSync(REMOTE_PATH);
            fs.unlinkSync(DOWNLOADED_FILE);
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
    fs.unlinkSync(REMOTE_PATH);
    process.exit(1);
});

req.end();
