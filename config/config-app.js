// confing-app.js
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

const hashtags = [
	'#yourhashtags'
];

module.exports = {
  user: users[0],
  hashtags: hashtags,
  logfile: './logs/log.json'
};
