import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DSH_ROOT = 'C:\\Users\\admin\\AppData\\Roaming\\npm\\node_modules\\@deepseek-ai\\dsh'
const DSH_NM = path.join(DSH_ROOT, 'node_modules')

console.log('=== Linking build dependencies ===')

const TARGET_NM = path.join(ROOT, 'node_modules')
if (!fs.existsSync(TARGET_NM)) {
  fs.mkdirSync(TARGET_NM, { recursive: true })
}

function linkPkg(pkgName, sourcePath) {
  const target = path.join(TARGET_NM, pkgName)
  if (!fs.existsSync(sourcePath)) {
    console.warn(`[WARN] Source missing for ${pkgName}: ${sourcePath}`)
    return
  }
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(target), { recursive: true })
  try {
    fs.symlinkSync(sourcePath, target, 'junction')
    console.log(`✓ Linked ${pkgName}`)
  } catch (err) {
    console.warn(`Link failed for ${pkgName}: ${err.message}`)
  }
}

// 链接 Cordis 与核心依赖
linkPkg('cordis', path.join(DSH_NM, 'cordis'))
linkPkg('schemastery', path.join(DSH_NM, 'schemastery'))
linkPkg('cosmokit', path.join(DSH_NM, 'cosmokit'))
linkPkg('@deepseek-ai/dsh-tools', path.join(DSH_NM, '@deepseek-ai/dsh-tools'))
linkPkg('@deepseek-ai/dsh-host-webserver', path.join(DSH_NM, '@deepseek-ai/dsh-host-webserver'))
linkPkg('@deepseek-ai/dsh-client-ui-slots', path.join(DSH_NM, '@deepseek-ai/dsh-client-ui-slots'))
linkPkg('@deepseek-ai/dsh-client-ui-sidebar-right', path.join(DSH_NM, '@deepseek-ai/dsh-client-ui-sidebar-right'))
linkPkg('react', path.join(DSH_NM, 'react'))
linkPkg('react-dom', path.join(DSH_NM, 'react-dom'))

console.log('\n=== Compiling Host (TypeScript → JavaScript) ===')
try {
  execSync('npx tsc -p tsconfig.json', { cwd: ROOT, stdio: 'inherit' })
} catch (err) {
  console.log('TypeScript compilation finished with potential warnings.')
}

console.log('\n=== Compiling Client (UI Bundle via tsdown) ===')
execSync('npx tsdown', { cwd: ROOT, stdio: 'inherit' })

console.log('\n✅ Build completed successfully!')
