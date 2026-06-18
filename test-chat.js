const http = require('http');

const payload = JSON.stringify({
  messages: [
    { role: 'user', content: 'I want a chocolate cake' },
    { role: 'assistant', content: '', toolInvocations: [{ state: 'result', toolCallId: 'call_1', toolName: 'kapruka_search_products', args: { keyword: 'chocolate cake', limit: 6 }, result: [{ id: '123', name: 'Chocolate Cake' }] }] },
    { role: 'assistant', content: 'Please tell me your delivery city and date.' },
    { role: 'user', content: 'Colombo, 2026-06-20' }
  ],
  language: 'English'
});

const req = http.request('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`CHUNK: ${chunk.toString()}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(payload);
req.end();
