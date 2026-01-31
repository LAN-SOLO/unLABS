'use client'

import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type ReactNode } from 'react'
import type { FilesystemActions } from '@/lib/terminal/types'

interface MCProps {
  filesystemActions: FilesystemActions
  onExit: () => void
  initialEditFile?: string  // If set, open editor immediately on this file
}

interface MCEntry {
  name: string
  size: number
  type: string // 'dir' | 'file' | 'link'
  display: string
}

type DialogMode =
  | null
  | { type: 'mkdir'; value: string }
  | { type: 'confirm-delete'; path: string; name: string }
  | { type: 'copy'; src: string; dest: string; value: string }
  | { type: 'move'; src: string; dest: string; value: string }
  | { type: 'view'; path: string; lines: string[]; scroll: number }
  | { type: 'edit'; path: string; lines: string[]; cursorRow: number; cursorCol: number; scroll: number; modified: boolean; confirmQuit: boolean }

const DEFAULT_PANE_WIDTH = 35
const CHAR_WIDTH = 6.02 // approximate monospace character width in px at text-[10px]

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, len)
  return s + ' '.repeat(len - s.length)
}

function truncate(s: string, len: number): string {
  if (s.length <= len) return s
  return s.slice(0, len - 1) + '~'
}

function formatSize(size: number): string {
  if (size < 1024) return `${size}`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)}K`
  return `${(size / (1024 * 1024)).toFixed(1)}M`
}

function getEntries(fs: FilesystemActions, path: string): MCEntry[] {
  try {
    const raw = fs.ls(path, { all: false })
    const entries: MCEntry[] = []
    for (const name of raw) {
      const isDir = name.endsWith('/')
      const cleanName = name.replace(/\/$/, '')
      const fullPath = path === '/' ? `/${cleanName}` : `${path}/${cleanName}`
      const info = fs.stat(fullPath)
      entries.push({
        name: cleanName,
        size: info?.size ?? 0,
        type: isDir ? 'dir' : (info?.type === 'link' ? 'link' : 'file'),
        display: isDir ? `${cleanName}/` : cleanName,
      })
    }
    // Sort: dirs first, then files, alphabetically
    entries.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1
      if (a.type !== 'dir' && b.type === 'dir') return 1
      return a.name.localeCompare(b.name)
    })
    // Add parent dir entry
    entries.unshift({ name: '..', size: 0, type: 'dir', display: '/..' })
    return entries
  } catch {
    return [{ name: '..', size: 0, type: 'dir', display: '/..' }]
  }
}

export function MidnightCommander({ filesystemActions: fs, onExit, initialEditFile }: MCProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftPath, setLeftPath] = useState(() => {
    try {
      const saved = localStorage.getItem('unlabs_unmc_state')
      if (saved) return JSON.parse(saved).left || fs.getCwd()
    } catch { /* ignore */ }
    return fs.getCwd()
  })
  const [rightPath, setRightPath] = useState(() => {
    try {
      const saved = localStorage.getItem('unlabs_unmc_state')
      if (saved) return JSON.parse(saved).right || '/'
    } catch { /* ignore */ }
    return '/'
  })
  const [activePane, setActivePane] = useState<'left' | 'right'>('left')
  const [cursorLeft, setCursorLeft] = useState(0)
  const [cursorRight, setCursorRight] = useState(0)
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [visibleRows, setVisibleRows] = useState(20)
  const [paneWidth, setPaneWidth] = useState(DEFAULT_PANE_WIDTH)
  const PANE_WIDTH = paneWidth
  const TOTAL_WIDTH = PANE_WIDTH * 2 + 2

  const leftEntries = getEntries(fs, leftPath)
  const rightEntries = getEntries(fs, rightPath)

  // Save pane state
  useEffect(() => {
    try {
      localStorage.setItem('unlabs_unmc_state', JSON.stringify({ left: leftPath, right: rightPath }))
    } catch { /* ignore */ }
  }, [leftPath, rightPath])

  // Focus on mount
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  // Calculate visible rows based on container height
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const lineH = 12 // ~10px font + leading
      const chrome = 5 // header + footer rows
      const rows = Math.max(5, Math.floor(el.clientHeight / lineH) - chrome)
      setVisibleRows(rows)
      // Compute pane width from container width: totalWidth = paneWidth * 2 + 2 (borders)
      const totalCols = Math.floor(el.clientWidth / CHAR_WIDTH)
      const pw = Math.max(20, Math.floor((totalCols - 2) / 2))
      setPaneWidth(pw)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Helper to open a file in the editor
  const openEditor = useCallback((filePath: string) => {
    const content = fs.cat(filePath, 'operator', ['operator'])
    const lines = content !== null ? content.split('\n') : ['']
    setDialog({ type: 'edit', path: filePath, lines, cursorRow: 0, cursorCol: 0, scroll: 0, modified: false, confirmQuit: false })
  }, [fs])

  // Open initial edit file if provided (unmcedit command)
  const initialEditDone = useRef(false)
  useEffect(() => {
    if (initialEditFile && !initialEditDone.current) {
      initialEditDone.current = true
      openEditor(initialEditFile)
    }
  }, [initialEditFile, openEditor])

  const getActivePath = () => activePane === 'left' ? leftPath : rightPath
  const getActiveEntries = () => activePane === 'left' ? leftEntries : rightEntries
  const getActiveCursor = () => activePane === 'left' ? cursorLeft : cursorRight
  const setActiveCursor = (v: number | ((prev: number) => number)) => {
    if (activePane === 'left') setCursorLeft(v)
    else setCursorRight(v)
  }
  const setActivePath = (p: string) => {
    if (activePane === 'left') setLeftPath(p)
    else setRightPath(p)
  }
  const getOtherPath = () => activePane === 'left' ? rightPath : leftPath

  const navigateTo = useCallback((path: string) => {
    setActivePath(path)
    setActiveCursor(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePane])

  const handleEnter = useCallback(() => {
    const entries = getActiveEntries()
    const cursor = getActiveCursor()
    const entry = entries[cursor]
    if (!entry) return

    if (entry.type === 'dir') {
      const currentPath = getActivePath()
      if (entry.name === '..') {
        // Go to parent
        const parent = currentPath === '/' ? '/' : currentPath.replace(/\/[^/]+$/, '') || '/'
        navigateTo(parent)
      } else {
        const newPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`
        navigateTo(newPath)
      }
    } else {
      // View file
      const currentPath = getActivePath()
      const fullPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`
      const content = fs.cat(fullPath, 'operator', ['operator'])
      if (content !== null) {
        setDialog({ type: 'view', path: fullPath, lines: content.split('\n'), scroll: 0 })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePane, leftPath, rightPath, leftEntries, rightEntries, cursorLeft, cursorRight, fs])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Dialog mode keyboard handling
    if (dialog) {
      if (dialog.type === 'view') {
        if (e.key === 'Escape' || e.key === 'q' || e.key === 'F10') {
          setDialog(null)
        } else if (e.key === 'ArrowDown' || e.key === 'j') {
          setDialog({ ...dialog, scroll: Math.min(dialog.scroll + 1, Math.max(0, dialog.lines.length - visibleRows)) })
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          setDialog({ ...dialog, scroll: Math.max(0, dialog.scroll - 1) })
        } else if (e.key === 'PageDown' || e.key === ' ') {
          setDialog({ ...dialog, scroll: Math.min(dialog.scroll + visibleRows, Math.max(0, dialog.lines.length - visibleRows)) })
        } else if (e.key === 'PageUp') {
          setDialog({ ...dialog, scroll: Math.max(0, dialog.scroll - visibleRows) })
        } else if (e.key === 'Home') {
          setDialog({ ...dialog, scroll: 0 })
        } else if (e.key === 'End') {
          setDialog({ ...dialog, scroll: Math.max(0, dialog.lines.length - visibleRows) })
        }
        return
      }
      if (dialog.type === 'edit') {
        const { lines, cursorRow, cursorCol, scroll, modified, path } = dialog
        const editRows = visibleRows + 2 // same as view

        // Confirm quit dialog
        if (dialog.confirmQuit) {
          if (e.key === 'y' || e.key === 'Y') {
            // Save and quit
            fs.write(path, lines.join('\n'))
            if (initialEditFile) { onExit(); return }
            setDialog(null)
          } else if (e.key === 'n' || e.key === 'N') {
            // Quit without saving
            if (initialEditFile) { onExit(); return }
            setDialog(null)
          } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
            // Cancel — go back to editing
            setDialog({ ...dialog, confirmQuit: false })
          }
          return
        }

        // Save: Ctrl+S or F2
        if ((e.ctrlKey && e.key === 's') || e.key === 'F2') {
          fs.write(path, lines.join('\n'))
          setDialog({ ...dialog, modified: false })
          return
        }

        // Quit: Escape or F10
        if (e.key === 'Escape' || e.key === 'F10') {
          if (modified) {
            setDialog({ ...dialog, confirmQuit: true })
          } else {
            if (initialEditFile) { onExit(); return }
            setDialog(null)
          }
          return
        }

        // Navigation
        if (e.key === 'ArrowUp') {
          if (cursorRow > 0) {
            const newRow = cursorRow - 1
            const newCol = Math.min(cursorCol, lines[newRow].length)
            const newScroll = newRow < scroll ? newRow : scroll
            setDialog({ ...dialog, cursorRow: newRow, cursorCol: newCol, scroll: newScroll })
          }
          return
        }
        if (e.key === 'ArrowDown') {
          if (cursorRow < lines.length - 1) {
            const newRow = cursorRow + 1
            const newCol = Math.min(cursorCol, lines[newRow].length)
            const newScroll = newRow >= scroll + editRows ? scroll + 1 : scroll
            setDialog({ ...dialog, cursorRow: newRow, cursorCol: newCol, scroll: newScroll })
          }
          return
        }
        if (e.key === 'ArrowLeft') {
          if (cursorCol > 0) {
            setDialog({ ...dialog, cursorCol: cursorCol - 1 })
          } else if (cursorRow > 0) {
            setDialog({ ...dialog, cursorRow: cursorRow - 1, cursorCol: lines[cursorRow - 1].length })
          }
          return
        }
        if (e.key === 'ArrowRight') {
          if (cursorCol < lines[cursorRow].length) {
            setDialog({ ...dialog, cursorCol: cursorCol + 1 })
          } else if (cursorRow < lines.length - 1) {
            setDialog({ ...dialog, cursorRow: cursorRow + 1, cursorCol: 0 })
          }
          return
        }
        if (e.key === 'Home') {
          setDialog({ ...dialog, cursorCol: 0 })
          return
        }
        if (e.key === 'End') {
          setDialog({ ...dialog, cursorCol: lines[cursorRow].length })
          return
        }
        if (e.key === 'PageUp') {
          const newRow = Math.max(0, cursorRow - editRows)
          const newScroll = Math.max(0, scroll - editRows)
          setDialog({ ...dialog, cursorRow: newRow, cursorCol: Math.min(cursorCol, lines[newRow].length), scroll: newScroll })
          return
        }
        if (e.key === 'PageDown') {
          const newRow = Math.min(lines.length - 1, cursorRow + editRows)
          const newScroll = Math.min(Math.max(0, lines.length - editRows), scroll + editRows)
          setDialog({ ...dialog, cursorRow: newRow, cursorCol: Math.min(cursorCol, lines[newRow].length), scroll: newScroll })
          return
        }

        // Editing
        if (e.key === 'Enter') {
          const newLines = [...lines]
          const before = newLines[cursorRow].slice(0, cursorCol)
          const after = newLines[cursorRow].slice(cursorCol)
          newLines.splice(cursorRow, 1, before, after)
          const newRow = cursorRow + 1
          const newScroll = newRow >= scroll + editRows ? scroll + 1 : scroll
          setDialog({ ...dialog, lines: newLines, cursorRow: newRow, cursorCol: 0, scroll: newScroll, modified: true })
          return
        }
        if (e.key === 'Backspace') {
          if (cursorCol > 0) {
            const newLines = [...lines]
            newLines[cursorRow] = newLines[cursorRow].slice(0, cursorCol - 1) + newLines[cursorRow].slice(cursorCol)
            setDialog({ ...dialog, lines: newLines, cursorCol: cursorCol - 1, modified: true })
          } else if (cursorRow > 0) {
            const newLines = [...lines]
            const prevLen = newLines[cursorRow - 1].length
            newLines[cursorRow - 1] += newLines[cursorRow]
            newLines.splice(cursorRow, 1)
            const newRow = cursorRow - 1
            const newScroll = newRow < scroll ? newRow : scroll
            setDialog({ ...dialog, lines: newLines, cursorRow: newRow, cursorCol: prevLen, scroll: newScroll, modified: true })
          }
          return
        }
        if (e.key === 'Delete') {
          if (cursorCol < lines[cursorRow].length) {
            const newLines = [...lines]
            newLines[cursorRow] = newLines[cursorRow].slice(0, cursorCol) + newLines[cursorRow].slice(cursorCol + 1)
            setDialog({ ...dialog, lines: newLines, modified: true })
          } else if (cursorRow < lines.length - 1) {
            const newLines = [...lines]
            newLines[cursorRow] += newLines[cursorRow + 1]
            newLines.splice(cursorRow + 1, 1)
            setDialog({ ...dialog, lines: newLines, modified: true })
          }
          return
        }
        if (e.key === 'Tab') {
          const newLines = [...lines]
          newLines[cursorRow] = newLines[cursorRow].slice(0, cursorCol) + '  ' + newLines[cursorRow].slice(cursorCol)
          setDialog({ ...dialog, lines: newLines, cursorCol: cursorCol + 2, modified: true })
          return
        }

        // Regular character input
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const newLines = [...lines]
          newLines[cursorRow] = newLines[cursorRow].slice(0, cursorCol) + e.key + newLines[cursorRow].slice(cursorCol)
          setDialog({ ...dialog, lines: newLines, cursorCol: cursorCol + 1, modified: true })
          return
        }
        return
      }
      if (dialog.type === 'mkdir') {
        if (e.key === 'Escape') {
          setDialog(null)
        } else if (e.key === 'Enter') {
          if (dialog.value.trim()) {
            const base = getActivePath()
            const newPath = base === '/' ? `/${dialog.value.trim()}` : `${base}/${dialog.value.trim()}`
            fs.mkdir(newPath, true)
          }
          setDialog(null)
        } else if (e.key === 'Backspace') {
          setDialog({ ...dialog, value: dialog.value.slice(0, -1) })
        } else if (e.key.length === 1) {
          setDialog({ ...dialog, value: dialog.value + e.key })
        }
        return
      }
      if (dialog.type === 'confirm-delete') {
        if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
          fs.rm(dialog.path, true)
          setDialog(null)
        } else {
          setDialog(null)
        }
        return
      }
      if (dialog.type === 'copy') {
        if (e.key === 'Escape') {
          setDialog(null)
        } else if (e.key === 'Enter') {
          const dest = dialog.value.trim() || dialog.dest
          fs.cp(dialog.src, dest, true)
          setDialog(null)
        } else if (e.key === 'Backspace') {
          setDialog({ ...dialog, value: dialog.value.slice(0, -1) })
        } else if (e.key.length === 1) {
          setDialog({ ...dialog, value: dialog.value + e.key })
        }
        return
      }
      if (dialog.type === 'move') {
        if (e.key === 'Escape') {
          setDialog(null)
        } else if (e.key === 'Enter') {
          const dest = dialog.value.trim() || dialog.dest
          fs.mv(dialog.src, dest)
          setDialog(null)
        } else if (e.key === 'Backspace') {
          setDialog({ ...dialog, value: dialog.value.slice(0, -1) })
        } else if (e.key.length === 1) {
          setDialog({ ...dialog, value: dialog.value + e.key })
        }
        return
      }
      return
    }

    // Main MC keyboard handling
    const entries = getActiveEntries()
    const cursor = getActiveCursor()

    switch (e.key) {
      case 'ArrowUp':
        setActiveCursor((c: number) => Math.max(0, c - 1))
        break
      case 'ArrowDown':
        setActiveCursor((c: number) => Math.min(entries.length - 1, c + 1))
        break
      case 'PageUp':
        setActiveCursor((c: number) => Math.max(0, c - visibleRows))
        break
      case 'PageDown':
        setActiveCursor((c: number) => Math.min(entries.length - 1, c + visibleRows))
        break
      case 'Home':
        setActiveCursor(0)
        break
      case 'End':
        setActiveCursor(entries.length - 1)
        break
      case 'Tab':
        setActivePane(p => p === 'left' ? 'right' : 'left')
        break
      case 'Enter':
        handleEnter()
        break
      case 'Backspace': {
        const currentPath = getActivePath()
        const parent = currentPath === '/' ? '/' : currentPath.replace(/\/[^/]+$/, '') || '/'
        navigateTo(parent)
        break
      }
      case 'F3': {
        // View
        const entry = entries[cursor]
        if (entry && entry.type !== 'dir') {
          const base = getActivePath()
          const fullPath = base === '/' ? `/${entry.name}` : `${base}/${entry.name}`
          const content = fs.cat(fullPath, 'operator', ['operator'])
          if (content !== null) {
            setDialog({ type: 'view', path: fullPath, lines: content.split('\n'), scroll: 0 })
          }
        }
        break
      }
      case 'F4': {
        // Edit
        const entry = entries[cursor]
        if (entry && entry.type !== 'dir') {
          const base = getActivePath()
          const fullPath = base === '/' ? `/${entry.name}` : `${base}/${entry.name}`
          openEditor(fullPath)
        }
        break
      }
      case 'F5': {
        // Copy
        const entry = entries[cursor]
        if (entry && entry.name !== '..') {
          const base = getActivePath()
          const src = base === '/' ? `/${entry.name}` : `${base}/${entry.name}`
          const otherBase = getOtherPath()
          const dest = otherBase === '/' ? `/${entry.name}` : `${otherBase}/${entry.name}`
          setDialog({ type: 'copy', src, dest, value: dest })
        }
        break
      }
      case 'F6': {
        // Move/Rename
        const entry = entries[cursor]
        if (entry && entry.name !== '..') {
          const base = getActivePath()
          const src = base === '/' ? `/${entry.name}` : `${base}/${entry.name}`
          const otherBase = getOtherPath()
          const dest = otherBase === '/' ? `/${entry.name}` : `${otherBase}/${entry.name}`
          setDialog({ type: 'move', src, dest, value: dest })
        }
        break
      }
      case 'F7':
        setDialog({ type: 'mkdir', value: '' })
        break
      case 'F8': {
        // Delete
        const entry = entries[cursor]
        if (entry && entry.name !== '..') {
          const base = getActivePath()
          const fullPath = base === '/' ? `/${entry.name}` : `${base}/${entry.name}`
          setDialog({ type: 'confirm-delete', path: fullPath, name: entry.name })
        }
        break
      }
      case 'F10':
      case 'Escape':
        onExit()
        break
      default:
        break
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, activePane, leftPath, rightPath, leftEntries, rightEntries, cursorLeft, cursorRight, fs, onExit, visibleRows, handleEnter, navigateTo, openEditor, initialEditFile])

  // Render a single pane column
  const renderPane = (entries: MCEntry[], path: string, cursor: number, isActive: boolean, side: 'left' | 'right') => {
    const nameW = PANE_WIDTH - 12 // name column
    const sizeW = 5
    const typeW = 4

    // Scrolling: keep cursor visible
    const scrollOffset = Math.max(0, cursor - visibleRows + 1)
    const visible = entries.slice(scrollOffset, scrollOffset + visibleRows)

    const rows: { text: string; highlighted: boolean }[] = []
    for (let i = 0; i < visibleRows; i++) {
      const entry = visible[i]
      if (!entry) {
        rows.push({ text: ' '.repeat(PANE_WIDTH - 1), highlighted: false })
        continue
      }
      const realIdx = scrollOffset + i
      const name = truncate(entry.display, nameW)
      const size = entry.type === 'dir' ? '<DIR>' : formatSize(entry.size)
      const line = ` ${pad(name, nameW)}${pad(size, sizeW + 1)}${pad(entry.type === 'dir' ? 'DIR' : entry.type === 'link' ? 'LNK' : 'FILE', typeW)}`
      rows.push({ text: line.slice(0, PANE_WIDTH - 1), highlighted: realIdx === cursor && isActive })
    }
    return { rows, path }
  }

  // Build full render
  const leftPane = renderPane(leftEntries, leftPath, cursorLeft, activePane === 'left', 'left')
  const rightPane = renderPane(rightEntries, rightPath, cursorRight, activePane === 'right', 'right')

  // Render the view as JSX spans for proper highlighting
  const renderLines = () => {
    const lines: ReactNode[] = []

    // If editing a file
    if (dialog?.type === 'edit') {
      const modFlag = dialog.modified ? ' [modified]' : ''
      const titleText = `─ EDIT: ${truncate(dialog.path, TOTAL_WIDTH - 16)}${modFlag} `
      lines.push(
        <div key="edit-top" className="text-cyan-400">
          {`┌${pad(titleText, TOTAL_WIDTH - 2).replace(/ /g, (_, i) => i < titleText.length ? _ : '─')}┐`}
        </div>
      )
      const editRows = visibleRows + 2
      const lineNumW = Math.max(3, String(dialog.lines.length).length)
      const contentW = TOTAL_WIDTH - 4 - lineNumW - 1 // borders + linenum + separator

      for (let i = 0; i < editRows; i++) {
        const lineIdx = dialog.scroll + i
        if (lineIdx >= dialog.lines.length) {
          // Empty line below content
          const emptyLine = pad('~', TOTAL_WIDTH - 2)
          lines.push(
            <div key={`edit-${i}`} className="text-green-500/30">
              {`│${emptyLine}│`}
            </div>
          )
          continue
        }
        const lineContent = dialog.lines[lineIdx]
        const lineNum = pad(String(lineIdx + 1), lineNumW)
        const isCursorLine = lineIdx === dialog.cursorRow

        if (isCursorLine) {
          // Render with cursor
          const before = lineContent.slice(0, dialog.cursorCol)
          const cursorChar = dialog.cursorCol < lineContent.length ? lineContent[dialog.cursorCol] : ' '
          const after = lineContent.slice(dialog.cursorCol + 1)
          // Build spans for cursor highlighting
          const displayBefore = truncate(before, contentW)
          const remainW = contentW - displayBefore.length
          const displayCursorChar = remainW > 0 ? cursorChar : ''
          const displayAfter = remainW > 1 ? truncate(after, remainW - 1) : ''
          const padW = contentW - displayBefore.length - (displayCursorChar ? 1 : 0) - displayAfter.length

          lines.push(
            <div key={`edit-${i}`}>
              <span className="text-cyan-400">│</span>
              <span className="text-green-500/50">{lineNum}</span>
              <span className="text-cyan-400/30">│</span>
              <span className="text-green-400">{displayBefore}</span>
              <span className="bg-green-400 text-black">{displayCursorChar}</span>
              <span className="text-green-400">{displayAfter}</span>
              {padW > 0 && <span>{' '.repeat(padW)}</span>}
              <span className="text-cyan-400">│</span>
            </div>
          )
        } else {
          const display = truncate(lineContent, contentW)
          const padded = pad(display, contentW)
          lines.push(
            <div key={`edit-${i}`}>
              <span className="text-cyan-400">│</span>
              <span className="text-green-500/50">{lineNum}</span>
              <span className="text-cyan-400/30">│</span>
              <span className="text-green-500/80">{padded}</span>
              <span className="text-cyan-400">│</span>
            </div>
          )
        }
      }

      // Status bar
      const pos = `Ln ${dialog.cursorRow + 1}, Col ${dialog.cursorCol + 1}`
      const totalLines = `${dialog.lines.length} lines`
      const statusLeft = ` ${pos}  ${totalLines}`
      lines.push(
        <div key="edit-status" className="text-cyan-400">
          {`├${pad(statusLeft, TOTAL_WIDTH - 2).replace(/ /g, (_, i) => i < statusLeft.length ? _ : '─')}┤`}
        </div>
      )

      // Confirm quit dialog or help bar
      if (dialog.confirmQuit) {
        const quitMsg = ' File modified. Save? [Y]es [N]o [C]ancel'
        lines.push(
          <div key="edit-confirm" className="text-yellow-400">
            {`│${pad(quitMsg, TOTAL_WIDTH - 2)}│`}
          </div>
        )
      } else {
        const helpBar = ' F2 Save  Esc Quit  Ctrl+S Save'
        lines.push(
          <div key="edit-help" className="text-cyan-300">
            {`│${pad(helpBar, TOTAL_WIDTH - 2)}│`}
          </div>
        )
      }
      lines.push(
        <div key="edit-bottom" className="text-cyan-400">
          {`└${'─'.repeat(TOTAL_WIDTH - 2)}┘`}
        </div>
      )
      return lines
    }

    // If viewing a file
    if (dialog?.type === 'view') {
      const titleBar = `─ ${truncate(dialog.path, TOTAL_WIDTH - 4)} `
      lines.push(
        <div key="view-top" className="text-green-500">
          {`┌${pad(titleBar, TOTAL_WIDTH - 2).replace(/ /g, (_, i) => i < titleBar.length ? _ : '─')}┐`}
        </div>
      )
      const viewableRows = visibleRows + 2
      for (let i = 0; i < viewableRows; i++) {
        const lineIdx = dialog.scroll + i
        const content = lineIdx < dialog.lines.length ? dialog.lines[lineIdx] : ''
        const padded = pad(` ${truncate(content, TOTAL_WIDTH - 4)} `, TOTAL_WIDTH - 2)
        lines.push(
          <div key={`view-${i}`} className="text-green-500/80">
            {`│${padded}│`}
          </div>
        )
      }
      const scrollInfo = `${dialog.scroll + 1}-${Math.min(dialog.scroll + viewableRows, dialog.lines.length)}/${dialog.lines.length}`
      lines.push(
        <div key="view-bottom" className="text-green-500">
          {`└─ ${scrollInfo} ${'─'.repeat(Math.max(0, TOTAL_WIDTH - 5 - scrollInfo.length))}┘`}
        </div>
      )
      lines.push(
        <div key="view-help" className="text-green-400">
          {pad(' Esc/q=Close  ↑↓=Scroll  PgUp/PgDn=Page  Home/End', TOTAL_WIDTH)}
        </div>
      )
      return lines
    }

    // Header with paths
    const leftTitle = ` ${truncate(leftPane.path, PANE_WIDTH - 3)} `
    const rightTitle = ` ${truncate(rightPane.path, PANE_WIDTH - 3)} `
    const leftTitlePad = leftTitle + '─'.repeat(Math.max(0, PANE_WIDTH - 1 - leftTitle.length))
    const rightTitlePad = rightTitle + '─'.repeat(Math.max(0, PANE_WIDTH - 1 - rightTitle.length))
    lines.push(
      <div key="header">
        {`┌${leftTitlePad}┬${rightTitlePad}┐`}
      </div>
    )

    // Column headers
    const nameW = PANE_WIDTH - 12
    const colHeader = ` ${pad('Name', nameW)}${pad('Size', 6)}${pad('Type', 4)}`
    const ch = colHeader.slice(0, PANE_WIDTH - 1)
    lines.push(
      <div key="colheader" className="opacity-60">
        {`│${pad(ch, PANE_WIDTH - 1)}│${pad(ch, PANE_WIDTH - 1)}│`}
      </div>
    )
    lines.push(
      <div key="colsep">
        {`├${'─'.repeat(PANE_WIDTH - 1)}┼${'─'.repeat(PANE_WIDTH - 1)}┤`}
      </div>
    )

    // File rows
    for (let i = 0; i < visibleRows; i++) {
      const lr = leftPane.rows[i]
      const rr = rightPane.rows[i]
      const leftText = pad(lr?.text ?? '', PANE_WIDTH - 1)
      const rightText = pad(rr?.text ?? '', PANE_WIDTH - 1)

      lines.push(
        <div key={`row-${i}`}>
          <span className="opacity-100">│</span>
          <span className={lr?.highlighted ? '' : (lr?.text.trim() && leftPane.rows[i]?.text.includes('<DIR>') ? 'opacity-100' : 'opacity-70')} style={lr?.highlighted ? { backgroundColor: 'currentColor' } : undefined}>
            {lr?.highlighted ? <span style={{ color: '#050505' }}>{leftText}</span> : leftText}
          </span>
          <span className="opacity-100">│</span>
          <span className={rr?.highlighted ? '' : (rr?.text.trim() && rightPane.rows[i]?.text.includes('<DIR>') ? 'opacity-100' : 'opacity-70')} style={rr?.highlighted ? { backgroundColor: 'currentColor' } : undefined}>
            {rr?.highlighted ? <span style={{ color: '#050505' }}>{rightText}</span> : rightText}
          </span>
          <span className="opacity-100">│</span>
        </div>
      )
    }

    // Bottom separator
    lines.push(
      <div key="bottomsep">
        {`├${'─'.repeat(PANE_WIDTH - 1)}┴${'─'.repeat(PANE_WIDTH - 1)}┤`}
      </div>
    )

    // Function key bar
    const fnBar = ' F3 View F4 Edit F5 Copy F6 Move F7 Mkdir F8 Del F10 Quit'
    lines.push(
      <div key="fnbar">
        {`│${pad(fnBar, TOTAL_WIDTH - 2)}│`}
      </div>
    )
    lines.push(
      <div key="bottom">
        {`└${'─'.repeat(TOTAL_WIDTH - 2)}┘`}
      </div>
    )

    // Dialog overlay
    if (dialog?.type === 'mkdir') {
      lines.push(
        <div key="dialog-mkdir" className="text-yellow-400">
          {`  Create directory: ${dialog.value}█`}
        </div>
      )
    } else if (dialog?.type === 'confirm-delete') {
      lines.push(
        <div key="dialog-del" className="text-red-400">
          {`  Delete "${dialog.name}"? [y/N]`}
        </div>
      )
    } else if (dialog?.type === 'copy') {
      lines.push(
        <div key="dialog-copy" className="text-yellow-400">
          {`  Copy to: ${dialog.value}█`}
        </div>
      )
    } else if (dialog?.type === 'move') {
      lines.push(
        <div key="dialog-move" className="text-yellow-400">
          {`  Move to: ${dialog.value}█`}
        </div>
      )
    }

    return lines
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => containerRef.current?.focus()}
      className="flex-1 min-h-0 overflow-hidden font-mono text-[10px] leading-tight outline-none cursor-default select-none"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace' }}
    >
      <pre className="whitespace-pre">
        {renderLines()}
      </pre>
    </div>
  )
}
