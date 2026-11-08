"""Install pinned official Electron via GitHub's asset API, verifying SHA-256."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
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
        # Match the pinned electron-builder 26.18.0 legacy NSIS toolset hashes.
        # Pre-fetch both bundles through the same official asset API.
        sevenzip = shutil.which('7z') or str(Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / '7-Zip' / '7z.exe')
        if not Path(sevenzip).is_file():
            raise RuntimeError('7-Zip is required to unpack verified NSIS bundles')
        bundles = [
            ('nsis-3.0.4.1', '9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa', 'ELECTRON_BUILDER_NSIS_DIR'),
            ('nsis-resources-3.4.1', '593a9a92ef958321293ac6a2ee61e64bf1bd543142a5bd6b3d310709cc924103', 'ELECTRON_BUILDER_NSIS_RESOURCES_DIR'),
        ]
        for tag, expected, env_name in bundles:
            metadata = temp / (tag + '.json')
            download(f'https://api.github.com/repos/electron-userland/electron-builder-binaries/releases/tags/{tag}', metadata)
            filename = tag + '.7z'
            asset = next(a for a in json.loads(metadata.read_text(encoding='utf-8'))['assets'] if a['name'] == filename)
            archive = temp / filename
            download(asset['url'], archive, binary=True)
            with archive.open('rb') as stream:
                actual = hashlib.file_digest(stream, 'sha256').hexdigest()
            if actual != expected:
                raise RuntimeError('Official NSIS SHA-256 mismatch: ' + filename)
            destination = ROOT / 'node_modules' / '.silver-cat-tools' / tag
            destination.mkdir(parents=True, exist_ok=True)
            subprocess.run([sevenzip, 'x', str(archive), '-o' + str(destination), '-y'], check=True, stdout=subprocess.DEVNULL)
            if os.environ.get('GITHUB_ENV'):
                with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as environment:
                    environment.write(f'{env_name}={destination}\n')
            print(f'Official toolset verified: {filename} sha256:{actual}', flush=True)


if __name__ == '__main__':
    main()
