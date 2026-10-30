// Text the scripts put on screen. Fixed text is in the HTML files; Mindchi texts are in pets.js.
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
  // After Finish: the card at the top of the phone, as { title, text }. The spec's 🏆 is a drawn icon.
  winner: (prize) => (prize === 1
    ? { title: "Congratulations! You're #1!", text: 'Come back to the Mind Club booth to claim your prize.' } // spec
    : { title: `Congratulations! You won the ${COPY.place(prize)} prize!`, text: 'Come back to the Mind Club booth to claim it.' }),
  finishedRank: (rank) => `Thanks for playing! You finished #${rank}.`, // spec
  comeToBooth: "Come to the Mind Club booth now! If a winner isn't there, their prize goes to the next player in line.",
  prizesDone: 'All 3 prizes have been awarded.',
  prizeReceived: (prize) => ({ title: `You received the ${COPY.place(prize)} prize.`, text: 'Congratulations and thanks for playing!' }),
  slot: { given: 'Given', calling: 'Calling now', waiting: 'Waiting', next: 'Next', nobody: 'No one left', removed: 'Removed' },
  closed: 'Results are closed, so this entry can no longer be submitted. Thanks for playing!',
  ended: 'The game has ended. Thanks for visiting Mind Club!',
  entryRemoved: "We couldn't find your previous entry. Please enter a nickname to start again.",
  failed: 'Connection problem. Please check your internet and try again.',
  reconnecting: 'Reconnecting…',

  // Leaderboard (iPad): the prize call card, as [small line, big line, text]
  board: {
    calling: (name, place) => [`Now calling for the ${place} prize`, name, `Please come to the Mind Club booth to claim the ${place} prize!`],
    nobody: (place) => [`${place} prize`, 'No more players in line.', ''],
    done: ["That's a wrap!", 'All 3 prizes have been awarded.', 'Thanks for playing!'],
  },
};
