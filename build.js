const fs = require("fs");
require("dotenv").config();

const base = process.env.API_BASE_URL?.replace(/;+$/, '');
const key = process.env.API_KEY?.replace(/;+$/, '');

if (!base || !key) {
  console.error("Missing API_BASE_URL or API_KEY in environment");
  process.exit(1);
}

fs.writeFileSync(
  "config.js",
  `var BASE=${JSON.stringify(base)};\nvar KEY=${JSON.stringify(key)};\n`,
);

console.log("config.js written");
