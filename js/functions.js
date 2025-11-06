let alabanzas = JSON.parse(localStorage.getItem("alabanzas") || "[]");
  let seleccionadas = JSON.parse(localStorage.getItem("seleccionadas") || "[]");
  let alabanzaActual = null;
  let semitonoOffset = 0;

  const notas = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const bemoles = {"Db":"C#","Eb":"D#","Gb":"F#","Ab":"G#","Bb":"A#"};
  const songList = document.getElementById("songList");
  const selectedList = document.getElementById("selectedList");
  const searchInput = document.getElementById("searchInput");

  renderListas();
  searchInput.addEventListener("input", renderListas);

  // --------------------------
  // Tema (modo día/noche)
  // --------------------------
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.classList.add(savedTheme + "-mode");
  themeToggle.textContent = savedTheme === "light" ? "🌙 Noche" : "☀️ Día";

  themeToggle.addEventListener("click", () => {
    const current = document.body.classList.contains("dark-mode") ? "dark" : "light";
    const newTheme = current === "light" ? "dark" : "light";
    document.body.classList.remove(current + "-mode");
    document.body.classList.add(newTheme + "-mode");
    localStorage.setItem("theme", newTheme);
    themeToggle.textContent = newTheme === "light" ? "🌙 Noche" : "☀️ Día";
    let tono=document.getElementById("songMeta");
    tono.classList.remove(current);
    tono.classList.add(newTheme);
  });

  // --------------------------
  // Render de listas
  // --------------------------
  function renderListas() {
    const filtro = searchInput.value.toLowerCase();
    songList.innerHTML = "";
    selectedList.innerHTML = "";

    // Todas
    alabanzas
      .filter(a => a.titulo.toLowerCase().includes(filtro))
      .forEach((a, i) => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `<span role="button">${a.titulo}</span>
                        <button class="btn btn-sm btn-outline-success">➕</button>`;
        li.querySelector("span").onclick = () => mostrarAlabanza(i);
        li.querySelector("button").onclick = () => agregarSeleccionada(i);
        songList.appendChild(li);
      });

    // Seleccionadas
    seleccionadas.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";
      li.innerHTML = `<span role="button">${a.titulo}</span>
                      <button class="btn btn-sm btn-outline-danger">➖</button>`;
      li.querySelector("span").onclick = () => mostrarSeleccionada(i);
      li.querySelector("button").onclick = () => quitarSeleccionada(i);
      selectedList.appendChild(li);
    });

    localStorage.setItem("seleccionadas", JSON.stringify(seleccionadas));
  }

  // --------------------------
  // Selección
  // --------------------------
  function agregarSeleccionada(i) {
    const item = alabanzas[i];
    if (!seleccionadas.find(a => a.titulo === item.titulo)) {
      seleccionadas.push(item);
      renderListas();
    }
  }

  function quitarSeleccionada(i) {
    seleccionadas.splice(i, 1);
    renderListas();
  }

  function limpiarSeleccionadas() {
    if (confirm("¿Quitar todas las seleccionadas?")) {
      seleccionadas = [];
      renderListas();
    }
  }

  // --------------------------
  // Mostrar / Render
  // --------------------------
  function mostrarAlabanza(index) {
    alabanzaActual = { tipo: "todas", index };
    semitonoOffset = 0;
    renderAlabanza(alabanzas[index].contenido);
  }

  function mostrarSeleccionada(index) {
    alabanzaActual = { tipo: "seleccionadas", index };
    semitonoOffset = 0;
    renderAlabanza(seleccionadas[index].contenido);
  }

  function renderAlabanza(contenido) {
    const titulo = (contenido.match(/{title:\s*(.+)}/i) || [])[1] || "";
    const artista = (contenido.match(/{artist:\s*(.+)}/i) || [])[1] || "";
    const tonoOriginal = (contenido.match(/{key:\s*([A-G][#b]?)/i) || [])[1] || "";
    const tonoTranspuesto = tonoOriginal ? transponerNota(tonoOriginal, semitonoOffset) : "";

    document.getElementById("songTitle").textContent = titulo;
    document.getElementById("songMeta").innerHTML = `
      ${artista ? artista + " — " : ""} 
      ${tonoOriginal ? `<strong>Tono:</strong> ${tonoTranspuesto}` : ""}`;
    document.getElementById("songContent").innerHTML = formatoChordProVisual(contenido);
    document.getElementById("songView").style.display = "block";
    document.getElementById("editorView").style.display = "none";
  }

  function formatoChordProVisual(text) {
    function escapeHtml(s) {
      return s.replace(/&/g,"&amp;")
              .replace(/</g,"&lt;")
              .replace(/>/g,"&gt;");
    }

    const lines = text.split("\n");
    let html = "";

    for (let rawLine of lines) {
      let line = rawLine.replace(/\r/g, "").replace(/\t/g, " ");
      if (!line.trim()) { html += "<br>"; continue; }

      // Comentarios tipo {c: ...}
      if (line.match(/^{c[:}]?.*}$/i)) {
        const comentario = line.replace(/^{c[:}]?/i, "").replace("}", "").trim();
        html += `<div class="fw-bold mt-3">${escapeHtml(comentario)}</div>`;
        continue;
      }

      // Omitir metadatos como {title}, {artist}, etc.
      if (line.match(/^{(title|artist|key|sot|eot).*}$/i)) continue;

      // Si no hay acordes, mostrar texto normal
      if (!line.includes("[")) {
        html += `<pre>${escapeHtml(line)}</pre>`;
        continue;
      }

      // Procesar acordes
      const chords = [];
      const lyrics = [""];
      let i = 0;
      while (i < line.length) {
        if (line[i] === "[") {
          const j = line.indexOf("]", i);
          if (j === -1) { lyrics[lyrics.length - 1] += line.slice(i); break; }
          chords.push(line.substring(i+1, j)); // guarda acorde
          lyrics.push("");
          i = j + 1;
        } else {
          lyrics[lyrics.length - 1] += line[i];
          i++;
        }
      }

      // Construir línea de acordes alineada
      let chordLine = " ".repeat(lyrics[0].length);
      for (let k = 0; k < chords.length; k++) {
        const nextLen = Math.max((lyrics[k+1] || "").length, 1);
        chordLine += chords[k].padEnd(nextLen, " ");
      }

      const lyricText = lyrics.join("");
      html += `<pre><span class="chord-line">${escapeHtml(chordLine)}</span>\n${escapeHtml(lyricText)}</pre>`;
    }

    return html;
  }


  // --------------------------
  // Transposición
  // --------------------------
  function transpose(semitonos) {
    semitonoOffset += semitonos;
    const lista = alabanzaActual.tipo === "seleccionadas" ? seleccionadas : alabanzas;
    const a = lista[alabanzaActual.index];
    const transposed = a.contenido.replace(/\[([A-G][#b]?)([^/\]]*)(?:\/([A-G][#b]?))?\]/g,
      (m, root, suffix, bass) => {
        root = bemoles[root] || root;
        let i = notas.indexOf(root);
        if (i === -1) return m;
        let nuevaRoot = notas[(i + semitonoOffset + 12) % 12];
        if (bass) {
          bass = bemoles[bass] || bass;
          let j = notas.indexOf(bass);
          if (j !== -1) bass = notas[(j + semitonoOffset + 12) % 12];
          return `[${nuevaRoot}${suffix}/${bass}]`;
        }
        return `[${nuevaRoot}${suffix}]`;
      });
    renderAlabanza(transposed);
  }

  function transponerNota(nota, semitonos) {
    nota = bemoles[nota] || nota;
    let i = notas.indexOf(nota);
    if (i === -1) return nota;
    return notas[(i + semitonos + 12) % 12];
  }

  // --------------------------
  // CRUD y JSON
  // --------------------------
  function nuevaAlabanza() {
    alabanzaActual = null;
    document.getElementById("editTitle").value = "";
    document.getElementById("editContent").value = "";
    document.getElementById("editorView").style.display = "block";
    document.getElementById("songView").style.display = "none";
  }

  function editarAlabanza() {
    const lista = alabanzaActual.tipo === "seleccionadas" ? seleccionadas : alabanzas;
    const a = lista[alabanzaActual.index];
    document.getElementById("editTitle").value = a.titulo;
    document.getElementById("editContent").value = a.contenido;
    document.getElementById("editorView").style.display = "block";
    document.getElementById("songView").style.display = "none";
  }

  function guardarAlabanza() {
    const titulo = document.getElementById("editTitle").value.trim();
    const contenido = document.getElementById("editContent").value.trim();
    if (!titulo || !contenido) return alert("Debe ingresar título y contenido.");

    if (alabanzaActual === null)
      alabanzas.push({titulo, contenido});
    else {
      const lista = alabanzaActual.tipo === "seleccionadas" ? seleccionadas : alabanzas;
      lista[alabanzaActual.index] = {titulo, contenido};
    }

    localStorage.setItem("alabanzas", JSON.stringify(alabanzas));
    localStorage.setItem("seleccionadas", JSON.stringify(seleccionadas));
    document.getElementById("editorView").style.display = "none";
    renderListas();
    alert("✅ Alabanza guardada");
  }

  function cancelarEdicion() {
    document.getElementById("editorView").style.display = "none";
  }

  function exportarJSON() {
    const blob = new Blob([JSON.stringify(alabanzas, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alabanzas.json";
    a.click();
    URL.revokeObjectURL(url);
    alert("📤 Archivo exportado.");
  }

  function importarJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error();
        alabanzas = data;
        localStorage.setItem("alabanzas", JSON.stringify(alabanzas));
        renderListas();
        alert("📥 Archivo importado correctamente.");
      } catch {
        alert("❌ Archivo no válido.");
      }
    };
    reader.readAsText(file);
  }