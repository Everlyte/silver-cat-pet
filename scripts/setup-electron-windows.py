"""Install pinned official Electron via GitHub's asset API, verifying SHA-256."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected and urllib.parse.urlparse(req.full_url).netloc != urllib.parse.urlparse(newurl).netloc:
            redirected.remove_header('Authorization')
        return redirected


OPENER = urllib.request.build_opener(SafeRedirect)
ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['devDependencies']['electron']
TOKEN = os.environ.get('GH_TOKEN')


def download(url, destination, binary=False):
    headers = {'User-Agent': 'silver-cat-pet-builder', 'Accept': 'application/octet-stream' if binary else 'application/vnd.github+json'}
    if TOKEN:
        headers['Authorization'] = 'Bearer ' + TOKEN
    for attempt in range(3):
        try:
            with OPENER.open(urllib.request.Request(url, headers=headers), timeout=120) as response, destination.open('wb') as output:
                shutil.copyfileobj(response, output)
            return
        except Exception as error:
            if attempt == 2:
                raise
            print(f'Download retry {attempt + 1}: {type(error).__name__}', flush=True)
            time.sleep(3 * (attempt + 1))


def main():
    archive_name = f'electron-v{VERSION}-win32-x64.zip'
    with tempfile.TemporaryDirectory(prefix='silver-cat-electron-') as temporary:
        temp = Path(temporary)
        metadata = temp / 'release.json'
        download(f'https://api.github.com/repos/electron/electron/releases/tags/v{VERSION}', metadata)
        assets = {a['name']: a for a in json.loads(metadata.read_text(encoding='utf-8'))['assets']}
        archive, sums = temp / archive_name, temp / 'SHASUMS256.txt'
        download(assets[archive_name]['url'], archive, binary=True)
        download(assets['SHASUMS256.txt']['url'], sums, binary=True)
        checksums = {}
        for line in sums.read_text(encoding='utf-8').splitlines():
            digest, name = line.split(maxsplit=1)
            checksums[name.lstrip('*')] = digest
        with archive.open('rb') as stream:
            actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        if actual != checksums.get(archive_name):
            raise RuntimeError('Official Electron SHA-256 mismatch')
        print(f'Official Electron verified: {archive_name} sha256:{actual}', flush=True)
        destination = ROOT / 'node_modules' / 'electron' / 'dist'
        destination.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as bundle:
            for entry in bundle.infolist():
                path = PurePosixPath(entry.filename)
                if path.is_absolute() or '..' in path.parts or '\\' in entry.filename or ':' in entry.filename:
                    raise RuntimeError('Unsafe archive member')
            bundle.extractall(destination)
        if (destination / 'version').read_text(encoding='utf-8').strip() != VERSION:
            raise RuntimeError('Extracted Electron version mismatch')
        (destination.parent / 'path.txt').write_text('electron.exe', encoding='utf-8')
        print('Windows Electron distribution ready', flush=True)


if __name__ == '__main__':
    main()
