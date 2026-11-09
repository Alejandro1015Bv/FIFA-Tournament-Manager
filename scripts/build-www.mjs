// Copia SOLO los archivos de la app a www/ (carpeta webDir de Capacitor). Sin tests ni documentos.
import { cpSync, rmSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'css', 'js', 'data', 'assets']) {
  const src = join(root, item);
  if (!existsSync(src)) throw new Error(`Falta ${item}`);
  cpSync(src, join(out, item), { recursive: true });
}
if (!statSync(join(out, 'index.html')).isFile()) throw new Error('www/index.html no existe');
console.log('www/ listo');
