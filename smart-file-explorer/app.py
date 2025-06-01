from flask import Flask, render_template, request, jsonify
import os
import shutil
import re
from datetime import datetime

app = Flask(__name__)
BASE_DIR = os.path.join(os.getcwd(), "explorer_files")
os.makedirs(BASE_DIR, exist_ok=True)

def categorize_file(filename):
    ext = filename.split('.')[-1].lower()
    if ext in ['jpg', 'jpeg', 'png', 'gif']:
        return 'Images'
    elif ext in ['mp4', 'mkv', 'avi']:
        return 'Videos'
    elif ext in ['pdf', 'doc', 'docx', 'txt']:
        return 'Documents'
    else:
        return 'Others'

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/list', methods=['GET'])
def list_files():
    category = request.args.get('category')
    files = []
    try:
        for entry in os.scandir(BASE_DIR):
            file_category = "Folder" if entry.is_dir() else categorize_file(entry.name)
            if category and file_category != category:
                continue
            files.append({
                'name': entry.name,
                'is_dir': entry.is_dir(),
                'size': entry.stat().st_size,
                'modified': datetime.fromtimestamp(entry.stat().st_mtime).isoformat(),
                'category': file_category
            })
        return jsonify({'files': files, 'path': BASE_DIR})
    except Exception as e:
        return jsonify({'error': str(e)})

def parse_size(size_str):
    size_str = size_str.strip().upper()
    size_units = {'B': 1, 'KB': 1024, 'MB': 1024**2, 'GB': 1024**3}
    match = re.match(r'(\d+)(B|KB|MB|GB)?', size_str)
    if match:
        num, unit = match.groups()
        return int(num) * size_units.get(unit or 'B', 1)
    return None

@app.route('/search', methods=['GET'])
def search_files():
    query = request.args.get('q', '').lower()
    filter_type = request.args.get('filter', 'name')
    results = []

    for root, dirs, files in os.walk(BASE_DIR):
        for file in files:
            full_path = os.path.join(root, file)
            stat = os.stat(full_path)
            modified = datetime.fromtimestamp(stat.st_mtime).isoformat()
            category = categorize_file(file)
            size = stat.st_size

            match = False
            if filter_type == "name" and query in file.lower():
                match = True
            elif filter_type == "type" and file.lower().endswith(query):
                match = True
            elif filter_type == "date" and query in modified:
                match = True
            elif filter_type == "size":
                try:
                    if '-' in query:
                        min_str, max_str = query.split('-')
                        min_size = parse_size(min_str)
                        max_size = parse_size(max_str)
                        match = min_size <= size <= max_size
                    else:
                        min_size = parse_size(query)
                        match = min_size <= size
                except:
                    match = False
            if match:
                results.append({
                    'name': file,
                    'path': root,
                    'size': size,
                    'modified': modified,
                    'category': category,
                    'is_dir': False
                })
    return jsonify(results)

@app.route('/operate', methods=['POST'])
def file_operation():
    data = request.json
    src = os.path.normpath(data.get('src'))
    dest = os.path.normpath(data.get('dest')) if data.get('dest') else None
    op = data.get('operation')

    if not src.startswith(BASE_DIR) or (dest and not dest.startswith(BASE_DIR)):
        return jsonify({'error': 'Unauthorized path access'}), 400
    try:
        if op == 'copy':
            shutil.copy2(src, dest)
        elif op == 'move':
            shutil.move(src, dest)
        elif op == 'rename':
            if not dest:
                return jsonify({'error': 'Missing new filename'}), 400
            os.rename(src, dest)
        elif op == 'delete':
            if os.path.isdir(src):
                shutil.rmtree(src)
            elif os.path.isfile(src):
                os.remove(src)
            else:
                return jsonify({'error': 'File or folder not found'}), 404
        else:
            return jsonify({'error': 'Invalid operation'}), 400

        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    try:
        save_path = os.path.join(BASE_DIR, file.filename)
        file.save(save_path)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
