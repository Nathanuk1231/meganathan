export const firebaseConfig = {
  apiKey: "AIzaSyDgddDLpa2XSLvzNBzSd1dkkkZ5Kt32axM",
  authDomain: "coolwebsitechat.firebaseapp.com",
  databaseURL: "https://coolwebsitechat-default-rtdb.firebaseio.com",
  projectId: "coolwebsitechat",
  storageBucket: "coolwebsitechat.appspot.com",
  messagingSenderId: "341962893234",
  appId: "1:341962893234:web:c3b1ca2a1279bce71326ab"
};

firebase.initializeApp(firebaseConfig);

export const db = firebase.database();
export const auth = firebase.auth();

export const CHANNELS = ['general', 'random', 'gaming', 'music-chat'];
export const CH_ICONS = {
  general: '📢',
  random: '🎲',
  gaming: '🎮',
  'music-chat': '🎵'
};

export const EMOJIS = ['👍','❤️','😂','😮','😢','🔥','👏','🎉','💯','🤔','😍','🙌'];
export const STICKERS = ['🐍','🦕','🎮','🎵','🔥','💯','👑','🚀','💎','⚡','🌟','🎯',
                         '🤝','👀','😎','🥳','💀','🤖','👾','🎪','🌈','💫','🏆','🎲'];

export const GAME_URLS = {
  snake: './snakeGame.html',
  dino: 'https://chromedino.com/',
  '2048': 'https://2048game.com/',
  tetris: 'https://chvin.github.io/react-tetris/',
  pacman: 'https://freepacman.org/'
};

export const GAME_NAMES = {
  snake: 'Snake',
  dino: 'Chrome Dino',
  '2048': '2048',
  tetris: 'Tetris',
  pacman: 'Pac-Man'
};

export const BAD_WORDS = ["arse","bloody","bugger","arsehole","balls","bitch","bollocks",
  "bullshit","shit","bastard","bellend","cock","dick","dickhead","fanny","knob","prick",
  "pussy","twat","cunt","fuck","motherfucker","wanker","tosser"];