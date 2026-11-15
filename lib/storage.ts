'use client'

import { applyDraft, initialJournal, type Draft, type Journal } from './entries'

const storeName = 'journal'
let opening: Promise<IDBDatabase> | undefined

function database() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('arnold-showcase-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch((error) => {
    opening = undefined
    throw error
  })
  return opening
}

export async function readJournal(): Promise<Journal> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get('current')
    request.onsuccess = () => resolve(request.result ?? initialJournal)
    request.onerror = () => reject(request.error)
  })
}

export async function updateJournal(update: (current: Journal) => Journal) {
  const db = await database()
  return new Promise<Journal>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.get('current')
    let next: Journal
    request.onsuccess = () => {
      try {
        next = update(request.result ?? initialJournal)
        store.put(next, 'current')
      } catch (error) {
        reject(error)
        tx.abort()
      }
    }
    tx.oncomplete = () => resolve(next)
    tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted.'))
  })
}

export function saveDraft(id: string, drafts: Draft[]) {
  return updateJournal((journal) => applyDraft(journal, id, drafts, new Date().toISOString()))
}
