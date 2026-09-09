const fs = require('fs');
const path = require('path');

const chunk1 = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', 'chunk1.txt'), 'utf8').trim();
const chunk2 = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', 'chunk2.txt'), 'utf8').trim();
const chunk3 = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', 'chunk3.txt'), 'utf8').trim();
const chunk4 = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', 'chunk4.txt'), 'utf8').trim();
const chunk5 = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', 'chunk5.txt'), 'utf8').trim();
const chunk6 = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', 'chunk6.txt'), 'utf8').trim();
const chunk7 = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', 'chunk7.txt'), 'utf8').trim();
const chunk8 = fs.readFileSync(path.join(__dirname, '..', 'lib', 'profile', 'chunk8.txt'), 'utf8').trim();

const image = Buffer.from(chunk1 + chunk2 + chunk3 + chunk4 + chunk5 + chunk6 + chunk7 + chunk8, 'base64');

module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Content-Length', String(image.length));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(image);
};
