'use strict';
// CUSTOMIZE — the 🎨 sheet: the attic (string lights, walls, floor, rug, the view from the window) and
// your buddy (which animal, its fur, its name). Each choice is kept in set.look and shows right away.
// To add a choice: add a value to its list in LOOKS. A colour list becomes round swatches, a named list buttons.
// When you tap a choice the room shows you what changes (lookAt): `see` is where to look on the wall (its top
// or its floor), `on` is which wall (the attic, or wherever your buddy is; none = the wall you're on).

const LOOKS = [
  { k: 'led', name: 'String lights', see: 'top', colors: ['#ffc66b', '#ff9fb0', '#9fd6ff', '#b7f0a0', '#d9b3ff', '#ffffff'] },
  { k: 'wall', name: 'Walls', see: 'top', colors: ['#17110d', '#1d1522', '#101a1c', '#1c1b12', '#231413'] },
  { k: 'floor', name: 'Floor', see: 'floor', colors: ['#4a3320', '#7a5c3a', '#3a2626', '#3d4046'] },
  { k: 'rug', name: 'Rug', see: 'floor', on: 'attic', colors: ['#9c3f33', '#2f5d50', '#34507d', '#7a5a2a', 'none'] },
  { k: 'sky', name: 'Window', see: 'top', on: 'attic', names: { night: 'Night', dusk: 'Sunset', day: 'Day', rain: 'Rain' } },
  {
    k: 'kind',
    name: 'Animal',
    see: 'floor',
    on: 'pet',
    names: Object.keys(ANIMALS).reduce((o, kind) => ({ ...o, [kind]: ANIMALS[kind].name }), {}),
  },
  { k: 'fur', name: 'Fur', see: 'floor', on: 'pet', colors: ['#e8964a', '#9a9ea8', '#f3ead8', '#7a5433', '#3a3a44', '#f2c94c', '#ffffff'] },
];

// Puts set.look on the page: colours as CSS variables, the window's view as data-sky, the rug shown or not
function applyLook() {
  const { led, wall, floor, rug, sky, fur } = set.look;
  const root = document.documentElement;
  Object.entries({ '--led': led, '--wall': wall, '--fl': floor, '--rug': rug, '--fur': fur }).forEach(([name, v]) =>
    root.style.setProperty(name, v),
  );
  root.dataset.sky = sky;
  $('.rug').hidden = rug === 'none';
  emit('look'); // the buddy redraws itself if the animal changed
}

// Turns to the right wall and scrolls it to the part being changed
function lookAt(o) {
  const k = o.on === 'attic' ? WALLS.attic : o.on === 'pet' ? where.wall : WALLS[view];
  if (k !== WALLS[view]) go(k);
  const wall = wallEls.find(([, wallK]) => wallK === k)[0];
  wall.scrollTo({ top: o.see === 'top' ? 0 : wall.scrollHeight, behavior: 'smooth' });
}

function drawLook() {
  $('#cBody').innerHTML = LOOKS.reduce((h, o) => {
    const on = (v) => (set.look[o.k] === v ? ' class="on"' : '');
    const buttons = o.colors
      ? o.colors.reduce(
          (b, c) =>
            b + `<button data-v="${c}"${on(c)} style="--c:${c}" aria-label="${o.name}">${c === 'none' ? '✕' : ''}</button>`,
          '',
        )
      : Object.entries(o.names).reduce((b, [v, name]) => b + `<button data-v="${v}"${on(v)}>${name}</button>`, '');
    return h + `<div class="opt">${o.name}<div class="${o.colors ? 'swatches' : 'seg'}" data-k="${o.k}">${buttons}</div></div>`;
  }, '');
}

$('#btnLook').onclick = () => {
  drawLook();
  $('#cPet').value = set.pet;
  $('#dlgLook').showModal();
  document.body.classList.add('looking'); // the walls make room for the sheet (css/sheets.css)
  $('#view-' + view).scrollTop = 1e6; // down to the floor
};
$('#dlgLook').addEventListener('close', () => document.body.classList.remove('looking'));
$('#cBody').onclick = (e) => {
  const b = e.target.closest('button[data-v]');
  if (!b) return;
  const o = LOOKS.find((l) => l.k === b.parentElement.dataset.k);
  set.look[o.k] = b.dataset.v;
  saveSet();
  applyLook();
  drawLook();
  lookAt(o);
};
$('#cPet').onchange = (e) => {
  set.pet = e.target.value.trim() || 'Inkwell';
  saveSet();
  emit('change');
};

applyLook();
