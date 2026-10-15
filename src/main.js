import * as THREE from "three";
import { SkinViewer } from "skinview3d";
import "./style.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#">
      <span class="brand-logo">S</span>
      <span>
        <strong>SoMirkuz_'s Boutique</strong>
        <small>MINECRAFT SKIN STUDIO</small>
      </span>
    </a>
    <div class="header-actions">
      <label class="btn secondary">
        Importa PNG
        <input id="upload" type="file" accept="image/png" hidden />
      </label>
      <button id="download" class="btn primary">Esporta skin ↗</button>
    </div>
  </header>

  <main class="workspace">
    <aside class="panel tools-panel">
      <h2>Strumenti</h2>
      <div class="tools">
        <button class="tool active" data-tool="brush">✎<small>Matita</small></button>
        <button class="tool" data-tool="eraser">▱<small>Gomma</small></button>
        <button class="tool" data-tool="fill">▨<small>Secchiello</small></button>
        <button class="tool" data-tool="picker">⌁<small>Contagocce</small></button>
      </div>

      <div class="separator"></div>
      <h2>Colore</h2>
      <label class="color-picker">
        <input id="color" type="color" value="#42a66b" />
        <span>Seleziona colore</span>
      </label>
      <div class="palette">
        ${["#20252d","#ffffff","#e5b18a","#8c5438","#e85d5d","#f0b44c","#64b982","#4b91e2","#9369cf","#e98ab5","#7e8a99","#c7d1d9"].map(c => `<button class="swatch" style="background:${c}" data-color="${c}" aria-label="Colore ${c}"></button>`).join("")}
      </div>

      <div class="separator"></div>
      <h2>Modello</h2>
      <div class="segmented">
        <button class="active" data-model="classic">Classic</button>
        <button data-model="slim">Slim</button>
      </div>

      <div class="separator"></div>
      <h2>Texture</h2>
      <p class="hint">Dimensione standard: 64 × 64 pixel.</p>
      <button id="clear" class="btn secondary full">Cancella texture</button>
    </aside>

    <section class="panel preview-panel">
      <div class="panel-heading">
        <div><h1>Anteprima 3D</h1><p>Trascina per ruotare il personaggio</p></div>
        <span class="live"><i></i> LIVE</span>
      </div>
      <div id="stage" class="stage">
        <span class="stage-label">VISTA 3D</span>
        <canvas id="skin-view"></canvas>
        <span class="stage-help">Trascina per ruotare · Scroll per zoom</span>
      </div>
      <div class="footer-status"><span>● Anteprima interattiva</span><button id="reset-view">Reimposta vista ↻</button></div>
    </section>

    <section class="panel texture-panel">
      <div class="panel-heading">
        <div><h1>Texture editor</h1><p>Disegna direttamente sui pixel</p></div>
        <span class="tag">64 × 64</span>
      </div>
      <div class="texture-stage">
        <canvas id="texture" width="64" height="64"></canvas>
      </div>
      <div class="zoom-row">
        <label for="zoom">Zoom</label>
        <input id="zoom" type="range" min="3" max="10" value="6" />
        <span id="zoom-label">6×</span>
      </div>
      <p class="hint">La texture viene esportata in PNG.</p>
      <button id="download-bottom" class="btn primary full">Scarica PNG ↓</button>
    </section>
  </main>
  <footer class="site-footer">
    <span>SoMirkuz_'s Boutique · Skin Studio</span>
    <span>Minecraft Java · PNG</span>
  </footer>
