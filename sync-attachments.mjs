#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// sync-attachments.mjs
//
// Copia para content/Postagens/attachments/ SOMENTE as mídias que você
// realmente usou (referenciou) dentro dos posts — buscando na pasta Material/
// do vault. Nunca apaga nada, nunca copia o Material inteiro.
//
// Ou seja: o Material/ continua PRIVADO. Só a imagem que você embutir num post
// público é que vira pública. Rode isto antes de publicar (o Publicar Blog.bat
// já faz isso pra você).
// ─────────────────────────────────────────────────────────────────────────────

import {
  readdirSync, statSync, readFileSync, copyFileSync, existsSync, mkdirSync,
} from "node:fs"
import { join, extname, basename, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SITE_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)))
const POSTS_DIR = join(SITE_ROOT, "content", "Postagens")
const ATTACH_DIR = join(POSTS_DIR, "attachments")
const MATERIAL_DIR = resolve(SITE_ROOT, "..", "Material") // .../Mind-Palace/Material

const MEDIA_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp",
  ".mp4", ".webm", ".mov", ".mp3", ".ogg",
])

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

// Índice do Material por nome-de-arquivo -> caminho completo
const materialIndex = new Map()
for (const f of walk(MATERIAL_DIR)) {
  const b = basename(f)
  if (!materialIndex.has(b)) materialIndex.set(b, f)
}

// Coleta as referências de mídia dentro dos posts
const mdFiles = walk(POSTS_DIR).filter((f) => extname(f).toLowerCase() === ".md")
const refs = new Set()
const embedRe = /!\[\[([^\]|#]+?)(?:[|#][^\]]*)?\]\]|!\[[^\]]*\]\(([^)]+?)\)/g
for (const md of mdFiles) {
  const txt = readFileSync(md, "utf8")
  let m
  while ((m = embedRe.exec(txt)) !== null) {
    let raw = (m[1] || m[2] || "").trim()
    if (!raw || /^https?:\/\//i.test(raw)) continue // ignora links externos
    raw = raw.split(/[?#]/)[0].split(/\s+/)[0]
    let name
    try { name = basename(decodeURIComponent(raw)) } catch { name = basename(raw) }
    if (MEDIA_EXT.has(extname(name).toLowerCase())) refs.add(name)
  }
}

if (!existsSync(ATTACH_DIR)) mkdirSync(ATTACH_DIR, { recursive: true })

let copied = 0
const missing = []
for (const name of refs) {
  const dest = join(ATTACH_DIR, name)
  if (existsSync(dest)) continue // já está na pasta pública
  const src = materialIndex.get(name)
  if (src) {
    copyFileSync(src, dest)
    copied++
    console.log("  + copiada:", name)
  } else {
    missing.push(name)
  }
}

const already = refs.size - copied - missing.length
console.log(
  `\n  Mídias usadas nos posts: ${refs.size} | copiadas agora: ${copied} | já presentes: ${already}`,
)
if (missing.length) {
  console.log("\n  ⚠ Não achei estas mídias (nem em attachments/, nem em Material/):")
  for (const n of missing) console.log("     -", n)
  console.log("  (confere o nome do arquivo no post)")
}
