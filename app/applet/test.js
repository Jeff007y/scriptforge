const http = require('http');

const data = JSON.stringify({
  prompt: "test",
  context: "test",
  model: "gemini-1.5-flash"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/brainstorm',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', e => console.error('Error:', e));
req.write(data);
req.end();
