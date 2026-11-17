'use strict';
// CUSTOMIZE — the 🎨 sheet: the attic (string lights, walls, floor, rug, the view from the window) and
// your buddy (which animal, its fur, its name). Each choice is kept in set.look and shows right away.
// To add a choice: add a value to its list in LOOKS. A colour list becomes round swatches, a named list buttons.

const LOOKS = [
  { k: 'led', name: 'String lights', colors: ['#ffc66b', '#ff9fb0', '#9fd6ff', '#b7f0a0', '#d9b3ff', '#ffffff'] },
  { k: 'wall', name: 'Walls', colors: ['#17110d', '#1d1522', '#101a1c', '#1c1b12', '#231413'] },
  { k: 'floor', name: 'Floor', colors: ['#4a3320', '#7a5c3a', '#3a2626', '#3d4046'] },
  { k: 'rug', name: 'Rug', colors: ['#9c3f33', '#2f5d50', '#34507d', '#7a5a2a', 'none'] },
  { k: 'sky', name: 'Window', names: { night: 'Night', dusk: 'Sunset', day: 'Day', rain: 'Rain' } },
  {
    k: 'kind',
    name: 'Animal',
    names: Object.keys(ANIMALS).reduce((o, kind) => ({ ...o, [kind]: ANIMALS[kind].name }), {}),
  },
  { k: 'fur', name: 'Fur', colors: ['#e8964a', '#9a9ea8', '#f3ead8', '#7a5433', '#3a3a44', '#f2c94c', '#ffffff'] },
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
  set.look[b.parentElement.dataset.k] = b.dataset.v;
  saveSet();
  applyLook();
  drawLook();
};
$('#cPet').onchange = (e) => {
  set.pet = e.target.value.trim() || 'Inkwell';
  saveSet();
  emit('change');
};

applyLook();
