// Scoring lives in supabase/schema.sql (players.total). This file only maps total → pet.
export function petFor(total) {
  if (total < 30) return { name: 'Baby Mindchi', img: 'img/pets/baby.png',
    text: "You're a Baby Mindchi! Small but full of potential — every great journey starts somewhere." };
  if (total < 60) return { name: 'Teenager Mindchi', img: 'img/pets/teen.png',
    text: "You're a Teenager Mindchi! Growing fast and full of energy — you're on your way up!" };
  return { name: 'Adult Mindchi', img: 'img/pets/adult.png',
    text: "You're an Adult Mindchi! Fully grown and ready for anything — you crushed it!" };
}
