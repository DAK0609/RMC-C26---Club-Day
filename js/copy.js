// Text the scripts put on screen. Fixed text is in the HTML files; pet texts are in pets.js.
// Lines marked "spec" are word-for-word from Web-mind-club.docx: change them only with the team.
export const COPY = {
  // Player
  nicknameEmpty: 'Please enter a nickname.',
  nicknameTaken: 'This username has been taken. Please choose another one.',
  invalidNumber: (max) => (max == null
    ? 'Please enter a whole number (0 or more).'
    : `Please enter a whole number from 0 to ${max}.`),
  summary: (d) => `Game 1: ${d.g1} · Game 2: ${d.g2} · Game 3: ${d.g3} — Is this correct?`, // spec
  place: (prize) => ['1st', '2nd', '3rd'][prize - 1],
  winner: (prize) => (prize === 1
    ? "Congratulations! You're #1! 🏆 Come back to the Mind Club booth to claim your prize." // spec
    : `Congratulations! You won the ${COPY.place(prize)} prize! 🏆 Come back to the Mind Club booth to claim it.`),
  finishedRank: (rank) => `Thanks for playing! You finished #${rank}.`, // spec
  comeToBooth: (name, prize) => "🏆 Come to the Mind Club booth now! If a winner isn't there, their prize goes to the next player in line."
    + (name ? ` Now calling: ${name} for the ${COPY.place(prize)} prize.` : ''),
  prizesDone: '🎉 All 3 prizes have been awarded.',
  prizeReceived: (prize) => `🎉 You received the ${COPY.place(prize)} prize. Congratulations and thanks for playing!`,
  closed: 'Results are closed, so this entry can no longer be submitted. Thanks for playing!',
  ended: 'The game has ended. Thanks for visiting Mind Club!',
  entryRemoved: "We couldn't find your previous entry. Please enter a nickname to start again.",
  failed: 'Connection problem. Please check your internet and try again.',
  reconnecting: 'Reconnecting…',

  // Leaderboard (iPad)
  boardEmpty: 'No players yet. Be the first!',
  claimPrize: (name, prize) => `🏆 ${name}, please come to the Mind Club booth to claim the ${COPY.place(prize)} prize!`,
  prizeGiven: '🎉 All 3 prizes have been awarded. Thanks for playing!',
  noMorePlayers: 'No more players in line.',
};
