const dns = require('node:dns');

function configureDnsServers(environment = process.env, logger = console) {
    if (!environment.DNS_SERVERS) return 0;

    const servers = environment.DNS_SERVERS
        .split(',')
        .map((server) => server.trim())
        .filter(Boolean);

    if (!servers.length) {
        throw new Error('DNS_SERVERS must contain at least one DNS server address.');
    }

    dns.setServers(servers);
    logger.log(`Configured ${servers.length} Node DNS resolver(s).`);
    return servers.length;
}

module.exports = { configureDnsServers };
