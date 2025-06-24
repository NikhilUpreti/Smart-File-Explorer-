document.addEventListener('DOMContentLoaded', () => {
  loadFiles();

  document.getElementById('searchBtn').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value;
    const filter = document.getElementById('searchFilter').value;
    fetch(`/search?q=${encodeURIComponent(query)}&filter=${filter}`)
      .then(res => res.json())
      .then(displayFiles);
  });

  document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);

    fetch('/upload', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(res => {
      if (res.status === 'success') {
        alert('File uploaded successfully!');
        loadFiles();
      } else {
        alert('Upload failed: ' + res.error);
      }
    });
  });
});

function loadFiles(category = "") {
  const url = category ? `/list?category=${category}` : '/list';
  fetch(url)
    .then(res => res.json())
    .then(displayFiles);
}

function displayFiles(data) {
  const container = document.getElementById('fileList');
  container.innerHTML = '';

  const files = data.files || data;
  files.forEach(file => {
    const fullPath = `${data.path}\\${file.name}`;
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <button class="favorite-star ${file.is_favorite ? 'active' : ''}" 
        onclick="toggleFavorite('${fullPath.replace(/\\/g, '\\\\')}', this)">
      ${file.is_favorite ? '⭐' : '☆'}
      </button>
      <input type="checkbox" class="fav-checkbox" data-path="${fullPath.replace(/\\/g, '\\\\')}" style="margin-bottom: 5px;" />
      <p><strong>${file.is_dir ? '📁' : '📄'} ${file.name}</strong></p>

      <p>${(file.size / 1024).toFixed(1)} KB · Modified: ${new Date(file.modified).toLocaleDateString()}</p>
      <div style="margin-top: 10px;">
        <button onclick="previewFile('${fullPath.replace(/\\/g, '\\\\')}')">Preview</button>
        <button onclick="renameFile('${fullPath.replace(/\\/g, '\\\\')}')">Rename</button>
        <button onclick="deleteFile('${fullPath.replace(/\\/g, '\\\\')}')">Delete</button>
        
      </div>
    `;
    container.appendChild(card);
  });
}

function loadFavorites() {
  fetch('/favorites')
    .then(res => res.json())
    .then(data => {
      displayFiles({ files: data, path: "" });
    });
}

function toggleFavorite(path, button) {
  fetch('/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  }).then(res => res.json())
    .then(res => {
      if (res.status === 'success') {
        button.classList.toggle('active', res.is_favorite);
        button.textContent = res.is_favorite ? '⭐' : '☆';
      }
    });
}
function markSelectedFavorites() {
  const checkboxes = document.querySelectorAll('.fav-checkbox:checked');
  if (checkboxes.length === 0) {
    alert("Please select at least one file.");
    return;
  }
  checkboxes.forEach(box => {
    const path = box.dataset.path;
    fetch('/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    }).then(res => res.json())
      .then(res => {
        if (res.status === 'success') {
          box.checked = false; // uncheck after action
        }
      });
  });

  alert("Selected files marked as favorite.");
  loadFiles(currentCategory === 'all' ? '' : currentCategory);
}

function previewFile(path) {
  fetch('/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  })
  .then(res => res.json())
  .then(res => {
    if (res.status === 'success') {
      window.open(res.url, '_blank');
    } else {
      alert("Preview failed: " + res.error);
    }
  });
}

function renameFile(path) {
  const newName = prompt("Enter new file name:");
  if (!newName) return;
  const dest = path.substring(0, path.lastIndexOf("\\")) + "\\" + newName;

  fetch('/operate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'rename', src: path, dest })
  }).then(res => res.json())
    .then(res => {
      if (res.status === 'success') loadFiles();
      else alert('Rename failed: ' + res.error);
    });
}

function deleteFile(path) {
  if (!confirm("Are you sure you want to delete this file?")) return;

  fetch('/operate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'delete', src: path })
  }).then(res => res.json())
    .then(res => {
      if (res.status === 'success') loadFiles();
      else alert('Delete failed: ' + res.error);
    });
}
