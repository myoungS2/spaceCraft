import { useEffect, useState } from 'react'

interface Props {
  label: string
  value: number
  unit?: string
  min?: number
  max?: number
  disabled?: boolean
  /** 정수로 반올림·범위 제한된 값이 바뀌었을 때만 호출된다. */
  onCommit: (value: number) => void
}

/** Enter 또는 포커스 해제 시 확정하는 정수 입력. 입력 중에는 문서를 건드리지 않는다. */
export function NumberField({ label, value, unit = 'mm', min, max, disabled, onCommit }: Props) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => setDraft(String(value)), [value])

  const commit = () => {
    const parsed = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    let next = Math.round(parsed)
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    setDraft(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-wrap">
        <input
          inputMode="numeric"
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            // 취소: 원래 값으로 되돌린다(blur하면 이전 draft가 확정되므로 하지 않음)
            if (e.key === 'Escape') setDraft(String(value))
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  )
}
