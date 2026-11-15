'use client'

import { useEffect, useState } from 'react'
import { initialJournal, type Journal } from './entries'
import { readJournal } from './storage'

export function useJournal() {
  const [journal, setJournal] = useState<Journal>(initialJournal)
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  useEffect(() => {
    let active = true
    readJournal().then((value) => {
      if (active) {
        setJournal(value)
        setReady(true)
      }
    }).catch(() => {
      if (active) setStorageError('Browser storage is unavailable. Allow it to save entries.')
    })
    return () => { active = false }
  }, [])
  return { journal, setJournal, ready, storageError }
}