`;

const $ = (s) => document.querySelector(s);
const texture = $("#texture");
const ctx = texture.getContext("2d", { willReadFrequently: true });
const colorInput = $("#color");
let tool = "brush";
let drawing = false;
let currentModel = "classic";
let currentColor = colorInput.value;
let zoom = 6;
let undoStack = [];

function makeStarterTexture() {
  ctx.clearRect(0, 0, 64, 64);

  // Palette di partenza dimostrativa: puoi importare la tua skin PNG.
  ctx.fillStyle = "#b8784f";
  ctx.fillRect(8, 8, 8, 8);
  ctx.fillRect(40, 8, 8, 8);
  ctx.fillStyle = "#493426";
  ctx.fillRect(8, 8, 8, 2);
  ctx.fillRect(40, 8, 8, 2);
  ctx.fillStyle = "#315b91";
  ctx.fillRect(20, 20, 8, 12);
  ctx.fillRect(20, 36, 8, 12);
  ctx.fillStyle = "#285080";
  ctx.fillRect(44, 20, 4, 12);
  ctx.fillRect(4, 20, 4, 12);
  ctx.fillStyle = "#e5b18a";
  ctx.fillRect(12, 8, 4, 4);
}

function saveUndo() {
  undoStack.push(ctx.getImageData(0, 0, 64, 64));
  if (undoStack.length > 30) undoStack.shift();
}

function updatePreview() {
  if (!viewer) return;
  viewer.loadSkin(texture.toDataURL("image/png"));
}

let viewer;

try {
  viewer = new SkinViewer({
    canvas: $("#skin-view"),
    width: 480,
    height: 600,
    skin: null,
  });

  viewer.controls.enableRotate = true;
  viewer.controls.enableZoom = true;
  viewer.controls.enablePan = false;
  viewer.camera.position.set(28, 18, 42);
} catch (error) {
  console.error("Errore nell'inizializzazione dell'anteprima 3D:", error);
}

function getPixel(event) {
  const rect = texture.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - rect.left) / rect.width * 64),
    y: Math.floor((event.clientY - rect.top) / rect.height * 64),
  };
}

function floodFill(startX, startY) {
  const image = ctx.getImageData(0, 0, 64, 64);
  const data = image.data;
  const start = (startY * 64 + startX) * 4;
  const target = Array.from(data.slice(start, start + 4));
  const replacement = [
    parseInt(currentColor.slice(1, 3), 16),
    parseInt(currentColor.slice(3, 5), 16),
    parseInt(currentColor.slice(5, 7), 16),
    255,
  ];

  if (target.every((v, i) => v === replacement[i])) return;

  const stack = [[startX, startY]];
  const seen = new Set();

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= 64 || y < 0 || y >= 64) continue;

    const key = y * 64 + x;
    if (seen.has(key)) continue;
    seen.add(key);

    const i = key * 4;
    if (!target.every((v, j) => data[i + j] === v)) continue;

    data[i] = replacement[0];
    data[i + 1] = replacement[1];
    data[i + 2] = replacement[2];
    data[i + 3] = replacement[3];

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(image, 0, 0);
}

function paint(event) {
  const { x, y } = getPixel(event);
  if (x < 0 || x >= 64 || y < 0 || y >= 64) return;

  if (tool === "picker") {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    currentColor = "#" + [...pixel].slice(0, 3)
      .map(v => v.toString(16).padStart(2, "0")).join("");
    colorInput.value = currentColor;
    return;
  }

  if (tool === "fill") {
    floodFill(x, y);
  } else if (tool === "eraser") {
    ctx.clearRect(x, y, 1, 1);
  } else {
    ctx.fillStyle = currentColor;
    ctx.fillRect(x, y, 1, 1);
  }

  updatePreview();
}

texture.addEventListener("pointerdown", event => {
  event.preventDefault();
  texture.setPointerCapture(event.pointerId);
  saveUndo();
  drawing = true;
  paint(event);
});

texture.addEventListener("pointermove", event => {
  if (drawing && tool !== "fill" && tool !== "picker") paint(event);
});

texture.addEventListener("pointerup", () => {
  drawing = false;
});

texture.addEventListener("pointercancel", () => {
  drawing = false;
});

document.querySelectorAll("[data-tool]").forEach(button => {
  button.addEventListener("click", () => {
    tool = button.dataset.tool;
    document.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("active", b === button));
  });
});

colorInput.addEventListener("input", () => {
  currentColor = colorInput.value;
});

document.querySelectorAll("[data-color]").forEach(button => {
  button.addEventListener("click", () => {
    currentColor = button.dataset.color;
    colorInput.value = currentColor;
  });
});

document.querySelectorAll("[data-model]").forEach(button => {
  button.addEventListener("click", () => {
    currentModel = button.dataset.model;
    document.querySelectorAll("[data-model]").forEach(b => b.classList.toggle("active", b === button));

    if (viewer) {
      viewer.playerObject.skin.leftArm.visible = true;
      viewer.playerObject.skin.rightArm.visible = true;
    }
    // La geometria Slim va configurata separatamente.
  });
});

function downloadSkin() {
  const link = document.createElement("a");
  link.download = "somirkuz-skin.png";
  link.href = texture.toDataURL("image/png");
  link.click();
}

$("#download").addEventListener("click", downloadSkin);
$("#download-bottom").addEventListener("click", downloadSkin);

$("#upload").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;

  const image = new Image();
  image.onload = () => {
    saveUndo();
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(image, 0, 0, 64, 64);
    updatePreview();
    URL.revokeObjectURL(image.src);
    event.target.value = "";
  };
  image.src = URL.createObjectURL(file);
});

$("#clear").addEventListener("click", () => {
  saveUndo();
  ctx.clearRect(0, 0, 64, 64);
  updatePreview();
});

$("#zoom").addEventListener("input", event => {
  zoom = Number(event.target.value);
  $("#zoom-label").textContent = zoom + "×";
  texture.style.width = `${64 * zoom}px`;
  texture.style.height = `${64 * zoom}px`;
});

$("#reset-view").addEventListener("click", () => {
  if (viewer) viewer.camera.position.set(28, 18, 42);
});

makeStarterTexture();
updatePreview();
texture.style.width = `${64 * zoom}px`;
texture.style.height = `${64 * zoom}px`;
