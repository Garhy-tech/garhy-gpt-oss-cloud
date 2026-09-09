const fs = require('fs');
const path = require('path');

function readChunk(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', name), 'utf8').trim();
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  const base64 = [
    readChunk('chunk1.txt'),
    readChunk('chunk2.txt'),
    readChunk('chunk3.txt'),
    readChunk('chunk4.txt'),
    readChunk('chunk5.txt'),
    readChunk('chunk6.txt'),
    readChunk('chunk7.txt'),
    readChunk('chunk8.txt')
  ].join('');

  const image = Buffer.from(base64, 'base64');
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Content-Length', String(image.length));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(image);
};
