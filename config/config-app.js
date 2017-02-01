// conf.js
// ----------
// all configurations

const users = [
	{
	  id: process.env.INSTAGRAM_0_ID,
	  username: process.env.INSTAGRAM_0_USERNAME,
	  password: process.env.INSTAGRAM_0_PASSWORD
	},
	{
	  id: process.env.INSTAGRAM_1_ID,
	  username: process.env.INSTAGRAM_1_USERNAME,
	  password: process.env.INSTAGRAM_1_PASSWORD
	}
];

module.exports = {
  user: users[1],
  logFile: "log.json"
};
