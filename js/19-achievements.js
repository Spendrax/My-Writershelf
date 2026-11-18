'use strict';
// ACHIEVEMENTS — notices when you've won a medal (MEDALS in 09-goals-stats.js) and unlocks its hat for your buddy.
// Won medals are kept in set.got, so a medal stays won even if the numbers go down later (words deleted…).
// Checked after any change, after petting (20-buddy-play.js) and after a meal (16-buddy-moves.js).

const hatUnlocked = (hat) => MEDALS.some((m) => m.hat === hat && hasMedal(m));

function checkMedals(quiet) {
  const s = medalStats();
  const fresh = MEDALS.reduce((list, m) => (!hasMedal(m) && m.test(s) ? list.concat(m) : list), []);
  if (!fresh.length) return;
  set.got = (set.got || []).concat(fresh.map((m) => m.id));
  saveSet();
  emit('change'); // the Stats wall shows the new medal
  if (quiet) return;
  // one at a time, so each one is seen
  fresh.forEach((m, i) =>
    setTimeout(() => {
      toast(`🏅 ${m.name}`);
      say(`🎩 New hat: ${HATS[m.hat].name}`, 5000);
    }, i * 3000),
  );
}

on('change', () => setTimeout(checkMedals, 0));
on('pet', () => checkMedals());
on('fed', () => checkMedals());
// The first time, medals already earned are unlocked without a fuss
checkMedals(!set.got);
