// conf.js
// ----------
// all configurations


const user = {
  id: process.env.INSTAGRAM_0_ID,
  username: process.env.INSTAGRAM_0_USERNAME,
  password: process.env.INSTAGRAM_0_PASSWORD
};

module.exports = {
  user: user,
  logFile: "log.json"
};
