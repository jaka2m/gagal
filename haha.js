const express = require('express');
const tls = require('tls');
const app = express();

async function checkIP(input) {
    let proxy, port;

    // Deteksi format input
    if (input.includes(':')) {
        [proxy, port] = input.split(':');
    } else if (input.includes('-')) {
        [proxy, port] = input.split('-');
    } else {
        proxy = input;
        port = 443; 
    }

    const sendRequest = (host, path, useProxy = true) => {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const socket = tls.connect({
                host: useProxy ? proxy : host,
                port: useProxy ? port : 443,
                servername: host
            }, () => {
                const request = `GET ${path} HTTP/1.1\r\n` +
                    `Host: ${host}\r\n` +
                    `User-Agent: Mozilla/5.0\r\n` +
                    `Connection: close\r\n\r\n`;
                socket.write(request);
            });

            let responseBody = '';
            socket.on('data', (data) => {
                responseBody += data.toString();
            });
            socket.on('end', () => {
                const body = responseBody.split('\r\n\r\n')[1] || '';
                const latency = Date.now() - start;
                resolve({ body, latency });
            });
            socket.on('error', (error) => {
                reject(error);
            });
            socket.setTimeout(1000, () => {
                reject(new Error('Request timeout'));
                socket.end();
            });
        });
    };

    return new Promise(async (resolve, reject) => {
        if (!input) return;
        try {
            const [ipinfo, myip] = await Promise.all([
                sendRequest('myip.geo-project.workers.dev', '/', true),
                sendRequest('myip.geo-project.workers.dev', '/', false),
            ]);

            const ipingfo = JSON.parse(ipinfo.body || '{}');
            const srvip = JSON.parse(myip.body || '{}');

            resolve({
                proxy: proxy || null,
                ip: ipingfo.ip || null,
                myip: srvip.ip || null,
                port: port || null,
                status: ipingfo.ip && ipingfo.ip !== srvip.ip ? "ACTIVE" : "DEAD",
delay: ipinfo.latency ? `${ipinfo.latency} ms` : "N/A",
                asn: ipingfo.asn || null,
                colo: ipingfo.colo || null,
                isp: ipingfo.asOrganization || null,
                countryCode: ipingfo.country || null,
                country: ipingfo.country ? `${ipingfo.country} ${getFlagEmoji(ipingfo.country)}` : null,
                flag: ipingfo.country ? getFlagEmoji(ipingfo.country) : null,
                city: ipingfo.city || null,
                timezone: ipingfo.timezone || null,
                latitude: ipingfo.latitude || null,
                longitude: ipingfo.longitude || null,
                //subnets: {
                    //ipv4: ipingfo.subnets?.ipv4 || [],
                   // ipv6: ipingfo.subnets?.ipv6 || []
               // }
            });
        } catch (error) {
            resolve({ error: error.message });
        }
    });
}

app.get('/check', async (req, res) => {
    const { ip } = req.query;

    if (!ip) {
        return res.status(400).json({ error: 'IP address is required' });
    }

    try {
        const result = await checkIP(ip);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(result, null, 4));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function getFlagEmoji(countryCode) {
    if (!countryCode) return '';
    const codePoints = countryCode.toUpperCase().split('').map(letter => {
        return 0x1F1E6 - 65 + letter.charCodeAt(0);
    });
    return String.fromCodePoint(...codePoints);
}

app.listen(8080, () => {
    console.log('Server listening on port 9999');
});
