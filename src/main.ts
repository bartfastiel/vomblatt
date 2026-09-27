import './ui/styles.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (app === null) throw new Error('#app missing');

app.innerHTML = `
  <label class="photo-button">
    <input type="file" accept="image/*" capture="environment" />
    Notenblatt fotografieren
  </label>
  <div class="preview" hidden>
    <img alt="Fotografiertes Notenblatt" />
    <p>Erkennung folgt bald.</p>
  </div>
`;

const input = app.querySelector('input');
const preview = app.querySelector<HTMLDivElement>('.preview');
const img = app.querySelector('img');

if (input !== null && preview !== null && img !== null) {
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file === undefined) return;
    img.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
}
