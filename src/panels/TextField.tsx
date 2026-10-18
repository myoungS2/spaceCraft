import { useEffect, useState } from 'react'

interface Props {
  label: string
  value: string
  onCommit: (value: string) => void
}

/** 글자마다 히스토리가 쌓이지 않도록 Enter 또는 포커스 해제 시에만 확정한다. */
export function TextField({ label, value, onCommit }: Props) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  const commit = () => {
    const next = draft.trim()
    if (!next) return setDraft(value)
    if (next !== value) onCommit(next)
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          // 취소: 원래 값으로 되돌린다(blur하면 이전 draft가 확정되므로 하지 않음)
          if (e.key === 'Escape') setDraft(value)
        }}
      />
    </label>
  )
}
