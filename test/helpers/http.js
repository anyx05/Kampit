async function request(app, requestPath, options = {}) {
    const server = await new Promise((resolve, reject) => {
        const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
        listeningServer.once('error', reject);
    });

    try {
        return await fetch(`http://127.0.0.1:${server.address().port}${requestPath}`, {
            redirect: 'manual',
            ...options
        });
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
}

module.exports = { request };
